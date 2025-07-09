/**
 * Business-first prompt templates for transforming technical code analysis
 * into business-oriented themes aligned with PRD requirements
 */
import { PromptTemplates } from './prompt-templates';
export interface BusinessCapabilityConfig {
    userCapability: string;
    businessValue: string;
    businessProcess: string;
    userScenarios: string[];
    technicalScope: string;
}
export interface ProgressiveLanguageConfig {
    level: number;
    maxWords: number;
    audienceFocus: 'executive' | 'product-manager' | 'technical-product' | 'developer';
    allowedTerms: string[];
    forbiddenTerms: string[];
}
export interface NamingStrategy {
    changeComplexity: 'simple' | 'moderate' | 'complex';
    namingApproach: 'technical-specific' | 'hybrid' | 'business-focused';
    maxWords: number;
    allowTechnicalTerms: boolean;
}
export interface ComplexityAnalysis {
    isSimpleTechnicalChange: boolean;
    isComplexBusinessFeature: boolean;
    confidence: number;
    reasoning: string;
}
export declare class BusinessPromptTemplates extends PromptTemplates {
    /**
     * Business capability identification prompt - transforms technical changes to user value
     * Now includes complexity-aware naming strategy
     */
    static createBusinessImpactPrompt(filePath: string, codeChanges: string, technicalContext: string, changeComplexity?: 'simple' | 'moderate' | 'complex'): string;
    /**
     * Create prompt based on naming strategy
     */
    private static createComplexityAwarePrompt;
    /**
     * Determine naming strategy based on change complexity and patterns
     */
    private static determineNamingStrategy;
    /**
     * Analyze code changes to determine complexity
     */
    private static analyzeChangeComplexity;
    /**
     * Get naming instructions based on strategy
     */
    private static getNamingInstructions;
    /**
     * Get analysis questions based on strategy
     */
    private static getAnalysisQuestions;
    /**
     * Get name prompt based on strategy
     */
    private static getNamePrompt;
    /**
     * Business domain classification - maps code to business capabilities
     */
    static createBusinessCapabilityPrompt(filePath: string, codeChanges: string, functionalContext: string): string;
    /**
     * Business hierarchy expansion - determines if capability needs sub-capabilities
     */
    static createBusinessHierarchyPrompt(capability: string, userValue: string, businessProcess: string, currentDepth: number, technicalScope: string): string;
    /**
     * Progressive language enforcement - ensures appropriate language for hierarchy level
     */
    static createProgressiveLanguagePrompt(currentName: string, currentDescription: string, targetLevel: number, targetAudience: 'executive' | 'product-manager' | 'technical-product' | 'developer'): string;
    /**
     * Business value consolidation - merges themes by user value rather than technical similarity
     */
    static createBusinessValueConsolidationPrompt(themes: Array<{
        name: string;
        userValue: string;
        businessProcess: string;
        technicalScope: string;
    }>): string;
    /**
     * Get audience-specific configuration for progressive language
     */
    private static getAudienceConfig;
}
