import { NodeContext } from './node-context-builder';
import { DiffAnalysis } from './git-diff-analyzer';
/**
 * Structured prompt templates that use complete node context
 * Implements PRD: "Prompts use full node context for accurate decisions"
 */
export declare class StructuredPromptTemplates {
    /**
     * Create expansion decision prompt with full context
     */
    createExpansionPrompt(nodeContext: NodeContext, currentDepth: number): string;
    /**
     * Create theme naming prompt with full context
     */
    createNamingPrompt(nodeContext: NodeContext, diffAnalysis: DiffAnalysis): string;
    /**
     * Create similarity analysis prompt with context
     */
    createSimilarityPrompt(theme1Context: NodeContext, theme2Context: NodeContext): string;
    /**
     * Create consolidation prompt with contexts
     */
    createConsolidationPrompt(contexts: NodeContext[]): string;
    /**
     * Create test generation prompt with context
     */
    createTestPrompt(nodeContext: NodeContext): string;
    /**
     * Format business context section
     */
    private formatBusinessContext;
    /**
     * Format technical context section
     */
    private formatTechnicalContext;
    /**
     * Format file context section
     */
    private formatFileContext;
    /**
     * Format method context section
     */
    private formatMethodContext;
    /**
     * Format brief theme context
     */
    private formatThemeContextBrief;
    /**
     * Format diff summary
     */
    private formatDiffSummary;
    /**
     * Create prompt for code quality assessment
     */
    createQualityPrompt(nodeContext: NodeContext, codeSnippets: string[]): string;
    /**
     * Create prompt for business impact analysis
     */
    createImpactPrompt(nodeContext: NodeContext, relatedContexts: NodeContext[]): string;
}
export declare function getStructuredPromptTemplates(): StructuredPromptTemplates;
