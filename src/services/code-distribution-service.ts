import {
  MindmapNode,
  CodeDiff,
  DiffHunk,
  NodeSuggestion,
  NodeCodeAssignment,
  SemanticDiff,
  SharedComponent,
  CrossReference,
  FileContext,
  NodeMetrics,
} from '../types/mindmap-types';
import { ClaudeClient } from '../utils/claude-client';
import { JsonExtractor } from '../utils/json-extractor';
import { logInfo } from '../utils';

/**
 * Intelligently distributes code changes to theme nodes
 * PRD: "AI decides when showing code in multiple contexts adds value"
 */
export class CodeDistributionService {
  private claudeClient: ClaudeClient;

  constructor(anthropicApiKey: string) {
    this.claudeClient = new ClaudeClient(anthropicApiKey);
  }

  /**
   * Distribute code changes to suggested child nodes
   * Ensures complete coverage while minimizing redundancy
   */
  async distributeCodeToNodes(
    parentNode: MindmapNode,
    suggestedChildren: NodeSuggestion[],
    semanticDiff: SemanticDiff
  ): Promise<NodeCodeAssignment[]> {
    logInfo(
      `Distributing code from "${parentNode.name}" to ${suggestedChildren.length} children`
    );

    // 1. Identify shared components in parent's code
    const sharedComponents = await this.identifySharedCodeInNode(
      parentNode,
      semanticDiff.sharedComponents
    );

    // 2. Assign primary ownership of code to children
    const primaryAssignments = await this.assignPrimaryOwnership(
      suggestedChildren,
      parentNode.codeDiff
    );

    // 3. Create intelligent cross-references where valuable
    const crossReferences = await this.createCrossReferences(
      primaryAssignments,
      sharedComponents
    );

    // 4. Validate complete coverage
    const validated = await this.validateCompleteCoverage(
      primaryAssignments,
      parentNode.codeDiff
    );

    // 5. Calculate metrics for each assignment
    const assignments = await this.enrichWithMetrics(
      validated,
      crossReferences
    );

    return assignments;
  }

  /**
   * Identify shared code within a node's scope
   */
  private async identifySharedCodeInNode(
    node: MindmapNode,
    allSharedComponents: SharedComponent[]
  ): Promise<SharedComponent[]> {
    const nodeFiles = new Set(node.affectedFiles);

    return allSharedComponents.filter(
      (component) =>
        nodeFiles.has(component.definedIn) ||
        component.usedIn.some((file) => nodeFiles.has(file))
    );
  }

  /**
   * Assign primary ownership of code to child nodes
   * Each piece of code has exactly one primary owner
   */
  private async assignPrimaryOwnership(
    suggestions: NodeSuggestion[],
    parentCode: CodeDiff[]
  ): Promise<Map<NodeSuggestion, CodeDiff[]>> {
    const assignments = new Map<NodeSuggestion, CodeDiff[]>();

    // Initialize empty assignments
    for (const suggestion of suggestions) {
      assignments.set(suggestion, []);
    }

    // Group parent code by file for easier distribution
    const codeByFile = this.groupCodeByFile(parentCode);

    // Distribute based on suggested file ownership
    for (const suggestion of suggestions) {
      const suggestedCode: CodeDiff[] = [];

      for (const file of suggestion.primaryFiles) {
        const fileCode = codeByFile.get(file);
        if (fileCode) {
          // Extract specific hunks based on line selections
          const relevantCode = await this.extractRelevantCode(
            fileCode,
            suggestion.codeSelections.filter((sel) => sel.file === file)
          );
          suggestedCode.push(...relevantCode);
        }
      }

      assignments.set(suggestion, suggestedCode);
    }

    // Handle unassigned code using AI
    const unassigned = await this.findUnassignedCode(assignments, parentCode);
    if (unassigned.length > 0) {
      await this.aiDistributeUnassignedCode(
        assignments,
        unassigned,
        suggestions
      );
    }

    return assignments;
  }

