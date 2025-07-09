import { Theme } from '@/shared/types/theme-types';
export interface AISimilarityResult {
    nameScore: number;
    descriptionScore: number;
    patternScore: number;
    businessScore: number;
    semanticScore: number;
    shouldMerge: boolean;
    confidence: number;
    reasoning: string;
}
export interface SimilarityMetrics {
    nameScore: number;
    descriptionScore: number;
    fileOverlap: number;
    patternScore: number;
    businessScore: number;
    combinedScore: number;
}
export interface ConsolidatedTheme {
    id: string;
    name: string;
    description: string;
    level: number;
    parentId?: string;
    childThemes: ConsolidatedTheme[];
    affectedFiles: string[];
    confidence: number;
    businessImpact: string;
    codeSnippets: string[];
    context: string;
    lastAnalysis: Date;
    sourceThemes: string[];
    consolidationMethod: 'merge' | 'hierarchy' | 'single' | 'expansion';
    isExpanded?: boolean;
    expansionDepth?: number;
    businessLogicPatterns?: string[];
    userFlowPatterns?: string[];
    isAtomic?: boolean;
    expansionReason?: string;
    consolidationSummary?: string;
    childThemeSummaries?: string[];
    combinedTechnicalDetails?: string;
    unifiedUserImpact?: string;
    detailedDescription?: string;
    technicalSummary?: string;
    keyChanges?: string[];
    userScenario?: string;
    mainFunctionsChanged?: string[];
    mainClassesChanged?: string[];
    codeMetrics?: {
        filesChanged: number;
    };
    codeExamples?: Array<{
        file: string;
        description: string;
        snippet: string;
    }>;
}
export interface ConsolidationConfig {
    similarityThreshold: number;
    maxThemesPerParent: number;
    minThemesForParent: number;
    maxHierarchyDepth: number;
    expansionEnabled: boolean;
    crossLevelSimilarityCheck: boolean;
}
export interface MergeDecision {
    action: 'merge' | 'group_under_parent' | 'keep_separate';
    confidence: number;
    reason: string;
    targetThemeId?: string;
}
export interface CachedSimilarity {
    similarity: SimilarityMetrics;
    timestamp: Date;
}
export interface QuickSimilarityResult {
    shouldSkipAI: boolean;
    similarity?: SimilarityMetrics;
    reason: string;
}
export interface ThemePair {
    theme1: Theme;
    theme2: Theme;
    id: string;
}
