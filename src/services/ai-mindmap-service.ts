import {
  MindmapNode,
  DirectChildAssignment,
  SemanticDiff,
  ExpansionDecision,
  CodeDiff,
  DiffHunk,
  LineChange,
} from '../types/mindmap-types';
import { ClaudeClient } from '../utils/claude-client';
import { JsonExtractor } from '../utils/json-extractor';
import { logInfo } from '../utils';

/**
 * AI service for mindmap generation with PRD-aligned prompts
 * Creates self-contained nodes with natural depth detection
 */
export class AIMindmapService {
  private claudeClient: ClaudeClient;

  constructor(anthropicApiKey: string) {
    this.claudeClient = new ClaudeClient(anthropicApiKey);
  }

  /**
   * Determine if a node should be expanded with direct code assignment
   * PRD: "AI decides when further decomposition is needed"
   */
  async shouldExpandNode(
    node: MindmapNode,
    currentDepth: number
  ): Promise<ExpansionDecision> {
    const prompt = this.buildDirectAssignmentPrompt(node, currentDepth);

    try {
      const response = await this.claudeClient.callClaude(prompt);
      const result = JsonExtractor.extractAndValidateJson(response, 'object', [
        'shouldExpand',
      ]);

      if (result.success) {
        const data = result.data as DirectExpansionResponse;

        // Validate code assignments if expanding
        let children: DirectChildAssignment[] | undefined;
        if (data.shouldExpand && data.children) {
          children = this.validateDirectAssignments(data.children);
        }

        return {
          shouldExpand: data.shouldExpand,
          isAtomic: data.isAtomic || false,
          atomicReason: data.atomicReason,
          children,
          confidence: data.confidence || 0.8,
        };
      }
    } catch (error) {
      logInfo(`AI expansion decision failed for "${node.name}": ${error}`);
    }

    // Fallback: don't expand on error
    return {
      shouldExpand: false,
      isAtomic: true,
      atomicReason: 'AI analysis failed - treating as atomic',
      confidence: 0.3,
    };
  }

  /**
   * Build prompt for direct code assignment (PRD aligned)
   * AI sees complete code and assigns it directly to children
   */
  private buildDirectAssignmentPrompt(
    node: MindmapNode,
    currentDepth: number
  ): string {
    const completeCodeDiff = this.formatCompleteCodeDiff(node.codeDiff);
    const lineCount =
      node.metrics.linesAdded +
      node.metrics.linesRemoved +
      node.metrics.linesModified;

    return `Analyze this code change node for expansion with DIRECT CODE ASSIGNMENT.

CURRENT NODE: "${node.name}"
Description: ${node.description}
Business Context: ${node.businessContext}
Technical Context: ${node.technicalContext}
Depth: ${currentDepth}
Metrics: ${lineCount} lines across ${node.metrics.fileCount} files

COMPLETE CODE CHANGES:
${completeCodeDiff}

ATOMIC CRITERIA (Stop expansion when ALL true):
1. Single responsibility (does exactly ONE thing)
2. <20 lines of meaningful code changes
3. Single method or cohesive code block
4. No mixed concerns (e.g., validation AND persistence)
5. Can be understood without looking elsewhere

IF YOU EXPAND:
- You MUST assign EVERY line of code to exactly ONE child
- Each child must have a single, clear responsibility
- Return the complete CodeDiff structure for each child
- No line numbers - return actual code content

RESPOND WITH JSON:
{
  "shouldExpand": boolean,
  "isAtomic": boolean,
  "atomicReason": "if atomic, why? (max 20 words)",
  "confidence": 0.0-1.0,
  "children": [
    {
      "name": "Clear theme name (max 8 words)",
      "description": "What this child does (1-2 sentences)",
      "businessValue": "User impact (max 12 words)",
      "technicalPurpose": "Technical function (max 10 words)",
      "assignedCode": [
        {
          "file": "exact file path",
          "hunks": [
            {
              "oldStart": number,
              "oldLines": number,
              "newStart": number,
              "newLines": number,
              "changes": [
                {
                  "type": "add|delete|context", 
                  "content": "exact line content"
                }
              ]
            }
          ],
          "ownership": "primary"
        }
      ],
      "rationale": "Why this is separate (max 15 words)",
      "contextualMeaning": "How this code serves THIS specific child's purpose (max 20 words)",
      "suggestedCrossReferences": [
        {
          "targetTheme": "name of related theme",
          "relationship": "uses|used-by|modifies|depends-on",
          "reason": "brief explanation (max 10 words)"
        }
      ]
    }
  ]
}`;
  }

