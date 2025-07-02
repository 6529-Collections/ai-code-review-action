import { ConsolidatedTheme } from '../types/similarity-types';
/**
 * Enhanced AI expansion decision service with circuit breaker and accurate metrics
 */
export declare class EnhancedAIExpansionDecisionService {
    private claudeClient;
    private circuitBreaker;
    private codeAnalyzer;
    private gitDiffAnalyzer;
    private decisionCache;
    constructor(anthropicApiKey: string);
    /**
     * Decide if theme should expand with circuit breaker protection
     */
    shouldExpandTheme(theme: ConsolidatedTheme, currentDepth: number, diffContent?: string, parentTheme?: ConsolidatedTheme, siblingThemes?: ConsolidatedTheme[]): Promise<ExpansionDecision>;
    /**
     * Build enhanced prompt with actual code metrics
     */
    private buildEnhancedPrompt;
    /**
     * Get AI decision with structured response
     */
    private getAIDecision;
    /**
     * Apply hard rules that override AI decisions
     */
    private applyHardRules;
    /**
     * Create decision based on metrics when AI unavailable
     */
    private createMetricsBasedDecision;
    /**
     * Create fallback decision when analysis fails
     */
    private createFallbackDecision;
    /**
     * Calculate complexity score for circuit breaker
     */
    private calculateComplexityScore;
    /**
     * Generate cache key
     */
    private getCacheKey;
}
/**
 * Expansion decision result
 */
export interface ExpansionDecision {
    shouldExpand: boolean;
    isAtomic: boolean;
    reasoning: string;
    confidence: number;
    businessContext: string;
    technicalContext: string;
    testabilityAssessment: string;
    suggestedSubThemes: Array<{
        name: string;
        files: string[];
        rationale: string;
    }> | null;
}
