import { ChangedFile } from './git-service';
import * as exec from '@actions/exec';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ThemeSimilarityService } from './theme-similarity';
import { ThemeExpansionService } from './theme-expansion';
import { HierarchicalSimilarityService } from './hierarchical-similarity';
import {
  ConsolidatedTheme,
  ConsolidationConfig,
} from '../types/similarity-types';
import {
  AICodeAnalyzer,
  CodeChange,
  SmartContext,
} from '../utils/ai-code-analyzer';
import { JsonExtractor } from '../utils/json-extractor';
import { ConcurrencyManager } from '../utils/concurrency-manager';

// Concurrency configuration
const PARALLEL_CONFIG = {
  CONCURRENCY_LIMIT: 5,
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

  // New fields for richer context
  detailedDescription?: string; // 2-3 sentence detailed explanation
  technicalSummary?: string; // Technical changes summary
  keyChanges?: string[]; // Bullet points of main changes
  userScenario?: string; // Example user flow

  // Code context
  mainFunctionsChanged?: string[]; // Key functions/methods
  mainClassesChanged?: string[]; // Key classes/components
  codeMetrics?: {
    linesAdded: number;
    linesRemoved: number;
    filesChanged: number;
  };

  // Enhanced snippets
  codeExamples?: Array<{
    file: string;
    description: string;
    snippet: string;
  }>;
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

  // New detailed fields
  detailedDescription?: string;
  technicalSummary?: string;
  keyChanges?: string[];
  userScenario?: string;
  mainFunctionsChanged?: string[];
  mainClassesChanged?: string[];
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
  expansionTime?: number;
  expandable: {
    hasChildThemes: boolean;
    canDrillDown: boolean;
  };
  consolidationStats: {
    mergedThemes: number;
    hierarchicalThemes: number;
    consolidationRatio: number;
  };
  expansionStats?: {
    expandedThemes: number;
    maxDepth: number;
    averageDepth: number;
    totalSubThemes: number;
  };
}

class ClaudeService {
  constructor(private readonly _apiKey: string) {}

