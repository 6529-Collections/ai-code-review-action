import {
  MindmapNode,
  SemanticDiff,
  BusinessPattern,
  NodeMetrics,
  HierarchicalId,
  MindmapOptions,
  CodeDiff,
  DiffHunk,
  FileContext,
  ExpansionDecision,
} from '../types/mindmap-types';
import { Theme } from './theme-service';
import { DirectCodeAssignmentService } from './direct-code-assignment-service';
import { AIMindmapService } from './ai-mindmap-service';
import { CrossReferenceService } from './cross-reference-service';
import { SecureFileNamer } from '../utils/secure-file-namer';
import { logInfo } from '../utils';

/**
 * Builds dynamic hierarchy with natural depth based on code complexity
 * PRD: "Depth emerges from code complexity, not forced into preset levels"
 */
export class HierarchyBuilder {
  private directAssignmentService: DirectCodeAssignmentService;
  private aiService: AIMindmapService;
  private crossRefService: CrossReferenceService;
  private options: Required<MindmapOptions>;
  private nodeCounter: number = 0;

  constructor(anthropicApiKey: string, options: MindmapOptions = {}) {
    this.directAssignmentService = new DirectCodeAssignmentService();
    this.aiService = new AIMindmapService(anthropicApiKey);
    this.crossRefService = new CrossReferenceService(anthropicApiKey);
    this.options = {
      maxDepth: options.maxDepth ?? 30, // PRD: No artificial limits
      targetLeafSize: options.targetLeafSize ?? 10,
      crossReferenceThreshold: options.crossReferenceThreshold ?? 0.7,
      enablePatternDetection: options.enablePatternDetection ?? true,
      enableSmartDuplication: options.enableSmartDuplication ?? true,
      confidenceThreshold: options.confidenceThreshold ?? 0.8, // Base threshold, will be dynamic
    };
  }

  /**
   * Build complete mindmap hierarchy from business themes
   * PRD: "Natural organization - structure emerges from code"
   */
  async buildDynamicHierarchy(
    themes: Theme[],
    semanticDiff: SemanticDiff
  ): Promise<MindmapNode[]> {
    logInfo(`Building dynamic hierarchy for ${themes.length} themes`);

    const roots: MindmapNode[] = [];

    // Create root nodes from business themes
    for (const theme of themes) {
      const root = await this.createRootNode(theme, semanticDiff);

      // Expand recursively until naturally atomic
      await this.expandUntilAtomic(root, semanticDiff, 0);

      roots.push(root);
    }

    // Handle cross-cutting concerns and shared utilities
    await this.crossRefService.linkCrossReferences(
      roots,
      semanticDiff.sharedComponents
    );

    // Apply business patterns if enabled
    if (this.options.enablePatternDetection) {
      await this.applyBusinessPatterns(roots, semanticDiff.businessPatterns);
    }

    logInfo(
      `Created mindmap with ${roots.length} root themes, max depth: ${this.findMaxDepth(roots)}`
    );

    return roots;
  }

  /**
   * Create root node from business theme
   */
  private async createRootNode(
    theme: Theme,
    semanticDiff: SemanticDiff
  ): Promise<MindmapNode> {
    // Extract code relevant to this theme
    const themeCode = await this.extractThemeCode(theme, semanticDiff);
    const metrics = this.calculateNodeMetrics(themeCode);

    const node: MindmapNode = {
      id: this.generateNodeId(undefined, 'root'),
      name: this.trimToWordLimit(theme.name, 8),
      level: 0,
      description: theme.description,
      businessContext: theme.userScenario || theme.description,
      technicalContext: theme.detailedDescription || theme.description,
      codeDiff: themeCode,
      affectedFiles: theme.affectedFiles,
      metrics,
      children: [],
      crossReferences: [],
      isPrimary: true,
      expansionConfidence: theme.confidence,
    };

    return node;
  }

