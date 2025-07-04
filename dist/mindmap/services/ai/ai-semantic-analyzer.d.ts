import { AISemanticAnalysis, AIFileContext, AIAnalysisContext } from '../../types/mindmap-types';
/**
 * AI-driven semantic change analyzer
 * Replaces regex pattern matching with contextual understanding
 * PRD: "AI decides" semantic meaning based on actual code impact
 */
export declare class AISemanticAnalyzer {
    private claudeClient;
    constructor(anthropicApiKey: string);
    /**
     * Analyze semantic nature and impact of code changes
     * PRD: "Natural organization" based on actual change semantics
     */
    analyzeSemanticChange(context: AIAnalysisContext): Promise<AISemanticAnalysis>;
    /**
     * Build AI prompt for semantic change analysis
     * PRD: "Context completeness" - provide full context for understanding
     */
    private buildSemanticAnalysisPrompt;
    /**
     * Get language-specific context for better analysis
     */
    private getLanguageContext;
    /**
     * Validate and normalize AI semantic analysis response
     */
    private validateSemanticAnalysis;
    /**
     * Create fallback analysis when AI fails
     * PRD: "Graceful degradation - always provide meaningful output"
     */
    private createFallbackAnalysis;
    /**
     * Analyze file purpose from content using AI
     * PRD: "File type intelligence" - understand actual purpose, not just extension
     */
    analyzeFilePurpose(filePath: string, content: string, context?: string): Promise<AIFileContext>;
    /**
     * Build prompt for file purpose analysis
     */
    private buildFilePurposePrompt;
    /**
     * Create AI file context from analysis result
     */
    private createAIFileContext;
    /**
     * Create fallback file context when AI analysis fails
     */
    private createFallbackFileContext;
    /**
     * Analyze related changes across multiple files
     * PRD: "Cross-file relationships and patterns"
     */
    analyzeRelatedChanges(contexts: AIAnalysisContext[]): Promise<{
        clusters: Array<{
            theme: string;
            changes: number[];
            relationship: string;
            confidence: number;
        }>;
        crossCuttingConcerns: Array<{
            concern: string;
            affectedChanges: number[];
            impact: string;
        }>;
    }>;
    /**
     * Build prompt for related changes analysis
     */
    private buildRelatedChangesPrompt;
    /**
     * Trim text to word limit
     */
    private trimToWordLimit;
}
