import { Theme } from './theme-service';
import { SimilarityMetrics, ConsolidatedTheme, ConsolidationConfig } from '../types/similarity-types';
export declare class ThemeSimilarityService {
    private config;
    private similarityCache;
    private similarityCalculator;
    private aiSimilarityService;
    private batchProcessor;
    private businessDomainService;
    private themeNamingService;
    private pendingCalculations;
    constructor(anthropicApiKey: string, config?: Partial<ConsolidationConfig>);
    calculateSimilarity(theme1: Theme, theme2: Theme): Promise<SimilarityMetrics>;
    private doCalculateSimilarity;
    consolidateThemes(themes: Theme[]): Promise<ConsolidatedTheme[]>;
    private findMergeGroups;
    private calculateBatchSimilarities;
    private buildMergeGroupsFromSimilarities;
    private createConsolidatedThemes;
    private buildHierarchies;
    private themeToConsolidated;
    private mergeThemes;
}
