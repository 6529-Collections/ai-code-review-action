import { ConsolidatedTheme } from '../types/similarity-types';
import { CodeChange, SmartContext } from '../utils/ai-code-analyzer';
export interface ExpansionConfig {
    maxDepth: number;
    minComplexityScore: number;
    minFilesForExpansion: number;
    businessImpactThreshold: number;
    concurrencyLimit: number;
    maxRetries: number;
    retryDelay: number;
    retryBackoffMultiplier: number;
    enableProgressLogging: boolean;
    dynamicConcurrency: boolean;
    enableJitter: boolean;
}
export declare const DEFAULT_EXPANSION_CONFIG: ExpansionConfig;
export interface ExpansionCandidate {
    theme: ConsolidatedTheme;
    parentTheme?: ConsolidatedTheme;
    expansionReason: string;
    complexityScore: number;
    businessPatterns: string[];
}
export interface SubThemeAnalysis {
    subThemes: ConsolidatedTheme[];
    shouldExpand: boolean;
    confidence: number;
    reasoning: string;
    businessLogicPatterns: string[];
    userFlowPatterns: string[];
}
export interface ExpansionRequest {
    id: string;
    theme: ConsolidatedTheme;
    parentTheme?: ConsolidatedTheme;
    depth: number;
    context: ExpansionContext;
}
export interface ExpansionContext {
    relevantFiles: string[];
    codeChanges: CodeChange[];
    smartContext: SmartContext;
    businessScope: string;
    parentBusinessLogic?: string;
}
export interface ExpansionResult {
    requestId: string;
    success: boolean;
    expandedTheme?: ConsolidatedTheme;
    subThemes: ConsolidatedTheme[];
    error?: string;
    processingTime: number;
}
export declare class ThemeExpansionService {
    private claudeClient;
    private cache;
    private config;
    constructor(anthropicApiKey: string, config?: Partial<ExpansionConfig>);
    /**
     * Process items concurrently with limit and retry logic
     */
    private processConcurrentlyWithLimit;
    /**
     * Main entry point for expanding themes hierarchically
     */
    expandThemesHierarchically(consolidatedThemes: ConsolidatedTheme[]): Promise<ConsolidatedTheme[]>;
    /**
     * Recursively expand a theme to maximum depth
     */
    private expandThemeRecursively;
    /**
     * Evaluate if a theme is a candidate for expansion
     */
    private evaluateExpansionCandidate;
    /**
     * Calculate complexity score for expansion candidacy
     */
    private calculateComplexityScore;
    /**
     * Deduplicate sub-themes using AI to identify duplicates
     */
    private deduplicateSubThemes;
    /**
     * Run a second pass to catch duplicates that were in different batches
     */
    private runSecondPassDeduplication;
    /**
     * Process a batch of themes for deduplication
     */
    private deduplicateBatch;
    /**
     * Merge duplicate sub-themes into a single theme
     */
    private mergeSubThemes;
    /**
     * Calculate optimal batch size based on total theme count
     */
    private calculateOptimalBatchSize;
    /**
     * Identify distinct business patterns within a theme
     */
    private identifyBusinessPatterns;
    /**
     * Build expansion context for AI analysis
     */
    private buildExpansionContext;
    /**
     * Process a single expansion request
     */
    private processExpansionRequest;
    /**
     * Analyze theme for potential sub-themes using AI
     */
    private analyzeThemeForSubThemes;
}
