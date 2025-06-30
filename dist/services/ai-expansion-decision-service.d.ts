import { ConsolidatedTheme } from '../types/similarity-types';
/**
 * Simplified AI-driven expansion decision service
 * Implements PRD vision: "AI decides when further decomposition is needed"
 */
export declare class AIExpansionDecisionService {
    private claudeClient;
    private decisionCache;
    constructor(anthropicApiKey: string);
    /**
     * Main decision point: Should this theme be expanded?
     * Trusts AI to understand complexity from context, not metrics
     */
    shouldExpandTheme(theme: ConsolidatedTheme, currentDepth: number, parentTheme?: ConsolidatedTheme, siblingThemes?: ConsolidatedTheme[]): Promise<ExpansionDecision>;
    /**
     * Build a context-rich prompt that helps AI make natural decisions
     */
    private buildContextRichPrompt;
    /**
     * Get level-specific guidance for the AI
     */
    private getLevelSpecificGuidance;
    /**
     * Format code context with actual diffs, not metrics
     */
    private formatCodeContext;
    /**
     * Analyze file structure to provide architectural context
     */
    private analyzeFileStructure;
    /**
     * Categorize file by its apparent purpose
     */
    private categorizeFile;
    /**
     * Format parent and sibling context to prevent duplication
     */
    private formatHierarchyContext;
    /**
     * Simple check for obviously atomic changes
     */
    private isObviouslyAtomic;
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
    suggestedSubThemes: Array<{
        name: string;
        description: string;
        files: string[];
        rationale: string;
    }> | null;
}
