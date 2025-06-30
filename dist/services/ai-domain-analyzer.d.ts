import { AIDomainClassification, AIAnalysisContext, SemanticDiff } from '../types/mindmap-types';
/**
 * AI-driven business domain analyzer
 * Replaces mechanical keyword matching with semantic understanding
 * PRD: "AI decides" domain classification based on actual business impact
 */
export declare class AIDomainAnalyzer {
    private claudeClient;
    constructor(anthropicApiKey: string);
    /**
     * Classify business domain using AI semantic understanding
     * PRD: Root level represents "distinct user flow, story, or business capability"
     */
    classifyBusinessDomain(context: AIAnalysisContext, semanticDiff?: SemanticDiff): Promise<AIDomainClassification>;
    /**
     * Build AI prompt for business domain classification
     * PRD: "Structure emerges from code, not forced into preset levels"
     */
    private buildDomainClassificationPrompt;
    /**
     * Format semantic diff context for additional insight
     */
    private formatSemanticDiffContext;
    /**
     * Validate and normalize AI domain classification response
     */
    private validateDomainClassification;
    /**
     * Create fallback domain when AI analysis fails
     * PRD: "Graceful degradation - never fail completely"
     */
    private createFallbackDomain;
    /**
     * Analyze multiple changes for domain grouping
     * PRD: "Intelligent cross-referencing" and domain relationships
     */
    analyzeMultiDomainChanges(contexts: AIAnalysisContext[]): Promise<{
        primaryDomains: AIDomainClassification[];
        crossCuttingDomains: AIDomainClassification[];
        domainRelationships: Array<{
            domain1: string;
            domain2: string;
            relationship: string;
            strength: number;
        }>;
    }>;
    /**
     * Build prompt for multi-domain analysis
     */
    private buildMultiDomainAnalysisPrompt;
    /**
     * Trim text to word limit
     */
    private trimToWordLimit;
}