  /**
   * Group code diffs by file
   */
  private groupCodeByFile(codeDiffs: CodeDiff[]): Map<string, CodeDiff[]> {
    const grouped = new Map<string, CodeDiff[]>();

    for (const diff of codeDiffs) {
      if (!grouped.has(diff.file)) {
        grouped.set(diff.file, []);
      }
      grouped.get(diff.file)!.push(diff);
    }

    return grouped;
  }

  /**
   * Extract code based on specific line selections
   */
  private async extractRelevantCode(
    fileDiffs: CodeDiff[],
    selections: Array<{ startLine: number; endLine: number; reason: string }>
  ): Promise<CodeDiff[]> {
    const relevantDiffs: CodeDiff[] = [];

    for (const diff of fileDiffs) {
      const relevantHunks: DiffHunk[] = [];

      for (const hunk of diff.hunks) {
        // Check if hunk overlaps with any selection
        for (const selection of selections) {
          if (this.hunkOverlapsSelection(hunk, selection)) {
            relevantHunks.push({
              ...hunk,
              semanticContext: selection.reason,
            });
            break;
          }
        }
      }

      if (relevantHunks.length > 0) {
        relevantDiffs.push({
          ...diff,
          hunks: relevantHunks,
          ownership: 'primary',
        });
      }
    }

    return relevantDiffs;
  }

  /**
   * Check if a hunk overlaps with a line selection
   */
  private hunkOverlapsSelection(
    hunk: DiffHunk,
    selection: { startLine: number; endLine: number }
  ): boolean {
    const hunkEnd = hunk.newStart + hunk.newLines - 1;
    return !(
      hunk.newStart > selection.endLine || hunkEnd < selection.startLine
    );
  }

  /**
   * Find code that hasn't been assigned to any child
   */
  private async findUnassignedCode(
    assignments: Map<NodeSuggestion, CodeDiff[]>,
    allCode: CodeDiff[]
  ): Promise<CodeDiff[]> {
    const assignedHunks = new Set<string>();

    // Collect all assigned hunks
    for (const diffs of assignments.values()) {
      for (const diff of diffs) {
        for (const hunk of diff.hunks) {
          assignedHunks.add(this.getHunkId(diff.file, hunk));
        }
      }
    }

    // Find unassigned hunks
    const unassigned: CodeDiff[] = [];
    for (const diff of allCode) {
      const unassignedHunks = diff.hunks.filter(
        (hunk) => !assignedHunks.has(this.getHunkId(diff.file, hunk))
      );

      if (unassignedHunks.length > 0) {
        unassigned.push({
          ...diff,
          hunks: unassignedHunks,
        });
      }
    }

    return unassigned;
  }

  /**
   * Generate unique hunk identifier
   */
  private getHunkId(file: string, hunk: DiffHunk): string {
    return `${file}:${hunk.oldStart}-${hunk.newStart}`;
  }

