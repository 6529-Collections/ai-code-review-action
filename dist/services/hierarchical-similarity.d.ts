import { ConsolidatedTheme } from '../types/similarity-types';
import { CrossLevelSimilarity, DeduplicationResult } from '../types/expansion-types';
/**
 * Enhanced similarity service for multi-level theme hierarchies
 * Handles cross-level duplicate detection and hierarchy optimization
 */
export declare class HierarchicalSimilarityService {
    private claudeClient;
    private cache;
    constructor(anthropicApiKey: string);
    /**
     * Analyze similarity across multiple hierarchy levels
     * Identifies potential duplicates, overlaps, and optimization opportunities
     */
    analyzeCrossLevelSimilarity(hierarchy: ConsolidatedTheme[]): Promise<CrossLevelSimilarity[]>;
    /**
     * Deduplicate themes across hierarchy levels
     */
    deduplicateHierarchy(hierarchy: ConsolidatedTheme[]): Promise<DeduplicationResult>;
    /**
     * Validate hierarchy integrity after expansion
     */
    validateHierarchyIntegrity(hierarchy: ConsolidatedTheme[]): boolean;
    private flattenHierarchy;
    private shouldCompareThemes;
    private analyzeCrossLevelSimilarityPair;
    private mergeThemes;
    private countThemes;
    private applyMerges;
    private hasCircularReference;
}
