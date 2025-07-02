import { DiffAnalysis } from './git-diff-analyzer';
/**
 * Enhanced theme naming service that generates accurate names from actual changes
 */
export declare class EnhancedThemeNamingService {
    private unifiedPromptService?;
    constructor(anthropicApiKey?: string);
    /**
     * Generate theme name based on actual code changes
     * Priority: actual changes > file names > business impact
     */
    generateThemeName(diffAnalysis: DiffAnalysis, businessContext?: string): Promise<{
        name: string;
        description: string;
        confidence: number;
    }>;
    /**
     * Generate name directly from diff analysis data
     */
    private generateDataBasedName;
    /**
     * Determine the primary action from changes
     */
    private determineAction;
    /**
     * Get clean file name from path
     */
    private getFileName;
    /**
     * Find common pattern in file paths
     */
    private findFilePattern;
    /**
     * Enhance data-based name with AI for business context
     */
    private enhanceWithAI;
    /**
     * Summarize changes for AI context
     */
    private summarizeChanges;
    /**
     * Generate fallback name when all else fails
     */
    private generateFallbackName;
    /**
     * Generate fallback description
     */
    private generateFallbackDescription;
}