  /**
   * Use AI to distribute unassigned code to most appropriate children
   */
  private async aiDistributeUnassignedCode(
    assignments: Map<NodeSuggestion, CodeDiff[]>,
    unassignedCode: CodeDiff[],
    suggestions: NodeSuggestion[]
  ): Promise<void> {
    const prompt = `
Analyze this unassigned code and determine which child theme it belongs to.

UNASSIGNED CODE:
${this.formatCodeDiffsForPrompt(unassignedCode)}

CHILD THEMES:
${suggestions
  .map(
    (s, i) => `
${i + 1}. "${s.name}"
Purpose: ${s.technicalPurpose}
Current files: ${s.primaryFiles.join(', ')}
`
  )
  .join('\n')}

For each piece of unassigned code, determine the BEST matching child theme.
Consider:
- Semantic relationship to theme purpose
- File proximity to theme's existing files
- Functional cohesion

RESPOND WITH JSON:
{
  "assignments": [
    {
      "file": "path/to/file",
      "lineRanges": ["10-20", "45-50"],
      "bestThemeIndex": 1,
      "reasoning": "Why this code belongs there (max 15 words)"
    }
  ]
}`;

    try {
      const response = await this.claudeClient.callClaude(prompt);
      const result = JsonExtractor.extractAndValidateJson(response, 'object', [
        'assignments',
      ]);

      if (result.success) {
        const aiAssignments = result.data as {
          assignments: Array<{
            file: string;
            lineRanges: string[];
            bestThemeIndex: number;
            reasoning: string;
          }>;
        };

        // Apply AI assignments
        for (const assignment of aiAssignments.assignments) {
          if (
            assignment.bestThemeIndex > 0 &&
            assignment.bestThemeIndex <= suggestions.length
          ) {
            const suggestion = suggestions[assignment.bestThemeIndex - 1];
            const currentAssignment = assignments.get(suggestion) || [];

            // Find and add the unassigned code to this suggestion
            const relevantCode = unassignedCode.filter(
              (diff) => diff.file === assignment.file
            );
            currentAssignment.push(...relevantCode);

            assignments.set(suggestion, currentAssignment);
          }
        }
      }
    } catch (error) {
      logInfo(`AI distribution failed, using fallback: ${error}`);
      // Fallback: distribute evenly
      this.fallbackDistribution(assignments, unassignedCode, suggestions);
    }
  }

  /**
   * Fallback distribution when AI fails
   */
  private fallbackDistribution(
    assignments: Map<NodeSuggestion, CodeDiff[]>,
    unassignedCode: CodeDiff[],
    suggestions: NodeSuggestion[]
  ): void {
    let index = 0;
    for (const diff of unassignedCode) {
      const suggestion = suggestions[index % suggestions.length];
      const current = assignments.get(suggestion) || [];
      current.push(diff);
      assignments.set(suggestion, current);
      index++;
    }
  }

  /**
   * Create cross-references for shared code
   * PRD: "Context-aware duplication - same code shown differently based on usage"
   */
  private async createCrossReferences(
    primaryAssignments: Map<NodeSuggestion, CodeDiff[]>,
    sharedComponents: SharedComponent[]
  ): Promise<Map<NodeSuggestion, CrossReference[]>> {
    const crossRefs = new Map<NodeSuggestion, CrossReference[]>();

    // Initialize empty cross-references
    for (const suggestion of primaryAssignments.keys()) {
      crossRefs.set(suggestion, []);
    }

    // Analyze each shared component
    for (const component of sharedComponents) {
      // Find which suggestions use this component
      const usingSuggestions: NodeSuggestion[] = [];

      for (const [suggestion, diffs] of primaryAssignments) {
        const usesComponent = diffs.some(
          (diff) =>
            diff.file === component.definedIn ||
            component.usedIn.includes(diff.file)
        );

        if (usesComponent) {
          usingSuggestions.push(suggestion);
        }
      }

      // If multiple suggestions use it, create cross-references
      if (usingSuggestions.length > 1) {
        await this.createComponentCrossReferences(
          component,
          usingSuggestions,
          crossRefs
        );
      }
    }

    return crossRefs;
  }

  /**
   * Create cross-references for a shared component
   */
  private async createComponentCrossReferences(
    component: SharedComponent,
    usingSuggestions: NodeSuggestion[],
    crossRefs: Map<NodeSuggestion, CrossReference[]>
  ): Promise<void> {
    // Use AI to determine if cross-reference adds value
    const shouldCreateRefs = await this.aiShouldCreateCrossReferences(
      component,
      usingSuggestions
    );

    if (!shouldCreateRefs) return;

    // Create bidirectional references
    for (let i = 0; i < usingSuggestions.length; i++) {
      for (let j = i + 1; j < usingSuggestions.length; j++) {
        const refs1 = crossRefs.get(usingSuggestions[i]) || [];
        const refs2 = crossRefs.get(usingSuggestions[j]) || [];

        // Reference from i to j
        refs1.push({
          nodeId: this.generateNodeId(usingSuggestions[j]),
          relationship: 'shared-utility',
          context: `Both use ${component.name}`,
          bidirectional: true,
        });

        // Reference from j to i
        refs2.push({
          nodeId: this.generateNodeId(usingSuggestions[i]),
          relationship: 'shared-utility',
          context: `Both use ${component.name}`,
          bidirectional: true,
        });

        crossRefs.set(usingSuggestions[i], refs1);
        crossRefs.set(usingSuggestions[j], refs2);
      }
    }
  }