  /**
   * Format complete code diff for AI analysis (no truncation)
   * AI needs to see ALL code to make proper assignments
   */
  private formatCompleteCodeDiff(codeDiffs: CodeDiff[]): string {
    const output: string[] = [];
    let globalLineNumber = 1;

    for (const diff of codeDiffs) {
      output.push(`\n=== FILE: ${diff.file} ===`);

      for (const hunk of diff.hunks) {
        output.push(`\n[Hunk @ old:${hunk.oldStart} new:${hunk.newStart}]`);

        for (const change of hunk.changes) {
          const prefix =
            change.type === 'add' ? '+' : change.type === 'delete' ? '-' : ' ';
          output.push(`L${globalLineNumber}: ${prefix} ${change.content}`);
          globalLineNumber++;
        }
      }
    }

    return output.join('\n');
  }

  /**
   * Validate direct code assignments from AI
   */
  private validateDirectAssignments(
    assignments: Array<{
      name?: string;
      description?: string;
      businessValue?: string;
      technicalPurpose?: string;
      assignedCode?: Array<{
        file?: string;
        hunks?: Array<{
          oldStart?: number;
          oldLines?: number;
          newStart?: number;
          newLines?: number;
          changes?: Array<{
            type?: string;
            content?: string;
          }>;
        }>;
        ownership?: string;
      }>;
      rationale?: string;
      contextualMeaning?: string;
      suggestedCrossReferences?: Array<{
        targetTheme?: string;
        relationship?: string;
        reason?: string;
      }>;
    }>
  ): DirectChildAssignment[] {
    const validated: DirectChildAssignment[] = [];

    for (const assignment of assignments) {
      // Validate required fields
      if (
        !assignment.name ||
        !assignment.technicalPurpose ||
        !assignment.assignedCode
      ) {
        logInfo(`Skipping invalid assignment: ${assignment.name}`);
        continue;
      }

      // Validate and convert assigned code
      const assignedCode: CodeDiff[] = [];
      for (const codeAssignment of assignment.assignedCode) {
        if (!codeAssignment.file || !codeAssignment.hunks) continue;

        const validHunks: DiffHunk[] = [];
        for (const hunk of codeAssignment.hunks) {
          if (!hunk.changes) continue;

          const validChanges: LineChange[] = [];
          for (const change of hunk.changes) {
            if (change.type && change.content !== undefined) {
              validChanges.push({
                type: change.type as 'add' | 'delete' | 'context',
                lineNumber: 0, // Line numbers not used in direct assignment
                content: change.content,
              });
            }
          }

          if (validChanges.length > 0) {
            validHunks.push({
              oldStart: hunk.oldStart || 0,
              oldLines: hunk.oldLines || 0,
              newStart: hunk.newStart || 0,
              newLines: hunk.newLines || 0,
              changes: validChanges,
            });
          }
        }

        if (validHunks.length > 0) {
          assignedCode.push({
            file: codeAssignment.file,
            hunks: validHunks,
            fileContext: {
              startLine: validHunks[0]?.newStart || 0,
              endLine: validHunks[validHunks.length - 1]?.newStart || 0,
              contextType: 'function',
            },
            ownership:
              (codeAssignment.ownership as 'primary' | 'reference') ||
              'primary',
          });
        }
      }

      if (assignedCode.length > 0) {
        validated.push({
          name: this.trimToLimit(assignment.name, 8),
          description: assignment.description || assignment.technicalPurpose,
          businessValue: this.trimToLimit(
            assignment.businessValue || assignment.name,
            12
          ),
          technicalPurpose: this.trimToLimit(assignment.technicalPurpose, 10),
          assignedCode,
          ownership: 'primary',
          contextualMeaning: this.trimToLimit(
            assignment.contextualMeaning || assignment.technicalPurpose,
            20
          ),
          rationale: this.trimToLimit(
            assignment.rationale || 'Distinct concern',
            15
          ),
        });
      }
    }

    return validated;
  }

