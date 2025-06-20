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
export interface BatchSimilarityResult {
    pairId: string;
    similarity: AISimilarityResult;
    error?: string;
}
export declare class ThemeSimilarityService {
    private config;
    private anthropicApiKey;
    private similarityCache;
    private cacheExpireMinutes;
    private batchSize;
    private batchFailures;
    constructor(anthropicApiKey: string, config?: Partial<ConsolidationConfig>);
    calculateSimilarity(theme1: Theme, theme2: Theme): Promise<SimilarityMetrics>;
    private getCacheKey;
    private getCachedSimilarity;
    private cacheSimilarity;
    private quickSimilarityCheck;
    private hasDifferentFileTypes;
    private chunkArray;
    private processBatchSimilarity;
    private buildBatchSimilarityPrompt;
    private parseBatchSimilarityResponse;
    private clampScore;
    private aiSimilarityToMetrics;
    private calculateAISimilarity;
    private buildSimilarityPrompt;
    private parseAISimilarityResponse;
    private createFallbackSimilarity;
    shouldMerge(similarity: SimilarityMetrics): MergeDecision;
    consolidateThemes(themes: Theme[]): Promise<ConsolidatedTheme[]>;
    private findMergeGroups;
    private calculateBatchSimilarities;
    private buildMergeGroupsFromSimilarities;
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