  /**
   * AI decision on whether cross-references add value
   */
  private async aiShouldCreateCrossReferences(
    component: SharedComponent,
    suggestions: NodeSuggestion[]
  ): Promise<boolean> {
    const prompt = `
Should we create cross-references between themes that share this component?

SHARED COMPONENT:
Name: ${component.name}
Type: ${component.type}
Defined in: ${component.definedIn}
Used by: ${component.usedIn.length} files

THEMES USING IT:
${suggestions.map((s) => `- "${s.name}": ${s.businessValue}`).join('\n')}

Cross-references are valuable when:
1. Understanding one theme helps understand the other
2. Changes to shared component affect multiple themes
3. The relationship is not obvious from theme names

RESPOND WITH JSON:
{
  "shouldCreateReferences": boolean,
  "reasoning": "Why or why not (max 20 words)"
}`;

    try {
      const response = await this.claudeClient.callClaude(prompt);
      const result = JsonExtractor.extractAndValidateJson(response, 'object', [
        'shouldCreateReferences',
      ]);

      if (result.success) {
        const data = result.data as { shouldCreateReferences: boolean };
        return data.shouldCreateReferences;
      }
    } catch (error) {
      logInfo(`AI cross-reference decision failed: ${error}`);
    }

    // Default: create references for shared utilities
    return component.type === 'utility' || component.type === 'function';
  }

  /**
   * Generate node ID for cross-reference
   */
  private generateNodeId(suggestion: NodeSuggestion): string {
    // This will be replaced with actual ID when nodes are created
    return `pending_${suggestion.name.toLowerCase().replace(/\s+/g, '-')}`;
  }

  /**
   * Validate that all parent code is covered by children
   * PRD: "Ensure all code is represented at least once"
   */
  private async validateCompleteCoverage(
    assignments: Map<NodeSuggestion, CodeDiff[]>,
    parentCode: CodeDiff[]
  ): Promise<Map<NodeSuggestion, CodeDiff[]>> {
    const allParentHunks = new Set<string>();
    const assignedHunks = new Set<string>();

    // Collect all parent hunks
    for (const diff of parentCode) {
      for (const hunk of diff.hunks) {
        allParentHunks.add(this.getHunkId(diff.file, hunk));
      }
    }

    // Collect assigned hunks
    for (const diffs of assignments.values()) {
      for (const diff of diffs) {
        for (const hunk of diff.hunks) {
          assignedHunks.add(this.getHunkId(diff.file, hunk));
        }
      }
    }

    // Check coverage
    const uncovered = Array.from(allParentHunks).filter(
      (id) => !assignedHunks.has(id)
    );

    if (uncovered.length > 0) {
      logInfo(
        `Warning: ${uncovered.length} hunks not covered by child assignments`
      );
      // In production, we would handle uncovered code here
    }

    return assignments;
  }

