import { ConsolidatedTheme } from '../types/similarity-types';
import { ExpansionDecision } from './ai-expansion-decision-service';
export interface ExpansionConfig {
    maxDepth: number;
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
    expansionDecision: ExpansionDecision;
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
    context: ExpansionCandidate;
}
export interface ExpansionResult {
    requestId: string;
    success: boolean;
    expandedTheme?: ConsolidatedTheme;
    subThemes: ConsolidatedTheme[];
    error?: string;
    processingTime: number;
}
/**
 * Effectiveness tracking for theme expansion
 */
export interface ExpansionEffectiveness {
    themesEvaluated: number;
    themesExpanded: number;
    expansionRate: number;
    processingTime: number;
    aiCallsUsed: number;
    maxDepthReached: number;
    atomicThemesIdentified: number;
}
export interface ExpansionStopReason {
    themeId: string;
    themeName: string;
    depth: number;
    reason: 'atomic' | 'ai-decision' | 'max-depth' | 'error';
    details: string;
    fileCount: number;
    lineCount: number;
}
export declare class ThemeExpansionService {
    private claudeClient;
    private cache;
    private config;
    private aiDecisionService;
    private effectiveness;
    private expansionStopReasons;
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
     * Evaluate if a theme is a candidate for expansion using AI-driven decisions
     */
    private evaluateExpansionCandidate;
    /**
     * Re-evaluate merged themes for potential expansion after deduplication
     * PRD: Ensure merged themes still follow atomic guidelines
     */
    private reEvaluateMergedThemes;
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
     * Process a single expansion request
     */
    private processExpansionRequest;
    /**
     * Analyze theme for potential sub-themes using expansion decision
     */
    private analyzeThemeForSubThemes;
    /**
     * Convert suggested sub-themes to ConsolidatedTheme objects
     */
    private convertSuggestedToConsolidatedThemes;
    /**
     * Get effectiveness metrics for this expansion analysis
     */
    getEffectiveness(): ExpansionEffectiveness;
    /**
     * Reset effectiveness metrics
     */
    resetEffectiveness(): void;
}
