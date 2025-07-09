import { Theme } from '@/shared/types/theme-types';
import { ConsolidatedTheme } from '../types/similarity-types';
import { CodeChange } from '@/shared/utils/ai-code-analyzer';
export interface ChangeComplexityAnalysis {
    complexity: 'simple' | 'moderate' | 'complex';
    confidence: number;
    reasoning: string;
    recommendedApproach: 'technical-specific' | 'hybrid' | 'business-focused';
}
export declare class ThemeNamingService {
    generateMergedThemeNameAndDescription(themes: Theme[]): Promise<{
        name: string;
        description: string;
    }>;
    private executeMergedThemeNaming;
    createParentTheme(domain: string, children: ConsolidatedTheme[]): ConsolidatedTheme;
    generateMergedThemeNameWithContext(themes: Theme[], enhancedContext?: {
        codeChanges?: CodeChange[];
        contextSummary?: string;
    }): Promise<{
        name: string;
        description: string;
    }>;
    generateMergedThemeNameWithContextLegacy(themes: Theme[], enhancedContext?: {
        codeChanges?: CodeChange[];
        contextSummary?: string;
    }): Promise<{
        name: string;
        description: string;
    }>;
    private buildMergedThemeNamingPrompt;
    private buildEnhancedMergedThemeNamingPrompt;
    private parseMergedThemeNamingResponse;
    private isValidThemeName;
    private createFallbackMergedThemeName;
    /**
     * Assess change complexity for naming strategy
     */
    private assessChangeComplexity;
    /**
     * Assess complexity with enhanced context
     */
    private assessChangeComplexityWithContext;
    /**
     * Check for simple technical patterns
     */
    private isSimpleTechnicalPattern;
    /**
     * Check for business feature patterns
     */
    private hasBusinessFeaturePatterns;
    /**
     * Build complexity-aware merged theme naming prompt
     */
    private buildComplexityAwareMergedThemeNamingPrompt;
    /**
     * Build enhanced complexity-aware prompt with context
     */
    private buildEnhancedComplexityAwareMergedThemeNamingPrompt;
    /**
     * Get naming guidelines based on complexity
     */
    private getNamingGuidelines;
}
