import { ConsolidatedTheme } from '../types/similarity-types';
import { CrossLevelSimilarity } from '../types/expansion-types';
/**
 * Effectiveness tracking for hierarchical similarity analysis
 */
export interface HierarchicalEffectiveness {
    crossLevelComparisonsGenerated: number;
    duplicatesFound: number;
    overlapsResolved: number;
    processingTime: number;
    aiCallsUsed: number;
    filteringReduction: number;
}
/**
 * Enhanced similarity service for multi-level theme hierarchies
 * Handles cross-level duplicate detection and hierarchy optimization
 */
export declare class HierarchicalSimilarityService {
    private claudeClient;
    private cache;
    private effectiveness;
    constructor(anthropicApiKey: string);
    /**
     * Analyze similarity across multiple hierarchy levels
     * Identifies potential duplicates, overlaps, and optimization opportunities
     */
    analyzeCrossLevelSimilarity(hierarchy: ConsolidatedTheme[]): Promise<CrossLevelSimilarity[]>;
    /**
     * Validate hierarchy integrity after expansion
     */
    validateHierarchyIntegrity(hierarchy: ConsolidatedTheme[]): boolean;
    private flattenHierarchy;
    private shouldCompareThemes;
    /**
     * Calculate file overlap between two themes
     * Returns ratio 0.0-1.0 of overlapping files
     */
    private calculateFileOverlap;
    /**
     * Calculate name similarity using simple token matching
     * Returns ratio 0.0-1.0 of similarity
     */
    private calculateNameSimilarity;
    /**
     * Check if themes belong to clearly different business domains
     * Uses heuristic domain detection from descriptions
     */
    private areDifferentBusinessDomains;
    /**
     * Simple domain inference from theme content
     */
    private inferBusinessDomain;
    /**
     * Check if themes have severe size mismatch (one much larger than other)
     */
    private hasSevereSizeMismatch;
    /**
     * Check if themes have incompatible change types
     */
    private hasIncompatibleChangeTypes;
    /**
     * Simple change type inference
     */
    private inferChangeType;
    private analyzeCrossLevelSimilarityPair;
    private mergeThemes;
    private hasCircularReference;
    /**
     * Get effectiveness metrics for this hierarchical analysis
     */
    getEffectiveness(): HierarchicalEffectiveness;
    /**
     * Reset effectiveness metrics
     */
    resetEffectiveness(): void;
}
