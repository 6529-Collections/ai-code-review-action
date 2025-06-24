/**
 * Fallback analysis methods for when AI services fail
 * Provides keyword-based and heuristic analysis as backup
 */
import { ConsolidatedTheme } from '../types/similarity-types';
export interface FallbackConfig {
    enableKeywordMatching: boolean;
    enableHeuristicAnalysis: boolean;
    confidenceReduction: number;
}
export declare const DEFAULT_FALLBACK_CONFIG: FallbackConfig;
export declare class FallbackAnalysis {
    private config;
    constructor(config?: Partial<FallbackConfig>);
    /**
     * Fallback business pattern identification using keywords
     */
    identifyBusinessPatternsFallback(themeName: string, themeDescription: string, businessImpact: string, affectedFiles: string[]): string[];
    /**
     * Fallback sub-theme analysis using heuristics
     */
    analyzeSubThemesFallback(theme: ConsolidatedTheme): {
        shouldExpand: boolean;
        confidence: number;
        reasoning: string;
        businessLogicPatterns: string[];
        userFlowPatterns: string[];
        subThemes: Array<{
            name: string;
            description: string;
            businessImpact: string;
            relevantFiles: string[];
            confidence: number;
        }>;
    };
    /**
     * Fallback cross-level similarity analysis
     */
    analyzeCrossLevelSimilarityFallback(theme1: ConsolidatedTheme, theme2: ConsolidatedTheme, levelDifference: number): {
        similarityScore: number;
        relationshipType: 'duplicate' | 'overlap' | 'related' | 'distinct';
        action: 'merge_up' | 'merge_down' | 'merge_sibling' | 'keep_separate';
        confidence: number;
        reasoning: string;
    };
    private matchesKeywords;
    private extractUserFlowPatterns;
    private generateSimpleSubThemes;
    private groupFilesByPattern;
    private generateSubThemeName;
    private calculateStringSimilarity;
    private levenshteinDistance;
    private calculateFileOverlap;
}