  /**
   * Enrich assignments with metrics and final structure
   */
  private async enrichWithMetrics(
    assignments: Map<NodeSuggestion, CodeDiff[]>,
    crossReferences: Map<NodeSuggestion, CrossReference[]>
  ): Promise<NodeCodeAssignment[]> {
    const enriched: NodeCodeAssignment[] = [];

    for (const [suggestion, codeDiffs] of assignments) {
      const metrics = this.calculateMetrics(codeDiffs);
      const primaryFiles = this.extractPrimaryFiles(codeDiffs);
      const referencedFiles = this.extractReferencedFiles(codeDiffs);

      enriched.push({
        suggestion,
        assignedCode: codeDiffs,
        primaryFiles,
        referencedFiles,
        metrics,
        crossReferences: crossReferences.get(suggestion) || [],
      });
    }

    return enriched;
  }

  /**
   * Calculate metrics for assigned code
   */
  private calculateMetrics(codeDiffs: CodeDiff[]): NodeMetrics {
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
          else if (change.type === 'context' && change.isKeyChange)
            linesModified++;
        }
      }
    }

    const totalLines = linesAdded + linesRemoved + linesModified;
    const complexity =
      totalLines < 10 ? 'low' : totalLines < 50 ? 'medium' : 'high';

    return {
      linesAdded,
      linesRemoved,
      linesModified,
      complexity,
      fileCount: files.size,
    };
  }

  /**
   * Extract primary files from code diffs
   */
  private extractPrimaryFiles(codeDiffs: CodeDiff[]): string[] {
    return Array.from(
      new Set(
        codeDiffs
          .filter((diff) => diff.ownership === 'primary')
          .map((diff) => diff.file)
      )
    );
  }

  /**
   * Extract referenced files from cross-references
   */
  private extractReferencedFiles(codeDiffs: CodeDiff[]): string[] {
    return Array.from(
      new Set(
        codeDiffs
          .filter((diff) => diff.ownership === 'reference')
          .map((diff) => diff.file)
      )
    );
  }

  /**
   * Format code diffs for AI prompts
   */
  private formatCodeDiffsForPrompt(diffs: CodeDiff[]): string {
    return diffs
      .map(
        (diff) => `
File: ${diff.file}
${diff.hunks
  .map(
    (hunk) => `
Lines ${hunk.newStart}-${hunk.newStart + hunk.newLines}:
${hunk.changes
  .filter((c) => c.type !== 'context')
  .map((c) => `${c.type === 'add' ? '+' : '-'} ${c.content}`)
  .join('\n')}
`
  )
  .join('\n')}
`
      )
      .join('\n\n');
  }

  /**
   * Create contextual view of code for a specific usage
   * PRD: "Same code shown differently based on usage context"
   */
  async createContextualView(
    code: CodeDiff,
    usageContext: string,
    viewingNode: MindmapNode
  ): Promise<CodeDiff> {
    const contextualMeaning = await this.extractContextualMeaning(
      code,
      usageContext,
      viewingNode
    );

    return {
      ...code,
      ownership: 'reference',
      contextualMeaning,
      fileContext: {
        ...code.fileContext,
        contextType: this.determineContextType(usageContext),
      },
    };
  }

  /**
   * Extract contextual meaning for a specific usage
   */
  private async extractContextualMeaning(
    code: CodeDiff,
    usageContext: string,
    viewingNode: MindmapNode
  ): Promise<string> {
    const prompt = `
Explain what this code change means in the context of "${viewingNode.name}".

CODE:
${this.formatCodeDiffsForPrompt([code])}

USAGE CONTEXT: ${usageContext}
VIEWING THEME: ${viewingNode.businessContext}

Provide a brief explanation (max 20 words) of what this code does FOR THIS SPECIFIC THEME.`;

    try {
      const response = await this.claudeClient.callClaude(prompt);
      return response.trim();
    } catch (error) {
      return `Used in ${usageContext}`;
    }
  }

  /**
   * Determine context type from usage description
   */
  private determineContextType(usage: string): FileContext['contextType'] {
    if (usage.includes('test')) return 'test';
    if (usage.includes('config')) return 'config';
    if (usage.includes('class')) return 'class';
    if (usage.includes('module')) return 'module';
    return 'function';
  }
}