  async analyzeChunk(
    chunk: CodeChunk,
    context: string,
    codeChange?: CodeChange
  ): Promise<ChunkAnalysis> {
    const prompt = this.buildAnalysisPrompt(chunk, context, codeChange);
    let output = '';
    let tempFile: string | null = null;

    try {
      // Use a unique temporary file for each concurrent request
      tempFile = path.join(
        os.tmpdir(),
        `claude-prompt-${Date.now()}-${Math.random().toString(36).substring(2)}.txt`
      );
      fs.writeFileSync(tempFile, prompt);

      await exec.exec('bash', ['-c', `cat "${tempFile}" | claude --print`], {
        listeners: {
          stdout: (data: Buffer) => {
            output += data.toString();
          },
        },
      });

      const result = this.parseClaudeResponse(output, chunk, codeChange);
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

  private buildAnalysisPrompt(
    chunk: CodeChunk,
    context: string,
    codeChange?: CodeChange
  ): string {
    // Limit content length to avoid overwhelming Claude
    const maxContentLength = 2000;
    const truncatedContent =
      chunk.content.length > maxContentLength
        ? chunk.content.substring(0, maxContentLength) + '\n... (truncated)'
        : chunk.content;

    // Build enhanced context with pre-extracted data
    let enhancedContext = context;

    if (codeChange) {
      enhancedContext += `\n\nPre-analyzed code structure:`;
      enhancedContext += `\nFile type: ${codeChange.fileType}`;
      enhancedContext += `\nComplexity: ${codeChange.codeComplexity}`;
      enhancedContext += `\nChanges: +${codeChange.linesAdded}/-${codeChange.linesRemoved} lines`;

      if (codeChange.functionsChanged.length > 0) {
        enhancedContext += `\nFunctions changed: ${codeChange.functionsChanged.join(', ')}`;
      }

      if (codeChange.classesChanged.length > 0) {
        enhancedContext += `\nClasses changed: ${codeChange.classesChanged.join(', ')}`;
      }

      if (codeChange.importsChanged.length > 0) {
        enhancedContext += `\nImports changed: ${codeChange.importsChanged.join(', ')}`;
      }

      if (codeChange.isTestFile) {
        enhancedContext += `\nThis is a TEST file`;
      }

      if (codeChange.isConfigFile) {
        enhancedContext += `\nThis is a CONFIG file`;
      }
    }

    return `${enhancedContext}

Analyze this code change. Be specific but concise.

File: ${chunk.filename}
Code changes:
${truncatedContent}

Focus on WHAT changed with exact details:
- Exact values changed (before → after)
- Business purpose of the changes
- User impact

Examples:
✅ "Changed pull_request.branches from ['main'] to ['**'] in .github/workflows/test.yml"
✅ "Added detailedDescription field to ConsolidatedTheme interface"
❌ "Enhanced workflow configuration for improved flexibility"
❌ "Expanded theme structure with comprehensive analysis capabilities"

CRITICAL: Respond with ONLY valid JSON:

{
  "themeName": "what this accomplishes (max 10 words)",
  "description": "one specific sentence with exact names/values (max 20 words)",
  "detailedDescription": "additional context if needed (max 15 words, or null)",
  "businessImpact": "user benefit in one sentence (max 15 words)",
  "technicalSummary": "exact technical change (max 12 words)",
  "keyChanges": ["max 3 changes, each max 10 words"],
  "userScenario": null,
  "suggestedParent": null,
  "confidence": 0.8,
  "codePattern": "change type (max 3 words)"
}`;
  }

  private parseClaudeResponse(
    output: string,
    chunk: CodeChunk,
    codeChange?: CodeChange
  ): ChunkAnalysis {
    const extractionResult = JsonExtractor.extractAndValidateJson(
      output,
      'object',
      ['themeName', 'description', 'businessImpact', 'confidence']
    );

    if (extractionResult.success) {
      const data = extractionResult.data as {
        themeName?: string;
        description?: string;
        businessImpact?: string;
        confidence?: number;
        codePattern?: string;
        suggestedParent?: string;
        detailedDescription?: string;
        technicalSummary?: string;
        keyChanges?: string[];
        userScenario?: string;
        mainFunctionsChanged?: string[];
        mainClassesChanged?: string[];
      };
      return {
        themeName: data.themeName || 'Unknown Theme',
        description: data.description || 'No description provided',
        businessImpact: data.businessImpact || 'Unknown impact',
        confidence: data.confidence || 0.5,
        codePattern: data.codePattern || 'Unknown pattern',
        suggestedParent: data.suggestedParent || undefined,
        detailedDescription: data.detailedDescription,
        technicalSummary: data.technicalSummary,
        keyChanges: data.keyChanges,
        userScenario: data.userScenario,
        mainFunctionsChanged:
          codeChange?.functionsChanged || data.mainFunctionsChanged || [],
        mainClassesChanged:
          codeChange?.classesChanged || data.mainClassesChanged || [],
      };
    }

    console.warn(
      '[THEME-SERVICE] JSON extraction failed:',
      extractionResult.error
    );
    if (extractionResult.originalResponse) {
      console.debug(
        '[THEME-SERVICE] Original response:',
        extractionResult.originalResponse?.substring(0, 200) + '...'
      );
    }

    // Use the better fallback that includes filename
    return this.createFallbackAnalysis(chunk);
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

  async analyzeChunkOnly(
    chunk: CodeChunk,
    codeChange?: CodeChange
  ): Promise<ChunkAnalysisResult> {
    try {
      const contextString = this.buildContextForClaude();
      const analysis = await this.claudeService.analyzeChunk(
        chunk,
        contextString,
        codeChange
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

  processBatchResults(
    results: ChunkAnalysisResult[],
    codeChangeMap: Map<string, CodeChange>
  ): void {
    for (const result of results) {
      if (result.error) {
        console.warn(
          `Chunk analysis failed for ${result.chunk.filename}: ${result.error}`
        );
      }
      const placement = this.determineThemePlacement(result.analysis);
      const codeChange = codeChangeMap.get(result.chunk.filename);
      this.updateContext(placement, result.analysis, result.chunk, codeChange);
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
    chunk: CodeChunk,
    codeChange?: CodeChange
  ): void {
    if (placement.action === 'merge' && placement.targetThemeId) {
      const existingTheme = this.context.themes.get(placement.targetThemeId);
      if (existingTheme) {
        existingTheme.affectedFiles.push(chunk.filename);
        existingTheme.codeSnippets.push(chunk.content);
        existingTheme.context += `\n${analysis.description}`;
        existingTheme.lastAnalysis = new Date();

        // Add CodeChange data to existing theme
        if (codeChange) {
          existingTheme.codeChanges.push(codeChange);

          // Update metrics
          if (existingTheme.codeMetrics && codeChange) {
            existingTheme.codeMetrics.linesAdded += codeChange.linesAdded;
            existingTheme.codeMetrics.linesRemoved += codeChange.linesRemoved;
            existingTheme.codeMetrics.filesChanged += 1;
          } else if (codeChange) {
            existingTheme.codeMetrics = {
              linesAdded: codeChange.linesAdded,
              linesRemoved: codeChange.linesRemoved,
              filesChanged: 1,
            };
          }
        }
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
            hasTests: codeChange?.isTestFile || false,
            hasConfig: codeChange?.isConfigFile || false,
            codeComplexity: codeChange?.codeComplexity || 'low',
          },
          changePatterns: {
            newFunctions: codeChange?.functionsChanged || [],
            modifiedFunctions: codeChange?.functionsChanged || [],
            newImports: codeChange?.importsChanged || [],
            removedImports: [],
            newClasses: codeChange?.classesChanged || [],
            modifiedClasses: codeChange?.classesChanged || [],
            architecturalPatterns: codeChange?.architecturalPatterns || [],
            businessDomains: codeChange?.businessDomain
              ? [codeChange.businessDomain]
              : [],
          },
          contextSummary:
            codeChange?.semanticDescription ||
            `Single chunk: ${chunk.filename}`,
          significantChanges: codeChange?.semanticDescription
            ? [codeChange.semanticDescription]
            : [],
        },
        codeChanges: codeChange ? [codeChange] : [],
        lastAnalysis: new Date(),
        // New detailed fields
        detailedDescription: analysis.detailedDescription,
        technicalSummary: analysis.technicalSummary,
        keyChanges: analysis.keyChanges,
        userScenario: analysis.userScenario,
        mainFunctionsChanged: analysis.mainFunctionsChanged,
        mainClassesChanged: analysis.mainClassesChanged,
        codeMetrics: codeChange
          ? {
              linesAdded: codeChange.linesAdded,
              linesRemoved: codeChange.linesRemoved,
              filesChanged: 1,
            }
          : undefined,
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

export class ThemeService {
  private similarityService: ThemeSimilarityService;
  private expansionService: ThemeExpansionService;
  private hierarchicalSimilarityService: HierarchicalSimilarityService;
  private expansionEnabled: boolean;

  constructor(
    private readonly anthropicApiKey: string,
    consolidationConfig?: Partial<ConsolidationConfig>
  ) {
    this.similarityService = new ThemeSimilarityService(
      anthropicApiKey,
      consolidationConfig
    );

    // Initialize expansion services
    this.expansionService = new ThemeExpansionService(anthropicApiKey);
    this.hierarchicalSimilarityService = new HierarchicalSimilarityService(
      anthropicApiKey
    );

    // Enable expansion by default
    this.expansionEnabled = consolidationConfig?.expansionEnabled ?? true;
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

    // Analyze the code changes to build smart context with AI
    const aiAnalyzer = new AICodeAnalyzer(this.anthropicApiKey);
    const smartContext = await aiAnalyzer.analyzeCodeChanges(codeChanges);
    console.log(
      `[THEME-SERVICE] AI-enhanced smart context: ${smartContext.contextSummary}`
    );

    // Convert to the legacy format for ChunkProcessor compatibility
    const changedFiles = codeChanges.map((change) => ({
      filename: change.file,
      status: change.changeType as 'added' | 'modified' | 'removed' | 'renamed',
      additions: change.linesAdded,
      deletions: change.linesRemoved,
      patch: change.diffHunk,
    }));

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
      // Create lookup map for CodeChange data
      const codeChangeMap = new Map<string, CodeChange>();
      codeChanges.forEach((change) => {
        codeChangeMap.set(change.file, change);
      });

      const contextManager = new ThemeContextManager(this.anthropicApiKey);
      const chunkProcessor = new ChunkProcessor();

      contextManager.setProcessingState('processing');

      const chunks = chunkProcessor.splitChangedFiles(changedFiles);

      // Parallel processing: analyze all chunks concurrently, then update context sequentially
      console.log(
        `[THEME-SERVICE] Starting concurrent analysis of ${chunks.length} chunks`
      );

      const results = await ConcurrencyManager.processConcurrentlyWithLimit(
        chunks,
        (chunk) => {
          const codeChange = codeChangeMap.get(chunk.filename);
          return contextManager.analyzeChunkOnly(chunk, codeChange);
        },
        {
          concurrencyLimit: PARALLEL_CONFIG.CONCURRENCY_LIMIT,
          maxRetries: PARALLEL_CONFIG.MAX_RETRIES,
          enableLogging: true,
          onProgress: (completed, total) => {
            console.log(
              `[THEME-SERVICE] Chunk analysis progress: ${completed}/${total}`
            );
          },
          onError: (error, chunk, retryCount) => {
            console.warn(
              `[THEME-SERVICE] Retry ${retryCount} for chunk ${chunk.filename}: ${error.message}`
            );
          },
        }
      );

      // Transform results to handle ConcurrencyManager's mixed return types
      const analysisResults: ChunkAnalysisResult[] = [];
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (result && typeof result === 'object' && 'error' in result) {
          // Convert ConcurrencyManager error format to ChunkAnalysisResult format
          const errorResult = result as { error: Error; item: CodeChunk };
          console.warn(
            `[THEME-SERVICE] Chunk analysis failed for ${errorResult.item.filename}: ${errorResult.error.message}`
          );
          analysisResults.push({
            chunk: errorResult.item,
            analysis: {
              themeName: `Changes in ${errorResult.item.filename}`,
              description: 'Analysis failed - using fallback',
              businessImpact: 'Unknown impact',
              confidence: 0.3,
              codePattern: 'File modification',
              suggestedParent: undefined,
            },
            error: errorResult.error.message,
          });
        } else {
          analysisResults.push(result as ChunkAnalysisResult);
        }
      }

      console.log(
        `[THEME-SERVICE] Analysis completed: ${analysisResults.length} chunks processed`
      );

      // Sequential context updates to maintain thread safety
      contextManager.processBatchResults(analysisResults, codeChangeMap);

      contextManager.setProcessingState('complete');

      const originalThemes = contextManager.getRootThemes();
      const consolidationStartTime = Date.now();

      // Apply theme consolidation
      let consolidatedThemes =
        await this.similarityService.consolidateThemes(originalThemes);
      const consolidationTime = Date.now() - consolidationStartTime;

      // Apply hierarchical expansion if enabled
      let expansionTime = 0;
      let expansionStats = undefined;

      if (this.expansionEnabled && consolidatedThemes.length > 0) {
        console.log('[THEME-SERVICE] Starting hierarchical expansion');
        const expansionStartTime = Date.now();

        try {
          // Expand themes hierarchically
          console.log(
            `[DEBUG-THEME-SERVICE] Before expansion: ${consolidatedThemes.length} themes`
          );
          const expandedThemes =
            await this.expansionService.expandThemesHierarchically(
              consolidatedThemes
            );
          console.log(
            `[DEBUG-THEME-SERVICE] After expansion: ${expandedThemes.length} themes`
          );

          // Apply cross-level deduplication
          if (process.env.SKIP_CROSS_LEVEL_DEDUP !== 'true') {
            console.log('[THEME-SERVICE] Running cross-level deduplication...');
            await this.hierarchicalSimilarityService.deduplicateHierarchy(
              expandedThemes
            );
          } else {
            console.log(
              '[THEME-SERVICE] Skipping cross-level deduplication (SKIP_CROSS_LEVEL_DEDUP=true)'
            );
          }

          // Update consolidated themes with expanded and deduplicated results
          consolidatedThemes = expandedThemes; // For now, use expanded themes directly
          console.log(
            `[DEBUG-THEME-SERVICE] Final themes after processing: ${consolidatedThemes.length}`
          );

          // Calculate expansion statistics
          expansionStats = this.calculateExpansionStats(consolidatedThemes);

          console.log(
            `[THEME-SERVICE] Expansion complete: ${expansionStats.expandedThemes} themes expanded, max depth: ${expansionStats.maxDepth}`
          );
        } catch (error) {
          console.warn(
            '[THEME-SERVICE] Expansion failed, using consolidated themes:',
            error
          );
        }

        expansionTime = Date.now() - expansionStartTime;
      }

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
      analysisResult.expansionTime = expansionTime;
      analysisResult.consolidationStats = {
        mergedThemes,
        hierarchicalThemes,
        consolidationRatio,
      };
      analysisResult.expansionStats = expansionStats;

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

  private calculateExpansionStats(themes: ConsolidatedTheme[]): {
    expandedThemes: number;
    maxDepth: number;
    averageDepth: number;
    totalSubThemes: number;
  } {
    let expandedThemes = 0;
    let totalSubThemes = 0;
    let maxDepth = 0;
    let totalDepth = 0;
    let themeCount = 0;

    const calculateRecursively = (
      themeList: ConsolidatedTheme[],
      depth: number
    ): void => {
      themeList.forEach((theme) => {
        themeCount++;
        totalDepth += depth;
        maxDepth = Math.max(maxDepth, depth);

        if (theme.isExpanded || theme.consolidationMethod === 'expansion') {
          expandedThemes++;
        }

        if (theme.childThemes.length > 0) {
          totalSubThemes += theme.childThemes.length;
          calculateRecursively(theme.childThemes, depth + 1);
        }
      });
    };

    calculateRecursively(themes, 0);

    return {
      expandedThemes,
      maxDepth,
      averageDepth: themeCount > 0 ? totalDepth / themeCount : 0,
      totalSubThemes,
    };
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
            architecturalPatterns: [],
            businessDomains: [],
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