  /**
   * Expand node recursively until naturally atomic
   * PRD: "AI decides when further decomposition is needed"
   */
  private async expandUntilAtomic(
    node: MindmapNode,
    semanticDiff: SemanticDiff,
    depth: number
  ): Promise<void> {
    // Check if we've hit max depth (safety limit)
    if (depth >= this.options.maxDepth) {
      logInfo(`Max depth ${this.options.maxDepth} reached for "${node.name}"`);
      return;
    }

    // Ask AI for direct code assignment decision
    const expansionDecision: ExpansionDecision =
      await this.aiService.shouldExpandNode(node, depth);

    // Calculate dynamic confidence threshold based on depth
    const dynamicConfidenceThreshold = this.calculateDynamicConfidence(
      depth,
      node
    );

    if (
      !expansionDecision.shouldExpand ||
      expansionDecision.isAtomic ||
      expansionDecision.confidence < dynamicConfidenceThreshold
    ) {
      node.atomicReason = expansionDecision.atomicReason;
      logInfo(
        `Node "${node.name}" is atomic at depth ${depth}: ${node.atomicReason}`
      );
      return;
    }

    // Get AI direct assignments for child nodes
    const childAssignments = expansionDecision.children;
    if (!childAssignments || childAssignments.length === 0) {
      logInfo(`No child assignments for "${node.name}"`);
      return;
    }

    // Process direct assignments (no mechanical distribution)
    const children =
      await this.directAssignmentService.processDirectAssignments(
        node,
        childAssignments
      );

    // Recursive expansion for each child
    for (const child of children) {
      await this.expandUntilAtomic(child, semanticDiff, depth + 1);
      node.children.push(child);
    }

    logInfo(
      `Expanded "${node.name}" into ${node.children.length} children at depth ${depth + 1}`
    );
  }

  /**
   * Extract code relevant to a theme
   */
  private async extractThemeCode(
    theme: Theme,
    semanticDiff: SemanticDiff
  ): Promise<CodeDiff[]> {
    const codeDiffs: CodeDiff[] = [];
    const themeFiles = new Set(theme.affectedFiles);

    for (const file of semanticDiff.files) {
      if (themeFiles.has(file.path)) {
        // Convert FileDiff to CodeDiff
        const codeDiff: CodeDiff = {
          file: file.path,
          hunks: file.hunks,
          fileContext: {
            functionName: this.extractFunctionContext(file.hunks),
            className: this.extractClassContext(file.hunks),
            startLine: file.hunks[0]?.newStart || 0,
            endLine: file.hunks[file.hunks.length - 1]?.newStart || 0,
            contextType: this.determineContextType(file.fileType),
          },
          ownership: 'primary',
        };
        codeDiffs.push(codeDiff);
      }
    }

    return codeDiffs;
  }

  /**
   * Extract function context from hunks
   */
  private extractFunctionContext(hunks: DiffHunk[]): string | undefined {
    for (const hunk of hunks) {
      if (hunk.semanticContext) {
        return hunk.semanticContext;
      }
    }
    return undefined;
  }

  /**
   * Extract class context from hunks
   */
  private extractClassContext(hunks: DiffHunk[]): string | undefined {
    for (const hunk of hunks) {
      for (const change of hunk.changes) {
        const classMatch = change.content.match(/class\s+(\w+)/);
        if (classMatch) {
          return classMatch[1];
        }
      }
    }
    return undefined;
  }

  /**
   * Determine context type from file type
   */
  private determineContextType(fileType: string): FileContext['contextType'] {
    switch (fileType) {
      case 'test':
        return 'test';
      case 'config':
        return 'config';
      case 'source':
        return 'function';
      default:
        return 'module';
    }
  }

  /**
   * Calculate metrics for a node
   */
  private calculateNodeMetrics(codeDiffs: CodeDiff[]): NodeMetrics {
    let linesAdded = 0;
    let linesRemoved = 0;
    let linesModified = 0;
    const files = new Set<string>();

    for (const diff of codeDiffs) {
      files.add(diff.file);

      for (const hunk of diff.hunks) {
        for (const change of hunk.changes) {
          if (change.type === 'add') linesAdded++;
          else if (change.type === 'delete') linesRemoved++;
          else linesModified++;
        }
      }
    }

    const totalLines = linesAdded + linesRemoved + linesModified;
    const complexity =
      totalLines < 20 ? 'low' : totalLines < 100 ? 'medium' : 'high';

    return {
      linesAdded,
      linesRemoved,
      linesModified,
      complexity,
      fileCount: files.size,
    };
  }

