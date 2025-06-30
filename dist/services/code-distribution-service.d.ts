import { MindmapNode, CodeDiff, NodeSuggestion, NodeCodeAssignment, SemanticDiff } from '../types/mindmap-types';
/**
 * Intelligently distributes code changes to theme nodes
 * PRD: "AI decides when showing code in multiple contexts adds value"
 */
export declare class CodeDistributionService {
    private claudeClient;
    constructor(anthropicApiKey: string);
    /**
     * Distribute code changes to suggested child nodes
     * Ensures complete coverage while minimizing redundancy
     */
    distributeCodeToNodes(parentNode: MindmapNode, suggestedChildren: NodeSuggestion[], semanticDiff: SemanticDiff): Promise<NodeCodeAssignment[]>;
    /**
     * Identify shared code within a node's scope
     */
    private identifySharedCodeInNode;
    /**
     * Assign primary ownership of code to child nodes
     * Each piece of code has exactly one primary owner
     */
    private assignPrimaryOwnership;
    /**
     * Group code diffs by file
     */
    private groupCodeByFile;
    /**
     * Extract code based on specific line selections
     */
    private extractRelevantCode;
    /**
     * Check if a hunk overlaps with a line selection
     */
    private hunkOverlapsSelection;
    /**
     * Find code that hasn't been assigned to any child
     */
    private findUnassignedCode;
    /**
     * Generate unique hunk identifier
     */
    private getHunkId;
    /**
     * Use AI to distribute unassigned code to most appropriate children
     */
    private aiDistributeUnassignedCode;
    /**
     * Fallback distribution when AI fails
     */
    private fallbackDistribution;
    /**
     * Create cross-references for shared code
     * PRD: "Context-aware duplication - same code shown differently based on usage"
     */
    private createCrossReferences;
    /**
     * Create cross-references for a shared component
     */
    private createComponentCrossReferences;
    /**
     * AI decision on whether cross-references add value
     */
    private aiShouldCreateCrossReferences;
    /**
     * Generate node ID for cross-reference
     */
    private generateNodeId;
    /**
     * Validate that all parent code is covered by children
     * PRD: "Ensure all code is represented at least once"
     */
    private validateCompleteCoverage;
    /**
     * Enrich assignments with metrics and final structure
     */
    private enrichWithMetrics;
    /**
     * Calculate metrics for assigned code
     */
    private calculateMetrics;
    /**
     * Extract primary files from code diffs
     */
    private extractPrimaryFiles;
    /**
     * Extract referenced files from cross-references
     */
    private extractReferencedFiles;
    /**
     * Format code diffs for AI prompts
     */
    private formatCodeDiffsForPrompt;
    /**
     * Create contextual view of code for a specific usage
     * PRD: "Same code shown differently based on usage context"
     */
    createContextualView(code: CodeDiff, usageContext: string, viewingNode: MindmapNode): Promise<CodeDiff>;
    /**
     * Extract contextual meaning for a specific usage
     */
    private extractContextualMeaning;
    /**
     * Determine context type from usage description
     */
    private determineContextType;
}