  /**
   * Generate initial theme suggestions from semantic diff
   * Used at the root level to identify major themes
   */
  async generateRootThemes(
    semanticDiff: SemanticDiff
  ): Promise<ThemeSuggestion[]> {
    const prompt = this.buildRootThemePrompt(semanticDiff);

    try {
      const response = await this.claudeClient.callClaude(prompt);
      const result = JsonExtractor.extractAndValidateJson(response, 'object', [
        'themes',
      ]);

      if (result.success) {
        const data = result.data as { themes: ThemeSuggestion[] };
        return this.validateThemeSuggestions(data.themes, semanticDiff);
      }
    } catch (error) {
      logInfo(`Root theme generation failed: ${error}`);
    }

    // Fallback: create single theme
    return [
      {
        name: 'Code Changes',
        businessValue: 'Update implementation',
        description: 'Changes to codebase',
        affectedFiles: semanticDiff.files.map((f) => f.path),
        confidence: 0.5,
      },
    ];
  }

  /**
   * Build prompt for root theme generation
   */
  private buildRootThemePrompt(semanticDiff: SemanticDiff): string {
    const filesByType = this.groupFilesByType(semanticDiff);
    const totalLines = this.calculateTotalLines(semanticDiff);

    return `Analyze this pull request and identify distinct business themes (user stories/capabilities).

PR OVERVIEW:
Total files: ${semanticDiff.files.length}
Total changes: ${totalLines} lines
Complexity: ${semanticDiff.totalComplexity}

FILES BY TYPE:
${Object.entries(filesByType)
  .map(([type, files]) => `${type}: ${files.length} files`)
  .join('\n')}

BUSINESS PATTERNS DETECTED:
${
  semanticDiff.businessPatterns
    .map((p) => `- ${p.name}: ${p.description}`)
    .join('\n') || 'None detected'
}

SEMANTIC CHANGES:
${this.summarizeSemanticChanges(semanticDiff)}

Identify 1-5 DISTINCT business themes that:
1. Represent complete user stories or business capabilities
2. Have clear, independent business value
3. Could be deployed/rolled back separately
4. Make sense to non-technical stakeholders

CRITICAL: Respond with ONLY valid JSON:
{
  "themes": [
    {
      "name": "Clear business theme (max 8 words)",
      "businessValue": "Value to users (max 12 words)",
      "description": "What this accomplishes (1-2 sentences)",
      "affectedFiles": ["relevant", "file", "paths"],
      "confidence": 0.0-1.0
    }
  ]
}`;
  }

  /**
   * Group files by type for summary
   */
  private groupFilesByType(
    semanticDiff: SemanticDiff
  ): Record<string, string[]> {
    const grouped: Record<string, string[]> = {};

    for (const file of semanticDiff.files) {
      if (!grouped[file.fileType]) {
        grouped[file.fileType] = [];
      }
      grouped[file.fileType].push(file.path);
    }

    return grouped;
  }

  /**
   * Calculate total lines changed
   */
  private calculateTotalLines(semanticDiff: SemanticDiff): number {
    let total = 0;

    for (const file of semanticDiff.files) {
      for (const hunk of file.hunks) {
        total += hunk.changes.filter((c) => c.type !== 'context').length;
      }
    }

    return total;
  }

