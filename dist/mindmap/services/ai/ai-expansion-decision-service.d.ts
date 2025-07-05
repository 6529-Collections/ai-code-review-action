import { ConsolidatedTheme } from '../../types/similarity-types';
/**
 * Simplified AI-driven expansion decision service
 * Implements PRD vision: "AI decides when further decomposition is needed"
 */
export declare class AIExpansionDecisionService {
    private claudeClient;
    private decisionCache;
    private codeAnalyzer;
    private promptBuilder;
    constructor(anthropicApiKey: string);
    /**
     * Main decision point: Should this theme be expanded?
     * Uses intelligent code analysis and dynamic prompting for optimal decisions
     */
    shouldExpandTheme(theme: ConsolidatedTheme, currentDepth: number, parentTheme?: ConsolidatedTheme, siblingThemes?: ConsolidatedTheme[]): Promise<ExpansionDecision>;
    /**
     * Generate a simple hash for theme analysis caching
     */
    private getAnalysisHash;
    /**
     * Get AI decision from Claude
     */
    private getAIDecision;
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
