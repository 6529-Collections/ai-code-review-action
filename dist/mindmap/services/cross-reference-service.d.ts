import { MindmapNode, CrossReference, SharedComponent } from '../types/mindmap-types';
/**
 * Manages intelligent cross-references between nodes
 * PRD: "Smart duplication - AI decides when showing code in multiple contexts adds value"
 */
export declare class CrossReferenceService {
    private claudeClient;
    constructor(anthropicApiKey: string);
    /**
     * Link nodes with intelligent cross-references
     * Identifies and creates valuable relationships between nodes
     */
    linkCrossReferences(roots: MindmapNode[], sharedComponents: SharedComponent[]): Promise<void>;
    /**
     * Flatten node tree into array
     */
    private flattenNodeTree;
    /**
     * Process shared components to create valuable cross-references
     */
    private processSharedComponents;
    /**
     * Find nodes that use a shared component
     */
    private findNodesUsingComponent;
    /**
     * AI decision on whether component links add value
     */
    private aiShouldCreateComponentLinks;
    /**
     * Create cross-references for a shared component
     */
    private createComponentCrossReferences;
    /**
     * Determine specific relationship type between nodes
     */
    private determineRelationshipType;
    /**
     * Check if one node depends on another
     */
    private checkDependency;
    /**
     * Reverse a relationship type
     */
    private reverseRelationship;
    /**
     * Identify implicit relationships between nodes
     * Finds connections not based on shared code
     */
    private identifyImplicitRelationships;
    /**
     * Group nodes that might be related
     */
    private groupRelatedNodes;
    /**
     * Check if nodes share similar files
     */
    private sharesSimilarFiles;
    /**
     * Check name similarity
     */
    private hasNameSimilarity;
    /**
     * Check context similarity
     */
    private hasContextSimilarity;
    /**
     * AI decision on linking related nodes
     */
    private aiShouldLinkRelatedNodes;
    /**
     * Create cross-references for related features
     */
    private createRelatedFeatureLinks;
    /**
     * Generate context description for relationship
     */
    private generateRelationshipContext;
    /**
     * Optimize cross-references to avoid redundancy
     * Remove duplicate or low-value references
     */
    private optimizeCrossReferences;
    /**
     * Compare references to keep the better one
     */
    private isBetterReference;
    /**
     * Select best N references based on value
     */
    private selectBestReferences;
    /**
     * Count total cross-references created
     */
    private countCrossReferences;
    /**
     * Find specific cross-reference targets
     * Used by UI to navigate between related nodes
     */
    findCrossReferenceTargets(node: MindmapNode, allNodes: MindmapNode[]): Array<{
        node: MindmapNode;
        reference: CrossReference;
    }>;
}
