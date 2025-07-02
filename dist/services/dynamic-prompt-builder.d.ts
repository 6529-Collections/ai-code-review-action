import { ConsolidatedTheme } from '../types/similarity-types';
import { CodeStructureAnalysis, ChangeType } from './code-structure-analyzer';
/**
 * Builds dynamic, context-aware prompts for AI expansion decisions
 */
export declare class DynamicPromptBuilder {
    private expansionExamples;
    constructor();
    /**
     * Build a context-rich prompt for expansion decisions
     */
    buildExpansionPrompt(theme: ConsolidatedTheme, currentDepth: number, codeAnalysis: CodeStructureAnalysis, parentTheme?: ConsolidatedTheme, siblingThemes?: ConsolidatedTheme[]): string;
    /**
     * Build context section with theme information
     */
    private buildContextSection;
    /**
     * Build analysis section with code structure insights
     */
    private buildAnalysisSection;
    /**
     * Build dynamic guidance based on depth and complexity
     */
    private buildGuidanceSection;
    /**
     * Build examples section with relevant expansion patterns
     */
    private buildExamplesSection;
    /**
     * Build decision section with specific questions
     */
    private buildDecisionSection;
    /**
     * Format code context for AI analysis
     */
    private formatCodeContext;
    /**
     * Format complexity indicators for display
     */
    private formatComplexityIndicators;
    /**
     * Identify what has been achieved at current depth
     */
    private identifyAchievements;
    /**
     * Identify next goals based on current state
     */
    private identifyNextGoals;
    /**
     * Generate context-specific decision questions
     */
    private generateDecisionQuestions;
    /**
     * Select relevant examples based on code patterns
     */
    private selectRelevantExamples;
    /**
     * Check if an example is relevant to current analysis
     */
    private isExampleRelevant;
    /**
     * Initialize example expansion patterns
     */
    private initializeExamples;
}
/**
 * Example of successful theme expansion
 */
export interface ExpansionExample {
    themeName: string;
    pattern: string;
    changeTypes: ChangeType[];
    hasConditionals: boolean;
    hasMultipleFunctions: boolean;
    hasMultipleFiles: boolean;
    subThemes: Array<{
        name: string;
        description: string;
    }>;
    reasoning: string;
}
