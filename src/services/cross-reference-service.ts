import {
  MindmapNode,
  CrossReference,
  SharedComponent,
  CrossReferenceType,
} from '../types/mindmap-types';
import { ClaudeClient } from '../utils/claude-client';
import { JsonExtractor } from '../utils/json-extractor';
import { logInfo } from '../utils';

/**
 * Manages intelligent cross-references between nodes
 * PRD: "Smart duplication - AI decides when showing code in multiple contexts adds value"
 */
export class CrossReferenceService {
  private claudeClient: ClaudeClient;

  constructor(anthropicApiKey: string) {
    this.claudeClient = new ClaudeClient(anthropicApiKey);
  }

  /**
   * Link nodes with intelligent cross-references
   * Identifies and creates valuable relationships between nodes
   */
  async linkCrossReferences(
    roots: MindmapNode[],
    sharedComponents: SharedComponent[]
  ): Promise<void> {
    logInfo(`Analyzing cross-references for ${roots.length} root themes`);

    // Build flat list of all nodes for easier searching
    const allNodes = this.flattenNodeTree(roots);

    // Process shared components
    await this.processSharedComponents(allNodes, sharedComponents);

    // Identify implicit relationships
    await this.identifyImplicitRelationships(allNodes);

    // Validate and optimize references
    this.optimizeCrossReferences(allNodes);

    logInfo(
      `Created cross-references for ${this.countCrossReferences(allNodes)} relationships`
    );
  }

  /**
   * Flatten node tree into array
   */
  private flattenNodeTree(nodes: MindmapNode[]): MindmapNode[] {
    const flat: MindmapNode[] = [];

    const traverse = (node: MindmapNode): void => {
      flat.push(node);
      node.children.forEach(traverse);
    };

    nodes.forEach(traverse);
    return flat;
  }

  /**
   * Process shared components to create valuable cross-references
   */
  private async processSharedComponents(
    nodes: MindmapNode[],
    sharedComponents: SharedComponent[]
  ): Promise<void> {
    for (const component of sharedComponents) {
      // Find nodes that interact with this component
      const relatedNodes = this.findNodesUsingComponent(nodes, component);

      if (relatedNodes.length > 1) {
        // Determine if cross-references add value
        const shouldLink = await this.aiShouldCreateComponentLinks(
          component,
          relatedNodes
        );

        if (shouldLink) {
          await this.createComponentCrossReferences(component, relatedNodes);
        }
      }
    }
  }

  /**
   * Find nodes that use a shared component
   */
  private findNodesUsingComponent(
    nodes: MindmapNode[],
    component: SharedComponent
  ): MindmapNode[] {
    const componentFiles = new Set([component.definedIn, ...component.usedIn]);

    return nodes.filter((node) => {
      // Check if node's files overlap with component files
      return node.affectedFiles.some((file) => componentFiles.has(file));
    });
  }

  /**
   * AI decision on whether component links add value
   */
  private async aiShouldCreateComponentLinks(
    component: SharedComponent,
    nodes: MindmapNode[]
  ): Promise<boolean> {
    // Don't create too many references
    if (nodes.length > 5) {
      return false;
    }

    const prompt = `
Should we create cross-references between themes that share this component?

SHARED COMPONENT:
Name: ${component.name}
Type: ${component.type}
Defined in: ${component.definedIn}
Used in ${component.usedIn.length} files

THEMES SHARING IT:
${nodes.map((n) => `- "${n.name}": ${n.businessContext}`).join('\n')}

Cross-references are valuable when:
1. Understanding one theme helps understand others
2. Changes to the component affect multiple themes significantly
3. The relationship isn't obvious from theme names alone
4. Reviewers would benefit from seeing the connection

RESPOND WITH JSON:
{
  "shouldLink": boolean,
  "reasoning": "Why or why not (max 20 words)"
}`;

    try {
      const response = await this.claudeClient.callClaude(prompt);
      const result = JsonExtractor.extractAndValidateJson(response, 'object', [
        'shouldLink',
      ]);

      if (result.success) {
        const data = result.data as { shouldLink: boolean };
        return data.shouldLink;
      }
    } catch (error) {
      logInfo(`AI component link decision failed: ${error}`);
    }

    // Default: link utilities and shared functions
    return component.type === 'utility' || component.type === 'function';
  }

