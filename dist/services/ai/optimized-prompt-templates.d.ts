import { PromptTemplates } from '../../utils/prompt-templates';
import { PromptType } from './prompt-types';
/**
 * Optimized prompt templates with reduced token usage and improved consistency
 */
export declare class OptimizedPromptTemplates extends PromptTemplates {
    private static readonly SHARED_CONTEXT;
    private static readonly SHARED_EXAMPLES;
    /**
     * Get optimized prompt template by type
     */
    getOptimizedTemplate(promptType: PromptType): string;
    private getCodeAnalysisPrompt;
    private getThemeExtractionPrompt;
    private getSimilarityCheckPrompt;
    private getThemeExpansionPrompt;
    private getDomainExtractionPrompt;
    private getThemeNamingPrompt;
    private getBatchSimilarityPrompt;
    private getCrossLevelSimilarityPrompt;
    /**
     * Dynamic context trimming to stay within token limits
     */
    trimContext(context: string, maxTokens: number, preserveKeys?: string[]): string;
    /**
     * Select most relevant examples based on context
     */
    selectExamples(promptType: PromptType, context: Record<string, any>, maxExamples?: number): string[];
    /**
     * Optimize file content for prompts
     */
    optimizeFileContent(content: string, focusAreas?: string[]): string;
    /**
     * Create a token-efficient prompt
     */
    createEfficientPrompt(template: string, variables: Record<string, any>, maxTokens?: number): string;
}
