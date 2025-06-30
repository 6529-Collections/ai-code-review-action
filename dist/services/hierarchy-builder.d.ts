import { MindmapNode, SemanticDiff, MindmapOptions } from '../types/mindmap-types';
import { Theme } from './theme-service';
/**
 * Builds dynamic hierarchy with natural depth based on code complexity
 * PRD: "Depth emerges from code complexity, not forced into preset levels"
 */
export declare class HierarchyBuilder {
    private codeDistributor;
    private aiService;
    private crossRefService;
    private options;
    private nodeCounter;
    constructor(anthropicApiKey: string, options?: MindmapOptions);
    /**
     * Build complete mindmap hierarchy from business themes
     * PRD: "Natural organization - structure emerges from code"
     */
    buildDynamicHierarchy(themes: Theme[], semanticDiff: SemanticDiff): Promise<MindmapNode[]>;
    /**
     * Create root node from business theme
     */
    private createRootNode;
    /**
     * Expand node recursively until naturally atomic
     * PRD: "AI decides when further decomposition is needed"
     */
    private expandUntilAtomic;
    /**
     * Create child node from assignment
     */
    private createChildNode;
    /**
     * Extract code relevant to a theme
     */
    private extractThemeCode;
    /**
     * Extract function context from hunks
     */
    private extractFunctionContext;
    /**
     * Extract class context from hunks
     */
    private extractClassContext;
    /**
     * Determine context type from file type
     */
    private determineContextType;
    /**
     * Calculate metrics for a node
     */
    private calculateNodeMetrics;
    /**
     * Generate hierarchical node ID
     * Format: parent_type_index_uuid
     */
    private generateNodeId;
    /**
     * Trim text to word limit
     */
    private trimToWordLimit;
    /**
     * Apply business patterns to enhance organization
     */
    private applyBusinessPatterns;
    /**
     * Find nodes matching a business pattern
     */
    private findNodesMatchingPattern;
    /**
     * Create cross-references based on business patterns
     */
    private createPatternCrossReferences;
    /**
     * Find maximum depth in the hierarchy
     */
    private findMaxDepth;
    /**
     * Create a reference node for shared code
     * Used when smart duplication is enabled
     */
    createReferenceNode(originalNode: MindmapNode, referenceContext: string, parentNode: MindmapNode): Promise<MindmapNode>;
}
