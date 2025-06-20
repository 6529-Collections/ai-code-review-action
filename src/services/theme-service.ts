import { ChangedFile } from './git-service';
import * as exec from '@actions/exec';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ThemeSimilarityService } from './theme-similarity';
import {
  ConsolidatedTheme,
  ConsolidationConfig,
} from '../types/similarity-types';
import { CodeAnalyzer, CodeChange, SmartContext } from '../utils/code-analyzer';

// Concurrency configuration
const PARALLEL_CONFIG = {
  BATCH_SIZE: 10,
  CHUNK_TIMEOUT: 120000, // 2 minutes
  MAX_RETRIES: 3,
} as const;

export interface Theme {
  id: string;
  name: string;
  description: string;
  level: number;
  parentId?: string;
  childIds: string[];

  affectedFiles: string[];
  codeSnippets: string[];
  confidence: number;

  context: string;
  enhancedContext: SmartContext; // Rich code context with algorithmic + AI insights
  codeChanges: CodeChange[]; // Detailed code change information
  lastAnalysis: Date;
}

export interface CodeChunk {
  id: string;
  content: string;
  filename: string;
  startLine?: number;
  endLine?: number;
  type: 'function' | 'class' | 'file' | 'block';
}

export interface ChunkAnalysis {
  themeName: string;
  description: string;
  businessImpact: string;
  suggestedParent?: string | null;
  confidence: number;
  codePattern: string;
}

export interface ThemePlacement {
  action: 'merge' | 'create';
  targetThemeId?: string;
  level?: number;
}

export interface LiveContext {
  themes: Map<string, Theme>;
  rootThemeIds: string[];
  globalInsights: string[];
  processingState: 'idle' | 'processing' | 'complete';
}

export interface ChunkAnalysisResult {
  chunk: CodeChunk;
  analysis: ChunkAnalysis;
  error?: string;
}

export interface ThemeAnalysisResult {
  themes: ConsolidatedTheme[];
  originalThemes: Theme[];
  summary: string;
  changedFilesCount: number;
  analysisTimestamp: Date;
  totalThemes: number;
  originalThemeCount: number;
  processingTime: number;
  consolidationTime: number;
  expandable: {
    hasChildThemes: boolean;
    canDrillDown: boolean;
  };
  consolidationStats: {
    mergedThemes: number;
    hierarchicalThemes: number;
    consolidationRatio: number;
  };
}

class ClaudeService {
  constructor(private readonly apiKey: string) {}

  async analyzeChunk(
    chunk: CodeChunk,
    context: string
  ): Promise<ChunkAnalysis> {
    const prompt = this.buildAnalysisPrompt(chunk, context);
    let output = '';
    let tempFile: string | null = null;

    try {
      // Use a unique temporary file for each concurrent request
      tempFile = path.join(
        os.tmpdir(),
        `claude-prompt-${Date.now()}-${Math.random().toString(36).substring(2)}.txt`
      );
      fs.writeFileSync(tempFile, prompt);

      await exec.exec('bash', ['-c', `cat "${tempFile}" | claude`], {
        listeners: {
          stdout: (data: Buffer) => {
            output += data.toString();
          },
        },
      });

      const result = this.parseClaudeResponse(output);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.warn('Claude analysis failed, using fallback:', error);
      return this.createFallbackAnalysis(chunk);
    } finally {
      // Always attempt cleanup, but don't fail if file doesn't exist
      if (tempFile) {
        try {
          if (fs.existsSync(tempFile)) {
            fs.unlinkSync(tempFile);
          }
        } catch (cleanupError) {
          console.warn(
            `Failed to cleanup temp file ${tempFile}:`,
            cleanupError
          );
        }
      }
    }
  }

