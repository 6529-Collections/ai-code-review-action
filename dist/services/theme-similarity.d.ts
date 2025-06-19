import { Theme } from './theme-service';
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
    consolidationMethod: 'merge' | 'hierarchy' | 'single';
}
export interface ConsolidationConfig {
    similarityThreshold: number;
    maxThemesPerParent: number;
    minThemesForParent: number;
    confidenceWeight: number;
    businessDomainWeight: number;
}
export interface MergeDecision {
    action: 'merge' | 'group_under_parent' | 'keep_separate';
    confidence: number;
    reason: string;
    targetThemeId?: string;
}
export declare class ThemeSimilarityService {
    private config;
    constructor(config?: Partial<ConsolidationConfig>);
    calculateSimilarity(theme1: Theme, theme2: Theme): SimilarityMetrics;
    shouldMerge(similarity: SimilarityMetrics): MergeDecision;
    consolidateThemes(themes: Theme[]): ConsolidatedTheme[];
    private findMergeGroups;
    private createConsolidatedThemes;
    private buildHierarchies;
    private groupByBusinessDomain;
    private extractBusinessDomain;
    private createParentTheme;
    private themeToConsolidated;
    private mergeThemes;
    private calculateNameSimilarity;
    private calculateDescriptionSimilarity;
    private calculateFileOverlap;
    private calculatePatternSimilarity;
    private calculateBusinessSimilarity;
    private extractPatterns;
    private extractBusinessKeywords;
}
