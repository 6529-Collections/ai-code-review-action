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
export declare class BusinessPromptTemplates extends PromptTemplates {
    /**
     * Business capability identification prompt - transforms technical changes to user value
     */
    static createBusinessImpactPrompt(filePath: string, codeChanges: string, technicalContext: string): string;
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