  private buildEnhancedAnalysisPrompt(
    chunk: CodeChunk,
    context: string,
    codeChange?: CodeChange,
    smartContext?: SmartContext
  ): string {
    // Limit content length to avoid overwhelming Claude
    const maxContentLength = 2000;
    const truncatedContent =
      chunk.content.length > maxContentLength
        ? chunk.content.substring(0, maxContentLength) + '\n... (truncated)'
        : chunk.content;

    let enhancedContext = context;

    // Add algorithmic context if available
    if (codeChange && smartContext) {
      enhancedContext += `\n\nCODE ANALYSIS CONTEXT:`;
      enhancedContext += `\nFile: ${codeChange.file} (${codeChange.changeType})`;
      enhancedContext += `\nChanges: +${codeChange.linesAdded}/-${codeChange.linesRemoved} lines`;
      enhancedContext += `\nFile type: ${codeChange.fileType}`;

      if (codeChange.functionsChanged.length > 0) {
        enhancedContext += `\nFunctions affected: ${codeChange.functionsChanged.slice(0, 3).join(', ')}${codeChange.functionsChanged.length > 3 ? '...' : ''}`;
      }

      if (codeChange.classesChanged.length > 0) {
        enhancedContext += `\nClasses/interfaces affected: ${codeChange.classesChanged.slice(0, 3).join(', ')}${codeChange.classesChanged.length > 3 ? '...' : ''}`;
      }

      if (codeChange.importsChanged.length > 0) {
        enhancedContext += `\nImports affected: ${codeChange.importsChanged.slice(0, 2).join(', ')}${codeChange.importsChanged.length > 2 ? '...' : ''}`;
      }

      if (codeChange.isTestFile) {
        enhancedContext += `\nThis is a TEST file`;
      }

      if (codeChange.isConfigFile) {
        enhancedContext += `\nThis is a CONFIG file`;
      }

      enhancedContext += `\nOverall complexity: ${smartContext.fileMetrics.codeComplexity}`;
    }

    return `${enhancedContext}

Analyze this code change from a USER and BUSINESS perspective (not technical implementation):

File: ${chunk.filename}
Code changes:
${truncatedContent}

Focus on:
- What user experience or workflow is being improved?
- What business capability is being added/removed/enhanced?
- What problem is this solving for end users?
- Think like a product manager, not a developer

Examples of good business-focused themes:
- "Remove demo functionality" (not "Delete greeting parameter")
- "Improve code review automation" (not "Add AI services")
- "Simplify configuration" (not "Update workflow files")
- "Add pull request feedback" (not "Implement commenting system")

Respond in this exact JSON format (no other text):
{
  "themeName": "user/business-focused name (what value does this provide?)",
  "description": "what business problem this solves or capability it provides",
  "businessImpact": "how this affects user experience or business outcomes",
  "suggestedParent": null,
  "confidence": 0.8,
  "codePattern": "what pattern this represents"
}`;
  }

  private buildAnalysisPrompt(chunk: CodeChunk, context: string): string {
    // Limit content length to avoid overwhelming Claude
    const maxContentLength = 2000;
    const truncatedContent =
      chunk.content.length > maxContentLength
        ? chunk.content.substring(0, maxContentLength) + '\n... (truncated)'
        : chunk.content;

    return `${context}

Analyze this code change from a USER and BUSINESS perspective (not technical implementation):

File: ${chunk.filename}
Code changes:
${truncatedContent}

Focus on:
- What user experience or workflow is being improved?
- What business capability is being added/removed/enhanced?
- What problem is this solving for end users?
- Think like a product manager, not a developer

Examples of good business-focused themes:
- "Remove demo functionality" (not "Delete greeting parameter")
- "Improve code review automation" (not "Add AI services")
- "Simplify configuration" (not "Update workflow files")
- "Add pull request feedback" (not "Implement commenting system")

Respond in this exact JSON format (no other text):
{
  "themeName": "user/business-focused name (what value does this provide?)",
  "description": "what business problem this solves or capability it provides",
  "businessImpact": "how this affects user experience or business outcomes",
  "suggestedParent": null,
  "confidence": 0.8,
  "codePattern": "what pattern this represents"
}`;
  }

  private parseClaudeResponse(output: string): ChunkAnalysis {
    try {
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.warn('Failed to parse Claude response:', error);
    }

    return {
      themeName: 'Parse Error',
      description: 'Failed to parse Claude response',
      businessImpact: 'Unknown',
      confidence: 0.1,
      codePattern: 'Unknown',
    };
  }

  private createFallbackAnalysis(chunk: CodeChunk): ChunkAnalysis {
    return {
      themeName: `Changes in ${chunk.filename}`,
      description: 'Analysis unavailable - using fallback',
      businessImpact: 'Unknown impact',
      confidence: 0.3,
      codePattern: 'File modification',
      suggestedParent: undefined,
    };
  }
}

class ChunkProcessor {
  splitChangedFiles(files: ChangedFile[]): CodeChunk[] {
    return files.map((file, index) => ({
      id: `chunk-${index}`,
      content: file.patch || '',
      filename: file.filename,
      type: 'file' as const,
    }));
  }
}

