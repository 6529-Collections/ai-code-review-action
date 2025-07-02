import { Theme } from './theme-service';
import { SimilarityMetrics, ConsolidatedTheme, ConsolidationConfig } from '../types/similarity-types';
/**
 * Effectiveness tracking for similarity analysis
 */
export interface SimilarityEffectiveness {
    pairsAnalyzed: number;
    mergesDecided: number;
    mergeRate: number;
    processingTime: number;
    aiCallsUsed: number;
}
export declare class ThemeSimilarityService {
    private config;
    private similarityCache;
    private similarityCalculator;
    private aiSimilarityService;
    private batchProcessor;
    private businessDomainService;
    private themeNamingService;
    private pendingCalculations;
    private effectiveness;
    constructor(anthropicApiKey: string, config?: Partial<ConsolidationConfig>);
    calculateSimilarity(theme1: Theme, theme2: Theme): Promise<SimilarityMetrics>;
    private doCalculateSimilarity;
    consolidateThemes(themes: Theme[]): Promise<ConsolidatedTheme[]>;
    /**
     * Get effectiveness metrics for this similarity analysis
     */
    getEffectiveness(): SimilarityEffectiveness;
    /**
     * Reset effectiveness metrics
     */
    resetEffectiveness(): void;
    private findMergeGroups;
    private calculateBatchSimilarities;
    private buildMergeGroupsFromSimilarities;
    private createConsolidatedThemes;
    private buildHierarchies;
    private themeToConsolidated;
    private mergeThemes;
    /**
     * Calculate optimal batch size based on total pairs and complexity
     * PRD: "Dynamic batch sizing" - adapt to content complexity
     */
    private calculateOptimalBatchSize;
    /**
     * Split pairs into optimally-sized batches for AI processing
     */
    private createPairBatches;
    /**
     * Process a batch of theme pairs with a single AI call
     * This is the key optimization - multiple pairs analyzed in one API call
     */
    private processSimilarityBatch;
    /**
     * Build optimized prompt for batch similarity analysis
     * PRD: "Structured prompts with clear sections"
     */
    private buildBatchSimilarityPrompt;
    /**
     * Parse batch AI response into individual similarity metrics
     */
    private parseBatchSimilarityResponse;
    /**
     * Fallback to individual processing if batch fails
     */
    private processBatchIndividually;
    /**
     * Convert AI similarity result to SimilarityMetrics
     */
    private convertAIResultToMetrics;
}
