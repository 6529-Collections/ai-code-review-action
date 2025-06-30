import {
  MindmapNode,
  NodeSuggestion,
  SemanticDiff,
  CodeSelection,
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
   * Determine if a node should be expanded further
   * PRD: "AI decides when further decomposition is needed"
   */
  async shouldExpandNode(
    node: MindmapNode,
    currentDepth: number
  ): Promise<ExpansionDecision> {
    const prompt = this.buildExpansionPrompt(node, currentDepth);

    try {
      const response = await this.claudeClient.callClaude(prompt);
      const result = JsonExtractor.extractAndValidateJson(response, 'object', [
        'shouldExpand',
        'atomicReason',
      ]);

      if (result.success) {
        const data = result.data as ExpansionDecisionResponse;

        // If should expand, get suggestions
        let suggestedChildren: NodeSuggestion[] | undefined;
        if (data.shouldExpand && data.suggestedChildren) {
          suggestedChildren = this.validateSuggestions(
            data.suggestedChildren,
            node
          );
        }

        return {
          shouldExpand: data.shouldExpand,
          isAtomic: data.isAtomic || false,
          atomicReason: data.atomicReason,
          suggestedChildren,
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
   * Build expansion prompt following PRD guidelines
   * Every node must be self-contained and understandable
   */
  private buildExpansionPrompt(
    node: MindmapNode,
    currentDepth: number
  ): string {
    const codePreview = this.formatCodePreview(node.codeDiff);
    const fileList = node.affectedFiles.join(', ');
    const lineCount =
      node.metrics.linesAdded +
      node.metrics.linesRemoved +
      node.metrics.linesModified;

    return `Analyze this code change node for natural decomposition into sub-themes.

CURRENT NODE:
Name: ${node.name}
Business Context: ${node.businessContext}
Technical Context: ${node.technicalContext}
Current Depth: ${currentDepth}
Metrics: ${lineCount} lines across ${node.metrics.fileCount} files
Files: ${fileList}

CODE CHANGES:
${codePreview}

QUESTION: Should this node be broken down into distinct sub-themes?

ATOMIC CRITERIA (Stop expansion when):
1. Single responsibility achieved (does exactly one thing)
2. Unit-testable as-is (typically 5-15 lines of focused change)
3. Further breakdown adds no clarity or value
4. Natural boundary reached (indivisible code unit)

EXPANSION CRITERIA (Continue expansion when):
1. Multiple distinct concerns exist that could be understood separately
2. Different functional areas are modified
3. Changes aren't independently testable at current level
4. Decomposition would improve code review clarity

${
  currentDepth >= 5
    ? `
NOTE: At depth ${currentDepth}, we're looking for very granular, atomic changes.
Only expand if there are truly distinct, separable concerns.`
    : ''
}

If expansion is recommended, suggest 2-5 child nodes that:
- Have clear, distinct purposes
- Are self-contained (understandable without parent context)
- Together cover ALL code in the parent node
- Don't overlap in functionality

CRITICAL: Respond with ONLY valid JSON:
{
  "shouldExpand": boolean,
  "isAtomic": boolean,
  "atomicReason": "if atomic, why? (max 15 words)",
  "confidence": 0.0-1.0,
  "suggestedChildren": [
    {
      "name": "Clear, specific title (max 8 words)",
      "businessValue": "User/business impact (max 12 words)",
      "technicalPurpose": "What code does (max 10 words)",
      "primaryFiles": ["files this child primarily owns"],
      "codeSelections": [
        {
          "file": "path/to/file.ts",
          "startLine": 45,
          "endLine": 67,
          "reason": "Why this code belongs here (max 15 words)"
        }
      ],
      "estimatedComplexity": "low|medium|high",
      "rationale": "Why separate from siblings (max 15 words)"
    }
  ] // null if shouldExpand is false
}`;
  }

  /**
   * Format code preview for prompt
   * Shows representative snippets without overwhelming
   */
  private formatCodePreview(codeDiffs: CodeDiff[]): string {
    const preview: string[] = [];
    let totalLines = 0;
    const maxLines = 50;

    for (const diff of codeDiffs) {
      if (totalLines >= maxLines) break;

      preview.push(`\n--- ${diff.file} ---`);

      for (const hunk of diff.hunks) {
        if (totalLines >= maxLines) break;

        const significantChanges = hunk.changes.filter(
          (c) => c.type !== 'context' || c.isKeyChange
        );

        for (const change of significantChanges.slice(0, 10)) {
          const prefix =
            change.type === 'add' ? '+' : change.type === 'delete' ? '-' : ' ';
          preview.push(`${prefix} ${change.content}`);
          totalLines++;

          if (totalLines >= maxLines) {
            preview.push('... (truncated)');
            break;
          }
        }
      }
    }

    return preview.join('\n');
  }

  /**
   * Validate and clean suggested children
   */
  private validateSuggestions(
    suggestions: Array<{
      name?: string;
      businessValue?: string;
      technicalPurpose?: string;
      primaryFiles?: string[];
      codeSelections?: Array<{
        file?: string;
        startLine?: number;
        endLine?: number;
        reason?: string;
      }>;
      estimatedComplexity?: 'low' | 'medium' | 'high';
      rationale?: string;
    }>,
    parentNode: MindmapNode
  ): NodeSuggestion[] {
    const validated: NodeSuggestion[] = [];
    const parentFiles = new Set(parentNode.affectedFiles);

    for (const suggestion of suggestions) {
      // Validate required fields
      if (!suggestion.name || !suggestion.technicalPurpose) {
        continue;
      }

      // Ensure suggested files are in parent's scope
      const primaryFiles = (suggestion.primaryFiles || []).filter((f) =>
        parentFiles.has(f)
      );

      if (primaryFiles.length === 0) {
        // Fallback to first parent file
        primaryFiles.push(parentNode.affectedFiles[0]);
      }

      // Validate code selections
      const codeSelections: CodeSelection[] = [];
      if (
        suggestion.codeSelections &&
        Array.isArray(suggestion.codeSelections)
      ) {
        for (const selection of suggestion.codeSelections) {
          if (selection.file && parentFiles.has(selection.file)) {
            codeSelections.push({
              file: selection.file,
              startLine: selection.startLine || 0,
              endLine: selection.endLine || 0,
              reason: selection.reason || 'Selected for this theme',
            });
          }
        }
      }

      validated.push({
        name: this.trimToLimit(suggestion.name, 8),
        businessValue: this.trimToLimit(
          suggestion.businessValue || suggestion.name,
          12
        ),
        technicalPurpose: this.trimToLimit(suggestion.technicalPurpose, 10),
        primaryFiles,
        codeSelections,
        estimatedComplexity: suggestion.estimatedComplexity || 'medium',
        rationale: this.trimToLimit(
          suggestion.rationale || 'Distinct concern',
          15
        ),
      });
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
    return words.slice(0, maxWords).join(' ');
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
${this.formatCodePreview([code])}

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
interface ExpansionDecision {
  shouldExpand: boolean;
  isAtomic: boolean;
  atomicReason?: string;
  suggestedChildren?: NodeSuggestion[];
  confidence: number;
}

interface ExpansionDecisionResponse {
  shouldExpand: boolean;
  isAtomic?: boolean;
  atomicReason?: string;
  confidence?: number;
  suggestedChildren?: Array<{
    name?: string;
    businessValue?: string;
    technicalPurpose?: string;
    primaryFiles?: string[];
    codeSelections?: Array<{
      file?: string;
      startLine?: number;
      endLine?: number;
      reason?: string;
    }>;
    estimatedComplexity?: 'low' | 'medium' | 'high';
    rationale?: string;
  }>;
}

interface ThemeSuggestion {
  name: string;
  businessValue: string;
  description: string;
  affectedFiles: string[];
  confidence: number;
}

interface CodeDiff {
  file: string;
  hunks: DiffHunk[];
  fileContext: FileContext;
  ownership: 'primary' | 'reference';
  contextualMeaning?: string;
}

interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  changes: LineChange[];
  semanticContext?: string;
}

interface LineChange {
  type: 'add' | 'delete' | 'context';
  lineNumber: number;
  content: string;
  isKeyChange?: boolean;
}

interface FileContext {
  functionName?: string;
  className?: string;
  namespace?: string;
  startLine: number;
  endLine: number;
  contextType: 'function' | 'class' | 'module' | 'config' | 'test';
}
