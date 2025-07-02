import { ConsolidatedTheme } from '../types/similarity-types';
/**
 * Enhanced code structure analyzer that uses actual git diff data
 */
export declare class EnhancedCodeStructureAnalyzer {
    private gitDiffAnalyzer;
    constructor();
    /**
     * Analyze theme structure using actual diff data
     */
    analyzeThemeStructure(theme: ConsolidatedTheme, diffContent?: string): Promise<EnhancedCodeStructureAnalysis>;
    /**
     * Create fallback analysis when diff is not available
     */
    private createFallbackAnalysis;
    /**
     * Extract method names from code snippet
     */
    private extractMethods;
    /**
     * Extract class names from code snippet
     */
    private extractClasses;
    /**
     * Identify change types from actual diff data
     */
    private identifyChangeTypesFromDiff;
    /**
     * Calculate complexity based on actual changes
     */
    private calculateComplexityFromDiff;
    /**
     * Generate hints based on actual diff data
     */
    private generateDataDrivenHints;
}
/**
 * Enhanced analysis result with accurate metrics
 */
export interface EnhancedCodeStructureAnalysis {
    actualLinesAdded: number;
    actualLinesRemoved: number;
    actualFilesChanged: number;
    actualMethods: string[];
    actualClasses: string[];
    fileChanges: Array<{
        file: string;
        changes: Array<{
            type: 'added' | 'modified' | 'deleted';
            linesAdded: number;
            linesRemoved: number;
            methods: string[];
            classes: string[];
        }>;
    }>;
    changeTypes: ChangeType[];
    complexity: 'low' | 'medium' | 'high';
    isAtomic: boolean;
    expansionHints: string[];
}
export type ChangeType = 'config' | 'logic' | 'ui' | 'test' | 'types' | 'utils' | 'docs' | 'implementation' | 'imports';
