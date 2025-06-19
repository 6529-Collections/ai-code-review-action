import { ChangedFile } from './git-service';
import * as exec from '@actions/exec';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  ThemeSimilarityService,
  ConsolidatedTheme,
  ConsolidationConfig,
} from './theme-similarity';

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
    let error: string | undefined;

    try {
      // Use a temporary file approach instead of echo to avoid shell escaping issues
      const tempFile = path.join(
        os.tmpdir(),
        `claude-prompt-${Date.now()}.txt`
      );
      fs.writeFileSync(tempFile, prompt);

      await exec.exec('bash', ['-c', `cat "${tempFile}" | claude`], {
        listeners: {
          stdout: (data: Buffer) => {
            output += data.toString();
          },
        },
      });

      // Clean up temp file
      fs.unlinkSync(tempFile);

      const result = this.parseClaudeResponse(output);

      return result;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      console.warn('Claude analysis failed, using fallback:', error);

      const fallback = this.createFallbackAnalysis(chunk);

      return fallback;
    }
  }

  private buildAnalysisPrompt(chunk: CodeChunk, context: string): string {
    // Limit content length to avoid overwhelming Claude
    const maxContentLength = 2000;
    const truncatedContent =
      chunk.content.length > maxContentLength
        ? chunk.content.substring(0, maxContentLength) + '\n... (truncated)'
        : chunk.content;

    return `${context}

Analyze this code change in file: ${chunk.filename}

Code changes:
${truncatedContent}

Please provide analysis in this exact JSON format (no other text):
{
  "themeName": "brief name for what this change does",
  "description": "explanation of the change purpose",
  "businessImpact": "what business functionality this affects",
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

export class ThemeService {
  private similarityService: ThemeSimilarityService;

  constructor(
    private readonly anthropicApiKey: string,
    consolidationConfig?: Partial<ConsolidationConfig>
  ) {
    this.similarityService = new ThemeSimilarityService(consolidationConfig);
  }

  async analyzeThemes(
    changedFiles: ChangedFile[]
  ): Promise<ThemeAnalysisResult> {
    const startTime = Date.now();

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

      for (const chunk of chunks) {
        await contextManager.processChunk(chunk);
      }

      contextManager.setProcessingState('complete');

      const originalThemes = contextManager.getRootThemes();
      const consolidationStartTime = Date.now();

      // Apply theme consolidation
      const consolidatedThemes =
        this.similarityService.consolidateThemes(originalThemes);
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
        lastAnalysis: new Date(),
      },
    ];
  }
}