  /**
   * Create cross-references for a shared component
   */
  private async createComponentCrossReferences(
    component: SharedComponent,
    nodes: MindmapNode[]
  ): Promise<void> {
    // Find primary node (where component is defined)
    const primaryNode = nodes.find((n) =>
      n.affectedFiles.includes(component.definedIn)
    );

    if (primaryNode) {
      // Create references from primary to users
      for (const node of nodes) {
        if (node.id !== primaryNode.id) {
          const relationship = await this.determineRelationshipType(
            primaryNode,
            node,
            component
          );

          // Add reference from primary to user
          primaryNode.crossReferences.push({
            nodeId: node.id,
            relationship,
            context: `${component.name} used in ${node.name}`,
            bidirectional: true,
          });

          // Add reference from user to primary
          node.crossReferences.push({
            nodeId: primaryNode.id,
            relationship: this.reverseRelationship(relationship),
            context: `Uses ${component.name} from ${primaryNode.name}`,
            bidirectional: true,
          });
        }
      }
    } else {
      // No clear primary - create mutual references
      for (let i = 0; i < nodes.length - 1; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          nodes[i].crossReferences.push({
            nodeId: nodes[j].id,
            relationship: 'shared-utility',
            context: `Both use ${component.name}`,
            bidirectional: true,
          });

          nodes[j].crossReferences.push({
            nodeId: nodes[i].id,
            relationship: 'shared-utility',
            context: `Both use ${component.name}`,
            bidirectional: true,
          });
        }
      }
    }
  }

  /**
   * Determine specific relationship type between nodes
   */
  private async determineRelationshipType(
    primaryNode: MindmapNode,
    userNode: MindmapNode,
    component: SharedComponent
  ): Promise<CrossReferenceType> {
    // Check if user node modifies the component
    const modifies = component.modifications.some(
      (mod) =>
        mod.type === 'usage' &&
        mod.changeType === 'modified' &&
        userNode.affectedFiles.includes(mod.file)
    );

    if (modifies) return 'modifies';

    // Check dependency relationship
    const isDependency = this.checkDependency(primaryNode, userNode);
    if (isDependency) return 'depends-on';

    // Default to 'uses'
    return 'uses';
  }

  /**
   * Check if one node depends on another
   */
  private checkDependency(primary: MindmapNode, user: MindmapNode): boolean {
    // Simple heuristic: if user has test files testing primary's code
    const primaryNonTestFiles = primary.affectedFiles.filter(
      (f) => !f.includes('.test.') && !f.includes('.spec.')
    );
    const userTestFiles = user.affectedFiles.filter(
      (f) => f.includes('.test.') || f.includes('.spec.')
    );

    for (const testFile of userTestFiles) {
      for (const sourceFile of primaryNonTestFiles) {
        if (testFile.includes(sourceFile.replace(/\.[^.]+$/, ''))) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Reverse a relationship type
   */
  private reverseRelationship(
    relationship: CrossReferenceType
  ): CrossReferenceType {
    switch (relationship) {
      case 'uses':
        return 'used-by';
      case 'modifies':
        return 'modified-by';
      case 'depends-on':
        return 'dependency-of';
      default:
        return relationship;
    }
  }

  /**
   * Identify implicit relationships between nodes
   * Finds connections not based on shared code
   */
  private async identifyImplicitRelationships(
    nodes: MindmapNode[]
  ): Promise<void> {
    // Group nodes by proximity and patterns
    const relatedGroups = await this.groupRelatedNodes(nodes);

    for (const group of relatedGroups) {
      if (group.length > 1) {
        const shouldLink = await this.aiShouldLinkRelatedNodes(group);

        if (shouldLink) {
          this.createRelatedFeatureLinks(group);
        }
      }
    }
  }

  /**
   * Group nodes that might be related
   */
  private async groupRelatedNodes(
    nodes: MindmapNode[]
  ): Promise<MindmapNode[][]> {
    const groups: MindmapNode[][] = [];
    const processed = new Set<string>();

    for (const node of nodes) {
      if (processed.has(node.id)) continue;

      const related = nodes.filter((n) => {
        if (n.id === node.id || processed.has(n.id)) return false;

        // Check various relationship indicators
        return (
          this.sharesSimilarFiles(node, n) ||
          this.hasNameSimilarity(node, n) ||
          this.hasContextSimilarity(node, n)
        );
      });

      if (related.length > 0) {
        const group = [node, ...related];
        groups.push(group);
        group.forEach((n) => processed.add(n.id));
      }
    }

    return groups;
  }

  /**
   * Check if nodes share similar files
   */
  private sharesSimilarFiles(node1: MindmapNode, node2: MindmapNode): boolean {
    // Check for files in same directory
    const dirs1 = new Set(
      node1.affectedFiles.map((f) => f.substring(0, f.lastIndexOf('/')))
    );
    const dirs2 = new Set(
      node2.affectedFiles.map((f) => f.substring(0, f.lastIndexOf('/')))
    );

    const sharedDirs = Array.from(dirs1).filter((d) => dirs2.has(d));
    return sharedDirs.length > 0;
  }

  /**
   * Check name similarity
   */
  private hasNameSimilarity(node1: MindmapNode, node2: MindmapNode): boolean {
    const words1 = new Set(node1.name.toLowerCase().split(/\s+/));
    const words2 = new Set(node2.name.toLowerCase().split(/\s+/));

    const shared = Array.from(words1).filter((w) => words2.has(w));
    return shared.length >= 2; // At least 2 shared words
  }

  /**
   * Check context similarity
   */
  private hasContextSimilarity(
    node1: MindmapNode,
    node2: MindmapNode
  ): boolean {
    const context1 =
      `${node1.businessContext} ${node1.technicalContext}`.toLowerCase();
    const context2 =
      `${node2.businessContext} ${node2.technicalContext}`.toLowerCase();

    // Simple similarity check
    const words1 = new Set(context1.split(/\s+/));
    const words2 = new Set(context2.split(/\s+/));

    const shared = Array.from(words1).filter((w) => words2.has(w));
    const similarity = shared.length / Math.min(words1.size, words2.size);

    return similarity > 0.3;
  }

  /**
   * AI decision on linking related nodes
   */
  private async aiShouldLinkRelatedNodes(
    nodes: MindmapNode[]
  ): Promise<boolean> {
    const prompt = `
Should we create cross-references between these potentially related themes?

THEMES:
${nodes
  .map(
    (n) => `
- "${n.name}"
  Business: ${n.businessContext}
  Files: ${n.affectedFiles.slice(0, 3).join(', ')}${n.affectedFiles.length > 3 ? '...' : ''}
`
  )
  .join('\n')}

Create links when:
1. Themes implement related features
2. Understanding one helps understand others
3. They form a logical group or workflow
4. The relationship adds review value

RESPOND WITH JSON:
{
  "shouldLink": boolean,
  "relationship": "What connects them (max 15 words)"
}`;

    try {
      const response = await this.claudeClient.callClaude(prompt);
      const result = JsonExtractor.extractAndValidateJson(response, 'object', [
        'shouldLink',
      ]);

      if (result.success) {
        const data = result.data as { shouldLink: boolean };
        return data.shouldLink;
      }
    } catch (error) {
      logInfo(`AI related nodes decision failed: ${error}`);
    }

    return false;
  }

  /**
   * Create cross-references for related features
   */
  private createRelatedFeatureLinks(nodes: MindmapNode[]): void {
    // Create bidirectional links between all nodes in group
    for (let i = 0; i < nodes.length - 1; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const context = this.generateRelationshipContext(nodes[i], nodes[j]);

        nodes[i].crossReferences.push({
          nodeId: nodes[j].id,
          relationship: 'related-feature',
          context,
          bidirectional: true,
        });

        nodes[j].crossReferences.push({
          nodeId: nodes[i].id,
          relationship: 'related-feature',
          context,
          bidirectional: true,
        });
      }
    }
  }

  /**
   * Generate context description for relationship
   */
  private generateRelationshipContext(
    node1: MindmapNode,
    node2: MindmapNode
  ): string {
    // Find what they have in common
    if (this.sharesSimilarFiles(node1, node2)) {
      return 'Work on related files';
    }
    if (this.hasNameSimilarity(node1, node2)) {
      return 'Similar functionality';
    }
    return 'Related implementation';
  }

  /**
   * Optimize cross-references to avoid redundancy
   * Remove duplicate or low-value references
   */
  private optimizeCrossReferences(nodes: MindmapNode[]): void {
    for (const node of nodes) {
      // Remove duplicate references
      const seen = new Map<string, CrossReference>();

      for (const ref of node.crossReferences) {
        const key = `${ref.nodeId}-${ref.relationship}`;
        const existing = seen.get(key);

        if (!existing || this.isBetterReference(ref, existing)) {
          seen.set(key, ref);
        }
      }

      // Keep only best references
      node.crossReferences = Array.from(seen.values());

      // Limit total references per node
      if (node.crossReferences.length > 10) {
        node.crossReferences = this.selectBestReferences(
          node.crossReferences,
          10
        );
      }
    }
  }

  /**
   * Compare references to keep the better one
   */
  private isBetterReference(
    ref1: CrossReference,
    ref2: CrossReference
  ): boolean {
    // Prefer more specific relationships
    const specificity: Record<CrossReferenceType, number> = {
      modifies: 5,
      'modified-by': 5,
      'depends-on': 4,
      'dependency-of': 4,
      uses: 3,
      'used-by': 3,
      'shared-utility': 2,
      'related-feature': 1,
    };

    return (
      (specificity[ref1.relationship] || 0) >
      (specificity[ref2.relationship] || 0)
    );
  }

  /**
   * Select best N references based on value
   */
  private selectBestReferences(
    refs: CrossReference[],
    limit: number
  ): CrossReference[] {
    // Sort by relationship specificity and keep top N
    const specificity: Record<CrossReferenceType, number> = {
      modifies: 5,
      'modified-by': 5,
      'depends-on': 4,
      'dependency-of': 4,
      uses: 3,
      'used-by': 3,
      'shared-utility': 2,
      'related-feature': 1,
    };

    return refs
      .sort(
        (a, b) =>
          (specificity[b.relationship] || 0) -
          (specificity[a.relationship] || 0)
      )
      .slice(0, limit);
  }

  /**
   * Count total cross-references created
   */
  private countCrossReferences(nodes: MindmapNode[]): number {
    return nodes.reduce((sum, node) => sum + node.crossReferences.length, 0);
  }

  /**
   * Find specific cross-reference targets
   * Used by UI to navigate between related nodes
   */
  findCrossReferenceTargets(
    node: MindmapNode,
    allNodes: MindmapNode[]
  ): Array<{ node: MindmapNode; reference: CrossReference }> {
    const nodeMap = new Map(allNodes.map((n) => [n.id, n]));
    const targets: Array<{ node: MindmapNode; reference: CrossReference }> = [];

    for (const ref of node.crossReferences) {
      const target = nodeMap.get(ref.nodeId);
      if (target) {
        targets.push({ node: target, reference: ref });
      }
    }

    return targets;
  }
}
