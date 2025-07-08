/**
 * Utility for analyzing code change complexity for theme naming strategy
 */
export interface ComplexityAnalysis {
    isSimpleTechnicalChange: boolean;
    isComplexBusinessFeature: boolean;
    confidence: number;
    reasoning: string;
}
export interface ChangeComplexityProfile {
    complexity: 'simple' | 'moderate' | 'complex';
    confidence: number;
    reasoning: string;
    recommendedApproach: 'technical-specific' | 'hybrid' | 'business-focused';
    detectedPatterns: string[];
}
export declare class ComplexityAnalyzer {
    /**
     * Analyze code changes and file patterns to determine complexity
     */
    static analyzeChangeComplexity(codeChanges: string, filePath: string, contextSummary?: string): ComplexityAnalysis;
    /**
     * Generate comprehensive complexity profile with recommendations
     */
    static generateComplexityProfile(themeCount: number, affectedFiles: string[], themeName?: string, themeDescription?: string, codeChanges?: string, contextSummary?: string): ChangeComplexityProfile;
    /**
     * Check for simple technical patterns
     */
    private static isSimpleTechnicalPattern;
    /**
     * Check for business feature patterns
     */
    private static hasBusinessFeaturePatterns;
    /**
     * Analyze context summary for complexity indicators
     */
    private static analyzeContextPatterns;
    /**
     * Get examples for detected complexity patterns
     */
    static getPatternExamples(detectedPatterns: string[]): string[];
}