class ThemeContextManager {
  private context: LiveContext;
  private claudeService: ClaudeService;

  constructor(apiKey: string) {
    this.context = {
      themes: new Map(),
      rootThemeIds: [],
      globalInsights: [],
      processingState: 'idle',
    };
    this.claudeService = new ClaudeService(apiKey);
  }

  async processChunk(chunk: CodeChunk): Promise<void> {
    const contextString = this.buildContextForClaude();
    const analysis = await this.claudeService.analyzeChunk(
      chunk,
      contextString
    );
    const placement = this.determineThemePlacement(analysis);
    this.updateContext(placement, analysis, chunk);
  }

  async analyzeChunkOnly(chunk: CodeChunk): Promise<ChunkAnalysisResult> {
    try {
      const contextString = this.buildContextForClaude();
      const analysis = await this.claudeService.analyzeChunk(
        chunk,
        contextString
      );
      return { chunk, analysis };
    } catch (error) {
      return {
        chunk,
        analysis: this.createFallbackAnalysis(chunk),
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  processBatchResults(results: ChunkAnalysisResult[]): void {
    for (const result of results) {
      if (result.error) {
        console.warn(
          `Chunk analysis failed for ${result.chunk.filename}: ${result.error}`
        );
      }
      const placement = this.determineThemePlacement(result.analysis);
      this.updateContext(placement, result.analysis, result.chunk);
    }
  }

  private createFallbackAnalysis(chunk: CodeChunk): ChunkAnalysis {
    return {
      themeName: `Changes in ${chunk.filename}`,
      description: 'Analysis unavailable - using fallback',
      businessImpact: 'Unknown impact',
      confidence: 0.3,
      codePattern: 'File modification',
      suggestedParent: undefined,
    };
  }

  private buildContextForClaude(): string {
    const existingThemes = Array.from(this.context.themes.values())
      .filter((t) => t.level === 0)
      .map((t) => `${t.name}: ${t.description}`)
      .join('\n');

    return existingThemes.length > 0
      ? `Current root themes:\n${existingThemes}`
      : 'No existing themes yet.';
  }

  private determineThemePlacement(analysis: ChunkAnalysis): ThemePlacement {
    if (analysis.suggestedParent) {
      const parentTheme = this.findThemeByName(analysis.suggestedParent);
      if (parentTheme && this.shouldMergeWithParent(analysis, parentTheme)) {
        return { action: 'merge', targetThemeId: parentTheme.id };
      }
    }

    return { action: 'create', level: 0 };
  }

  private findThemeByName(name: string): Theme | undefined {
    return Array.from(this.context.themes.values()).find(
      (theme) => theme.name.toLowerCase() === name.toLowerCase()
    );
  }

  private shouldMergeWithParent(
    analysis: ChunkAnalysis,
    parent: Theme
  ): boolean {
    return (
      analysis.confidence > 0.7 &&
      this.similarityScore(analysis.description, parent.description) > 0.6
    );
  }

  private similarityScore(desc1: string, desc2: string): number {
    const words1 = desc1.toLowerCase().split(' ');
    const words2 = desc2.toLowerCase().split(' ');
    const commonWords = words1.filter((word) => words2.includes(word));
    return commonWords.length / Math.max(words1.length, words2.length);
  }

  private updateContext(
    placement: ThemePlacement,
    analysis: ChunkAnalysis,
    chunk: CodeChunk
  ): void {
    if (placement.action === 'merge' && placement.targetThemeId) {
      const existingTheme = this.context.themes.get(placement.targetThemeId);
      if (existingTheme) {
        existingTheme.affectedFiles.push(chunk.filename);
        existingTheme.codeSnippets.push(chunk.content);
        existingTheme.context += `\n${analysis.description}`;
        existingTheme.lastAnalysis = new Date();
      }
    } else {
      const newTheme: Theme = {
        id: `theme-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        name: analysis.themeName,
        description: analysis.description,
        level: placement.level || 0,
        childIds: [],
        affectedFiles: [chunk.filename],
        codeSnippets: [chunk.content],
        confidence: analysis.confidence,
        context: analysis.description,
        enhancedContext: {
          fileMetrics: {
            totalFiles: 1,
            fileTypes: [chunk.filename.split('.').pop() || 'unknown'],
            hasTests: false,
            hasConfig: false,
            codeComplexity: 'low',
          },
          changePatterns: {
            newFunctions: [],
            modifiedFunctions: [],
            newImports: [],
            removedImports: [],
            newClasses: [],
            modifiedClasses: [],
          },
          contextSummary: `Single chunk: ${chunk.filename}`,
          significantChanges: [],
        },
        codeChanges: [],
        lastAnalysis: new Date(),
      };

      this.context.themes.set(newTheme.id, newTheme);
      if (newTheme.level === 0) {
        this.context.rootThemeIds.push(newTheme.id);
      }
    }
  }

  getRootThemes(): Theme[] {
    return this.context.rootThemeIds
      .map((id) => this.context.themes.get(id))
      .filter((theme): theme is Theme => theme !== undefined);
  }

  getProcessingState(): LiveContext['processingState'] {
    return this.context.processingState;
  }

  setProcessingState(state: LiveContext['processingState']): void {
    this.context.processingState = state;
  }
}

// Utility function for batch processing with concurrency control
async function processBatches<T, R>(
  items: T[],
  batchSize: number,
  processor: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchPromises = batch.map((item) =>
      Promise.race([
        processor(item),
        new Promise<R>((_, reject) =>
          setTimeout(
            () => reject(new Error('Timeout')),
            PARALLEL_CONFIG.CHUNK_TIMEOUT
          )
        ),
      ])
    );

    const batchResults = await Promise.allSettled(batchPromises);
    for (let j = 0; j < batchResults.length; j++) {
      const result = batchResults[j];
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        console.warn(`Batch item ${i + j} failed:`, result.reason);
        // Add a fallback result or skip
      }
    }
  }

  return results;
}

export class ThemeService {
  private similarityService: ThemeSimilarityService;

  constructor(
    private readonly anthropicApiKey: string,
    consolidationConfig?: Partial<ConsolidationConfig>
  ) {
    this.similarityService = new ThemeSimilarityService(
      anthropicApiKey,
      consolidationConfig
    );
  }

  async analyzeThemesWithEnhancedContext(
    gitService: import('./git-service').GitService
  ): Promise<ThemeAnalysisResult> {
    console.log('[THEME-SERVICE] Starting enhanced theme analysis');
    const startTime = Date.now();

    // Get enhanced code changes instead of basic changed files
    const codeChanges = await gitService.getEnhancedChangedFiles();
    console.log(
      `[THEME-SERVICE] Got ${codeChanges.length} enhanced code changes`
    );

    // Analyze the code changes to build smart context
    const smartContext = CodeAnalyzer.analyzeCodeChanges(codeChanges);
    console.log(
      `[THEME-SERVICE] Smart context: ${smartContext.contextSummary}`
    );

    // Convert to the legacy format temporarily while we transition
    const changedFiles = codeChanges.map((change) => ({
      filename: change.file,
      status: change.changeType as 'added' | 'modified' | 'removed' | 'renamed',
      additions: change.linesAdded,
      deletions: change.linesRemoved,
      patch: change.diffHunk,
    }));

    return this.analyzeThemesInternal(
      changedFiles,
      codeChanges,
      smartContext,
      startTime
    );
  }

  async analyzeThemes(
    changedFiles: ChangedFile[]
  ): Promise<ThemeAnalysisResult> {
    console.log('[THEME-SERVICE] Starting legacy theme analysis');
    const startTime = Date.now();
    return this.analyzeThemesInternal(changedFiles, [], null, startTime);
  }

  private async analyzeThemesInternal(
    changedFiles: ChangedFile[],
    codeChanges: CodeChange[],
    smartContext: SmartContext | null,
    startTime: number
  ): Promise<ThemeAnalysisResult> {
    const analysisResult: ThemeAnalysisResult = {
      themes: [],
      originalThemes: [],
      summary: `Analysis of ${changedFiles.length} changed files`,
      changedFilesCount: changedFiles.length,
      analysisTimestamp: new Date(),
      totalThemes: 0,
      originalThemeCount: 0,
      processingTime: 0,
      consolidationTime: 0,
      expandable: {
        hasChildThemes: false,
        canDrillDown: false,
      },
      consolidationStats: {
        mergedThemes: 0,
        hierarchicalThemes: 0,
        consolidationRatio: 0,
      },
    };

    if (changedFiles.length === 0) {
      analysisResult.summary = 'No files changed in this PR';
      return analysisResult;
    }

    try {
      const contextManager = new ThemeContextManager(this.anthropicApiKey);
      const chunkProcessor = new ChunkProcessor();

      contextManager.setProcessingState('processing');

      const chunks = chunkProcessor.splitChangedFiles(changedFiles);

      // Parallel processing: analyze all chunks concurrently, then update context sequentially
      const analysisResults = await processBatches(
        chunks,
        PARALLEL_CONFIG.BATCH_SIZE,
        (chunk) => contextManager.analyzeChunkOnly(chunk)
      );

      // Sequential context updates to maintain thread safety
      contextManager.processBatchResults(analysisResults);

      contextManager.setProcessingState('complete');

      const originalThemes = contextManager.getRootThemes();
      const consolidationStartTime = Date.now();

      // Apply theme consolidation
      const consolidatedThemes =
        await this.similarityService.consolidateThemes(originalThemes);
      const consolidationTime = Date.now() - consolidationStartTime;

      // Calculate consolidation stats
      const mergedThemes = consolidatedThemes.filter(
        (t) => t.consolidationMethod === 'merge'
      ).length;
      const hierarchicalThemes = consolidatedThemes.filter(
        (t) => t.childThemes.length > 0
      ).length;
      const consolidationRatio =
        originalThemes.length > 0
          ? (originalThemes.length - consolidatedThemes.length) /
            originalThemes.length
          : 0;

      analysisResult.originalThemes = originalThemes;
      analysisResult.themes = consolidatedThemes;
      analysisResult.totalThemes = consolidatedThemes.length;
      analysisResult.originalThemeCount = originalThemes.length;
      analysisResult.processingTime = Date.now() - startTime;
      analysisResult.consolidationTime = consolidationTime;
      analysisResult.consolidationStats = {
        mergedThemes,
        hierarchicalThemes,
        consolidationRatio,
      };

      if (consolidatedThemes.length > 0) {
        const hasHierarchy = consolidatedThemes.some(
          (t) => t.childThemes.length > 0
        );
        analysisResult.summary =
          `Discovered ${consolidatedThemes.length} consolidated themes` +
          (originalThemes.length !== consolidatedThemes.length
            ? ` (consolidated from ${originalThemes.length} original themes)`
            : '') +
          `: ${consolidatedThemes.map((t) => t.name).join(', ')}`;
        analysisResult.expandable.canDrillDown = true;
        analysisResult.expandable.hasChildThemes = hasHierarchy;
      }
    } catch (error) {
      console.error('Theme analysis failed:', error);
      analysisResult.summary = 'Theme analysis failed - using fallback';
      const fallbackThemes = this.createFallbackThemes(changedFiles);
      analysisResult.themes = fallbackThemes.map((theme) => ({
        ...theme,
        level: 0,
        childThemes: [],
        businessImpact: theme.description,
        sourceThemes: [theme.id],
        consolidationMethod: 'single' as const,
      }));
      analysisResult.totalThemes = analysisResult.themes.length;
    }

    analysisResult.processingTime = Date.now() - startTime;
    return analysisResult;
  }

  private createFallbackThemes(changedFiles: ChangedFile[]): Theme[] {
    const fileTypes = [
      ...new Set(
        changedFiles.map((f) => f.filename.split('.').pop() || 'unknown')
      ),
    ];

    return [
      {
        id: 'fallback-theme',
        name: 'Code Changes',
        description: 'Fallback theme when analysis fails',
        level: 0,
        childIds: [],
        affectedFiles: changedFiles.map((f) => f.filename),
        codeSnippets: [],
        confidence: 0.3,
        context: 'Analysis failed, manual review recommended',
        enhancedContext: {
          fileMetrics: {
            totalFiles: changedFiles.length,
            fileTypes: fileTypes.filter((type) => type !== 'unknown'),
            hasTests: changedFiles.some((f) =>
              /\.test\.|\.spec\./.test(f.filename)
            ),
            hasConfig: changedFiles.some((f) =>
              /\.config\.|package\.json/.test(f.filename)
            ),
            codeComplexity:
              changedFiles.length > 5
                ? 'high'
                : changedFiles.length > 2
                  ? 'medium'
                  : 'low',
          },
          changePatterns: {
            newFunctions: [],
            modifiedFunctions: [],
            newImports: [],
            removedImports: [],
            newClasses: [],
            modifiedClasses: [],
          },
          contextSummary: `Fallback analysis: ${changedFiles.length} files changed`,
          significantChanges: [
            `Analysis failed for ${changedFiles.length} files`,
          ],
        },
        codeChanges: [],
        lastAnalysis: new Date(),
      },
    ];
  }
}
