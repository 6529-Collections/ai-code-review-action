import { AIDomainClassification, AIAnalysisContext, SemanticDiff } from '../../types/mindmap-types';
/**
 * AI-driven business domain analyzer
 * Replaces mechanical keyword matching with semantic understanding
 * PRD: "AI decides" domain classification based on actual business impact
 */
export declare class AIDomainAnalyzer {
    private claudeClient;
    constructor(anthropicApiKey: string);
    /**
     * Classify business capability using AI semantic understanding with complexity awareness
     * PRD: Root level represents "distinct user flow, story, or business capability"
     */
    classifyBusinessDomain(context: AIAnalysisContext, semanticDiff?: SemanticDiff): Promise<AIDomainClassification>;
    /**
     * Build AI prompt for business capability classification
     * PRD: "Structure emerges from code, not forced into preset levels"
     */
    private buildDomainClassificationPrompt;
    /**
     * Format semantic diff context for additional insight
     */
    private formatSemanticDiffContext;
    /**
     * Transform business capability response to AIDomainClassification format
     */
    private transformToAIDomainClassification;
    /**
     * Validate and normalize AI domain classification response (legacy support)
     */
    private validateDomainClassification;
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
     * Generate AI-driven complexity profile for the given context
     */
    private generateComplexityProfile;
    /**
     * Build complexity-aware domain classification prompt
     */
    private buildComplexityAwareDomainClassificationPrompt;
    /**
     * Trim text to word limit
     */
    private trimToWordLimit;
}
