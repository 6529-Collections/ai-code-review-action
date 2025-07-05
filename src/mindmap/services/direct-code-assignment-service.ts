import {
  MindmapNode,
  DirectChildAssignment,
  CodeAssignmentValidation,
  CodeDiff,
  NodeMetrics,
} from '../types/mindmap-types';
import { logInfo } from '../../utils';

/**
 * Direct code assignment service - no mechanical matching
 * PRD: "AI decides everything" - just validates and passes through AI assignments
 */
export class DirectCodeAssignmentService {
  /**
   * Process AI-assigned children (no mechanical distribution)
   */
  async processDirectAssignments(
    parentNode: MindmapNode,
    assignments: DirectChildAssignment[]
  ): Promise<MindmapNode[]> {
    logInfo(
      `Processing ${assignments.length} direct assignments for "${parentNode.name}"`
    );

    // Validate complete coverage
    const validation = this.validateCodeCoverage(
      parentNode.codeDiff,
      assignments
    );
    if (!validation.isComplete) {
      logInfo(
        `Warning: Incomplete code coverage - ${validation.issues.join(', ')}`
      );
    }

    // Create child nodes from direct assignments
    const children: MindmapNode[] = [];
    for (const assignment of assignments) {
      const child = await this.createChildFromAssignment(
        assignment,
        parentNode
      );
      children.push(child);
    }

    return children;
  }

  /**
   * Create child node from AI assignment (no processing needed)
   */
  private async createChildFromAssignment(
    assignment: DirectChildAssignment,
    parent: MindmapNode
  ): Promise<MindmapNode> {
    const metrics = this.calculateMetrics(assignment.assignedCode);
    const affectedFiles = this.extractAffectedFiles(assignment.assignedCode);

    return {
      id: this.generateChildId(parent.id),
      name: assignment.name,
      level: parent.level + 1,
      parentId: parent.id,
      description: assignment.description,
      businessContext: assignment.businessValue,
      technicalContext: assignment.technicalPurpose,
      codeDiff: assignment.assignedCode, // Direct assignment from AI!
      affectedFiles,
      metrics,
      children: [],
      crossReferences: assignment.crossReferences || [],
      isPrimary: assignment.ownership === 'primary',
      expansionConfidence: 0.8,
    };
  }

  /**
   * Validate that AI assignments cover all parent code
   */
  private validateCodeCoverage(
    parentCode: CodeDiff[],
    assignments: DirectChildAssignment[]
  ): CodeAssignmentValidation {
    const parentLines = this.extractAllLines(parentCode);
    const assignedLines = new Set<string>();
    const duplicatedLines: string[] = [];
    const issues: string[] = [];

    // Check each assignment
    for (const assignment of assignments) {
      for (const line of this.extractAllLines(assignment.assignedCode)) {
        if (assignedLines.has(line)) {
          duplicatedLines.push(line);
          issues.push(
            `Line assigned to multiple children: ${line.substring(0, 50)}...`
          );
        }
        assignedLines.add(line);
      }
    }

    // Check for unassigned lines
    const unassignedLines = parentLines.filter(
      (line) => !assignedLines.has(line)
    );
    if (unassignedLines.length > 0) {
      issues.push(`${unassignedLines.length} lines not assigned to any child`);
    }

    return {
      isComplete: unassignedLines.length === 0 && duplicatedLines.length === 0,
      duplicatedLines,
      unassignedLines,
      issues,
    };
  }

  /**
   * Extract all line content from code diffs for comparison
   */
  private extractAllLines(codeDiffs: CodeDiff[]): string[] {
    const lines: string[] = [];

    for (const diff of codeDiffs) {
      for (const hunk of diff.hunks) {
        for (const change of hunk.changes) {
          if (change.type !== 'context') {
            lines.push(`${diff.file}:${change.lineNumber}:${change.content}`);
          }
        }
      }
    }

    return lines;
  }

  /**
   * Calculate metrics from assigned code
   */
  private calculateMetrics(codeDiffs: CodeDiff[]): NodeMetrics {
    const files = new Set<string>();

    for (const diff of codeDiffs) {
      files.add(diff.file);
    }

    return {
      complexity: 'medium',
      fileCount: files.size,
    };
  }

  /**
   * Extract affected files from code diffs
   */
  private extractAffectedFiles(codeDiffs: CodeDiff[]): string[] {
    return Array.from(new Set(codeDiffs.map((diff) => diff.file)));
  }

  /**
   * Generate child node ID
   */
  private generateChildId(parentId: string): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${parentId}_child_${timestamp}_${random}`;
  }
}
