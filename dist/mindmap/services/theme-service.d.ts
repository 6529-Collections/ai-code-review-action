import { ConsolidationConfig } from '../types/similarity-types';
import { ThemeAnalysisResult } from '@/shared/types/theme-types';
export declare class ThemeService {
    private readonly anthropicApiKey;
    private similarityService;
    private expansionService;
    private hierarchicalSimilarityService;
    private expansionEnabled;
    constructor(anthropicApiKey: string, consolidationConfig?: Partial<ConsolidationConfig>);
    analyzeThemesWithEnhancedContext(gitService: import('@/shared/interfaces/git-service-interface').IGitService): Promise<ThemeAnalysisResult>;
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