  /**
   * Summarize semantic changes for prompt
   */
  private summarizeSemanticChanges(semanticDiff: SemanticDiff): string {
    const summary: string[] = [];
    const changeTypes = new Map<string, number>();

    for (const file of semanticDiff.files) {
      for (const change of file.semanticChanges) {
        const count = changeTypes.get(change.type) || 0;
        changeTypes.set(change.type, count + 1);
      }
    }

    for (const [type, count] of changeTypes) {
      summary.push(`- ${type}: ${count} occurrences`);
    }

    return summary.join('\n') || 'No specific patterns identified';
  }

  /**
   * Validate theme suggestions
   */
  private validateThemeSuggestions(
    suggestions: Array<{
      name?: string;
      businessValue?: string;
      description?: string;
      affectedFiles?: string[];
      confidence?: number;
    }>,
    semanticDiff: SemanticDiff
  ): ThemeSuggestion[] {
    const allFiles = new Set(semanticDiff.files.map((f) => f.path));
    const validated: ThemeSuggestion[] = [];

    for (const suggestion of suggestions) {
      if (!suggestion.name) continue;

      const affectedFiles = (suggestion.affectedFiles || []).filter((f) =>
        allFiles.has(f)
      );

      if (affectedFiles.length === 0) {
        // Skip themes with no valid files
        continue;
      }

      validated.push({
        name: this.trimToLimit(suggestion.name, 8),
        businessValue: this.trimToLimit(
          suggestion.businessValue || suggestion.name,
          12
        ),
        description: suggestion.description || suggestion.businessValue || '',
        affectedFiles,
        confidence: suggestion.confidence || 0.7,
      });
    }

    return validated;
  }

  /**
   * Trim text to word limit
   */
  private trimToLimit(text: string, maxWords: number): string {
    if (!text) return '';
    const words = text.split(/\s+/);
    if (words.length <= maxWords) {
      return text;
    }
    return words.join(' '); // Return ALL words
  }

  /**
   * Generate contextual explanation for code in a specific theme
   * PRD: "Same code shown differently based on usage context"
   */
  async generateContextualExplanation(
    code: CodeDiff,
    viewingNode: MindmapNode
  ): Promise<string> {
    const prompt = `
Explain what this code change means specifically for "${viewingNode.name}".

VIEWING CONTEXT:
Theme: ${viewingNode.name}
Business Purpose: ${viewingNode.businessContext}
Technical Purpose: ${viewingNode.technicalContext}

CODE CHANGE:
File: ${code.file}
${this.formatCompleteCodeDiff([code])}

Provide a brief, contextual explanation (max 20 words) of what this code does FOR THIS SPECIFIC THEME.
Focus on the relationship to the theme's purpose, not generic code description.`;

    try {
      const response = await this.claudeClient.callClaude(prompt);
      return this.trimToLimit(response.trim(), 20);
    } catch (error) {
      return `Changes for ${viewingNode.name}`;
    }
  }
}

// Type definitions for AI responses
interface DirectExpansionResponse {
  shouldExpand: boolean;
  isAtomic?: boolean;
  atomicReason?: string;
  confidence?: number;
  children?: Array<{
    name?: string;
    description?: string;
    businessValue?: string;
    technicalPurpose?: string;
    assignedCode?: Array<{
      file?: string;
      hunks?: Array<{
        oldStart?: number;
        oldLines?: number;
        newStart?: number;
        newLines?: number;
        changes?: Array<{
          type?: string;
          content?: string;
        }>;
      }>;
      ownership?: string;
    }>;
    rationale?: string;
    contextualMeaning?: string;
    suggestedCrossReferences?: Array<{
      targetTheme?: string;
      relationship?: string;
      reason?: string;
    }>;
  }>;
}

interface ThemeSuggestion {
  name: string;
  businessValue: string;
  description: string;
  affectedFiles: string[];
  confidence: number;
}
