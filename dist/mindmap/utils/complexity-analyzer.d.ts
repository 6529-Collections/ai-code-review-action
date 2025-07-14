/**
 * AI-driven complexity analysis for theme naming strategy
 * Replaces algorithmic pattern matching with Claude AI analysis
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
    private static claudeClient;
    /**
     * Initialize with API key for AI analysis
     */
    static initialize(anthropicApiKey: string): void;
    /**
     * AI-driven analysis of code change complexity
     */
    static analyzeChangeComplexity(codeChanges: string, filePath: string, contextSummary?: string): Promise<ComplexityAnalysis>;
    /**
     * AI-driven comprehensive complexity profile generation
     */
    static generateComplexityProfile(themeCount: number, affectedFiles: string[], themeName?: string, themeDescription?: string, codeChanges?: string, contextSummary?: string): Promise<ChangeComplexityProfile>;
    /**
     * AI-driven pattern examples generation
     */
    static getPatternExamples(detectedPatterns: string[]): Promise<string[]>;
}
