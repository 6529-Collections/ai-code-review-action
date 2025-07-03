import { ConsolidatedTheme, ConsolidationConfig } from '../types/similarity-types';
import { CodeChange, SmartContext } from '../utils/ai-code-analyzer';
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
    enhancedContext: SmartContext;
    codeChanges: CodeChange[];
    lastAnalysis: Date;
    detailedDescription?: string;
    technicalSummary?: string;
    keyChanges?: string[];
    userScenario?: string;
    mainFunctionsChanged?: string[];
    mainClassesChanged?: string[];
    codeMetrics?: {
        linesAdded: number;
        linesRemoved: number;
        filesChanged: number;
    };
    codeExamples?: Array<{
        file: string;
        description: string;
        snippet: string;
    }>;
    isAtomic?: boolean;
    expansionReason?: string;
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
export declare class ThemeService {
    private readonly anthropicApiKey;
    private similarityService;
    private expansionService;
    private hierarchicalSimilarityService;
    private expansionEnabled;
    constructor(anthropicApiKey: string, consolidationConfig?: Partial<ConsolidationConfig>);
    analyzeThemesWithEnhancedContext(gitService: import('./git-service').GitService): Promise<ThemeAnalysisResult>;
    private calculateExpansionStats;
    private createFallbackThemes;
    /**
     * Pipeline optimization: Identify expansion candidates in parallel with consolidation
     * PRD: "Progressive rendering of deep trees" and "Lazy expansion for large PRs"
     */
    private identifyExpansionCandidates;
    /**
     * Quick heuristic to determine if a theme should be considered for expansion
     * This is much faster than full AI analysis
     */
    private shouldConsiderForExpansion;
    /**
     * Check if theme has multiple aspects that could be separated
     */
    private hasMultipleAspects;
    /**
     * Get effectiveness metrics from similarity service
     */
    getSimilarityEffectiveness(): unknown;
    /**
     * Get effectiveness metrics from expansion service
     */
    getExpansionEffectiveness(): unknown;
    /**
     * Get effectiveness metrics from hierarchical similarity service
     */
    getHierarchicalEffectiveness(): unknown;
}
