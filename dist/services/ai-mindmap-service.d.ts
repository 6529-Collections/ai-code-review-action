import { MindmapNode, SemanticDiff, ExpansionDecision, CodeDiff } from '../types/mindmap-types';
/**
 * AI service for mindmap generation with PRD-aligned prompts
 * Creates self-contained nodes with natural depth detection
 */
export declare class AIMindmapService {
    private claudeClient;
    constructor(anthropicApiKey: string);
    /**
     * Determine if a node should be expanded with direct code assignment
     * PRD: "AI decides when further decomposition is needed"
     */
    shouldExpandNode(node: MindmapNode, currentDepth: number): Promise<ExpansionDecision>;
    /**
     * Build prompt for direct code assignment (PRD aligned)
     * AI sees complete code and assigns it directly to children
     */
    private buildDirectAssignmentPrompt;
    /**
     * Format complete code diff for AI analysis (no truncation)
     * AI needs to see ALL code to make proper assignments
     */
    private formatCompleteCodeDiff;
    /**
     * Validate direct code assignments from AI
     */
    private validateDirectAssignments;
    /**
     * Generate initial theme suggestions from semantic diff
     * Used at the root level to identify major themes
     */
    generateRootThemes(semanticDiff: SemanticDiff): Promise<ThemeSuggestion[]>;
    /**
     * Build prompt for root theme generation
     */
    private buildRootThemePrompt;
    /**
     * Group files by type for summary
     */
    private groupFilesByType;
    /**
     * Calculate total lines changed
     */
    private calculateTotalLines;
    /**
     * Summarize semantic changes for prompt
     */
    private summarizeSemanticChanges;
    /**
     * Validate theme suggestions
     */
    private validateThemeSuggestions;
    /**
     * Trim text to word limit
     */
    private trimToLimit;
    /**
     * Generate contextual explanation for code in a specific theme
     * PRD: "Same code shown differently based on usage context"
     */
    generateContextualExplanation(code: CodeDiff, viewingNode: MindmapNode): Promise<string>;
}
interface ThemeSuggestion {
    name: string;
    businessValue: string;
    description: string;
    affectedFiles: string[];
    confidence: number;
}
export {};
