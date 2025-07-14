import { Theme } from '@/shared/types/theme-types';
export declare class NodeClassificationPrompts {
    /**
     * Build classification prompt for a theme
     */
    buildClassificationPrompt(theme: Theme): string;
    /**
     * Build context information for the theme
     */
    private buildContextInfo;
    /**
     * Analyze file types from code changes
     */
    private analyzeFileTypes;
    /**
     * Get classification examples for better AI understanding
     */
    private getClassificationExamples;
}
