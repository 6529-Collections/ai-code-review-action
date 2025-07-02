import { DiffAnalysis } from './git-diff-analyzer';
/**
 * Builds accurate theme descriptions from actual code changes
 */
export declare class ThemeDescriptionBuilder {
    /**
     * Build complete theme description from diff analysis
     */
    buildDescription(analysis: DiffAnalysis, options?: {
        includeMetrics?: boolean;
        includeFileList?: boolean;
        maxLength?: number;
    }): {
        description: string;
        detailedDescription: string;
        technicalSummary: string;
        keyChanges: string[];
    };
    /**
     * Build main description (concise, factual)
     */
    private buildMainDescription;
    /**
     * Build detailed description with specific changes
     */
    private buildDetailedDescription;
    /**
     * Build technical summary
     */
    private buildTechnicalSummary;
    /**
     * Extract key changes as bullet points
     */
    private extractKeyChanges;
    /**
     * Determine main action from diff
     */
    private determineMainAction;
    /**
     * Summarize changes in a single file
     */
    private summarizeFileChanges;
    /**
     * Find files containing a specific method
     */
    private findFilesWithMethod;
    /**
     * Find files containing a specific class
     */
    private findFilesWithClass;
    /**
     * Determine action for a specific method
     */
    private getMethodAction;
    /**
     * Determine action for a specific class
     */
    private getClassAction;
    /**
     * Extract clean file name from path
     */
    private extractFileName;
    /**
     * Truncate text to specified length
     */
    private truncateToLength;
}
