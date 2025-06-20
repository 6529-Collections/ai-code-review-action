import { Theme } from './theme-service';
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
    private anthropicApiKey;
    constructor(anthropicApiKey: string, config?: Partial<ConsolidationConfig>);
    calculateSimilarity(theme1: Theme, theme2: Theme): Promise<SimilarityMetrics>;
    private calculateAISimilarity;
    private buildSimilarityPrompt;
    private parseAISimilarityResponse;
    private createFallbackSimilarity;
    shouldMerge(similarity: SimilarityMetrics): MergeDecision;
    consolidateThemes(themes: Theme[]): Promise<ConsolidatedTheme[]>;
    private findMergeGroups;
    private createConsolidatedThemes;
    private buildHierarchies;
    private groupByBusinessDomain;
    private extractBusinessDomain;
    private buildDomainExtractionPrompt;
    private parseDomainExtractionResponse;
    private isValidDomainName;
    private extractBusinessDomainFallback;
    private createParentTheme;
    private generateMergedThemeNameAndDescription;
    private buildMergedThemeNamingPrompt;
    private parseMergedThemeNamingResponse;
    private isValidThemeName;
    private createFallbackMergedThemeName;
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
