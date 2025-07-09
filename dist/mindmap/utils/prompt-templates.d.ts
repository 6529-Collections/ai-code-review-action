/**
 * Standardized prompt templates for consistent Claude AI responses
 */
export interface PromptConfig {
    instruction: string;
    jsonSchema: string;
    examples?: string[];
    constraints?: string[];
}
export declare class PromptTemplates {
    /**
     * Create a standardized JSON-only prompt
     */
    static createJsonPrompt(config: PromptConfig): string;
    /**
     * Template for business pattern identification
     */
    static createBusinessPatternPrompt(themeName: string, themeDescription: string, businessImpact: string, affectedFiles: string[]): string;
    /**
     * Template for sub-theme analysis
     */
    static createSubThemeAnalysisPrompt(themeName: string, themeDescription: string, businessImpact: string, level: number, affectedFiles: string[], parentContext?: string): string;
    /**
     * Template for theme naming
     */
    static createThemeNamingPrompt(description: string, businessImpact: string, codeSnippets: string[]): string;
}
