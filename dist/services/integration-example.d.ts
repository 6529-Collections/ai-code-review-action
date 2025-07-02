/**
 * Example integration showing how to use all the enhanced services together
 * This demonstrates the complete refactored flow
 */
import { NodeContext } from './node-context-builder';
import { ConsolidatedTheme } from '../types/similarity-types';
export declare class ThemeProcessingIntegration {
    private gitDiffAnalyzer;
    private codeAnalyzer;
    private nameService;
    private descriptionBuilder;
    private circuitBreaker;
    private expansionService;
    private nodeContextBuilder;
    private crossReferenceDetector;
    constructor(anthropicApiKey?: string);
    /**
     * Process a code change to create an accurate theme
     */
    processCodeChange(diffContent: string, businessContext?: string): Promise<ConsolidatedTheme>;
    /**
     * Check if a theme should be expanded
     */
    checkExpansion(theme: ConsolidatedTheme, currentDepth: number, diffContent?: string, parentTheme?: ConsolidatedTheme): Promise<{
        shouldExpand: boolean;
        decision: any;
    }>;
    /**
     * Extract code snippets from diff analysis
     */
    private extractCodeSnippets;
    /**
     * Analyze cross-references across multiple themes (Phase 6)
     */
    analyzeCrossReferences(themes: ConsolidatedTheme[], diffContents: Map<string, string>): Promise<{
        crossReferences: any;
        valuableRefs: any[];
        nodeContexts: Map<string, NodeContext>;
    }>;
}
/**
 * Example usage showing the complete flow
 */
export declare function exampleUsage(): Promise<void>;
