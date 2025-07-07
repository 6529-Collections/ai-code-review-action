import { ConsolidatedTheme } from '../../types/similarity-types';
import { MultiStageConfig } from '../../types/multi-stage-types';
/**
 * Multi-stage AI-driven expansion decision service
 * Uses unopinionated analysis followed by validation for better decisions
 */
export declare class AIExpansionDecisionService {
    private claudeClient;
    private decisionCache;
    private codeAnalyzer;
    private analysisService;
    private validationService;
    private config;
    constructor(anthropicApiKey: string, config?: MultiStageConfig);
    /**
     * Main decision point: Should this theme be expanded?
     * Uses multi-stage analysis: unopinionated analysis → validation → final decision
     */
    shouldExpandTheme(theme: ConsolidatedTheme, currentDepth: number, parentTheme?: ConsolidatedTheme, siblingThemes?: ConsolidatedTheme[]): Promise<ExpansionDecision>;
    /**
     * Generate a simple hash for theme analysis caching
     */
    private getAnalysisHash;
    /**
     * Make quick decision for obvious cases to avoid unnecessary AI calls
     */
    private makeQuickDecision;
    /**
     * Check if validation scores are inconsistent and need consistency check
     */
    private needsConsistencyCheck;
    /**
     * Perform consistency check when validation scores are contradictory
     */
    private performConsistencyCheck;
    /**
     * Build final expansion decision from validation result
     */
    private buildDecisionFromValidation;
    /**
     * Extract sub-themes when expansion is decided
     */
    private extractSubThemes;
    /**
     * Generate default decision when all stages fail
     */
    private getDefaultDecision;
    /**
     * Clear the decision cache
     */
    clearCache(): void;
}
/**
 * Simplified expansion decision structure
 */
export interface ExpansionDecision {
    shouldExpand: boolean;
    isAtomic: boolean;
    reasoning: string;
    businessContext: string;
    technicalContext: string;
    testabilityAssessment: string;
    suggestedSubThemes: Array<{
        name: string;
        description: string;
        files: string[];
        rationale: string;
    }> | null;
}
