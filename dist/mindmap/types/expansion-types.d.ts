import { ConsolidatedTheme } from './similarity-types';
/**
 * Types specifically for hierarchical theme expansion
 */
export interface HierarchyLevel {
    level: number;
    themes: ConsolidatedTheme[];
    parentLevel?: HierarchyLevel;
    childLevels: HierarchyLevel[];
}
export interface ThemeHierarchy {
    rootLevel: HierarchyLevel;
    maxDepth: number;
    totalThemes: number;
    levelCounts: Record<number, number>;
}
export interface ExpansionMetrics {
    originalThemeCount: number;
    expandedThemeCount: number;
    averageDepth: number;
    maxDepth: number;
    expansionRatio: number;
    processingTime: number;
    aiCallCount: number;
    cacheHitRate: number;
}
export interface CrossLevelSimilarity {
    theme1: ConsolidatedTheme;
    theme2: ConsolidatedTheme;
    levelDifference: number;
    similarityScore: number;
    relationshipType: 'duplicate' | 'overlap' | 'related' | 'distinct';
    action: 'merge_up' | 'merge_down' | 'merge_sibling' | 'keep_separate';
    confidence: number;
    reasoning: string;
}
export interface DeduplicationResult {
    originalCount: number;
    deduplicatedCount: number;
    mergedThemes: Array<{
        sourceIds: string[];
        targetTheme: ConsolidatedTheme;
        mergeReason: string;
    }>;
    duplicatesRemoved: number;
    overlapsResolved: number;
}
export interface BusinessPattern {
    id: string;
    name: string;
    description: string;
    category: 'user_flow' | 'business_logic' | 'data_processing' | 'integration' | 'validation' | 'workflow';
    confidence: number;
    affectedThemes: string[];
    files: string[];
    codeIndicators: string[];
}
export interface UserFlowPattern {
    id: string;
    name: string;
    description: string;
    steps: string[];
    triggers: string[];
    outcomes: string[];
    confidence: number;
    affectedThemes: string[];
    files: string[];
}
export interface ExpansionValidation {
    isValid: boolean;
    issues: string[];
    warnings: string[];
    suggestions: string[];
    themeIntegrity: {
        orphanedThemes: string[];
        circularReferences: string[];
        levelInconsistencies: string[];
    };
    fileConsistency: {
        missingFiles: string[];
        fileConflicts: string[];
        scopeOverlaps: string[];
    };
}