  /**
   * Generate hierarchical node ID
   * Format: parent_type_index_uuid
   */
  private generateNodeId(
    parentId: string | undefined,
    nodeType: HierarchicalId['nodeType']
  ): string {
    this.nodeCounter++;
    const uuid = SecureFileNamer.generateSecureId('node').slice(0, 8);

    if (!parentId) {
      return `${nodeType}_${this.nodeCounter}_${uuid}`;
    }

    return `${parentId}_${nodeType}_${this.nodeCounter}_${uuid}`;
  }

  /**
   * Trim text to word limit
   */
  private trimToWordLimit(text: string, maxWords: number): string {
    const words = text.split(/\s+/);
    if (words.length <= maxWords) {
      return text;
    }
    return words.slice(0, maxWords).join(' ');
  }

  /**
   * Apply business patterns to enhance organization
   */
  private async applyBusinessPatterns(
    roots: MindmapNode[],
    patterns: BusinessPattern[]
  ): Promise<void> {
    for (const pattern of patterns) {
      if (pattern.confidence >= this.options.confidenceThreshold) {
        // Find nodes that match this pattern
        const matchingNodes = this.findNodesMatchingPattern(roots, pattern);

        if (matchingNodes.length > 1) {
          // Create cross-references between related nodes
          await this.createPatternCrossReferences(matchingNodes, pattern);
        }
      }
    }
  }

  /**
   * Find nodes matching a business pattern
   */
  private findNodesMatchingPattern(
    roots: MindmapNode[],
    pattern: BusinessPattern
  ): MindmapNode[] {
    const matching: MindmapNode[] = [];
    const patternFiles = new Set(pattern.involvedFiles);

    const searchNodes = (nodes: MindmapNode[]): void => {
      for (const node of nodes) {
        const nodeFiles = new Set(node.affectedFiles);
        const overlap = Array.from(nodeFiles).filter((f) =>
          patternFiles.has(f)
        );

        if (overlap.length > 0) {
          matching.push(node);
        }

        searchNodes(node.children);
      }
    };

    searchNodes(roots);
    return matching;
  }

  /**
   * Create cross-references based on business patterns
   */
  private async createPatternCrossReferences(
    nodes: MindmapNode[],
    pattern: BusinessPattern
  ): Promise<void> {
    for (let i = 0; i < nodes.length - 1; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        nodes[i].crossReferences.push({
          nodeId: nodes[j].id,
          relationship: 'related-feature',
          context: `Both part of ${pattern.name}`,
          bidirectional: true,
        });

        nodes[j].crossReferences.push({
          nodeId: nodes[i].id,
          relationship: 'related-feature',
          context: `Both part of ${pattern.name}`,
          bidirectional: true,
        });
      }
    }
  }

  /**
   * Calculate dynamic confidence threshold based on depth and complexity
   * Deeper nodes require lower confidence to prevent over-expansion
   */
  private calculateDynamicConfidence(depth: number, node: MindmapNode): number {
    const baseThreshold = this.options.confidenceThreshold;
    const depthPenalty = depth * 0.1; // Reduce by 0.1 per level
    const complexityBonus =
      node.metrics.complexity === 'high'
        ? 0.1
        : node.metrics.complexity === 'medium'
          ? 0.05
          : 0;

    // Lower threshold for deeper levels, higher for complex nodes
    const dynamicThreshold = Math.max(
      0.3,
      baseThreshold - depthPenalty + complexityBonus
    );

    logInfo(
      `Dynamic confidence threshold for "${node.name}" at depth ${depth}: ${dynamicThreshold}`
    );
    return dynamicThreshold;
  }

  /**
   * Find maximum depth in the hierarchy
   */
  private findMaxDepth(roots: MindmapNode[]): number {
    let maxDepth = 0;

    const traverse = (node: MindmapNode): void => {
      maxDepth = Math.max(maxDepth, node.level);
      node.children.forEach(traverse);
    };

    roots.forEach(traverse);
    return maxDepth;
  }
}
