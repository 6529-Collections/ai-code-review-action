import { ConsolidatedTheme } from '../types/similarity-types';
import { ClaudeClient } from '../utils/claude-client';
import { JsonExtractor } from '../utils/json-extractor';
import { logInfo } from '../utils';

/**
 * Simplified AI-driven expansion decision service
 * Implements PRD vision: "AI decides when further decomposition is needed"
 */
export class AIExpansionDecisionService {
  private claudeClient: ClaudeClient;
  private decisionCache: Map<string, ExpansionDecision>;

  constructor(anthropicApiKey: string) {
    this.claudeClient = new ClaudeClient(anthropicApiKey);
    this.decisionCache = new Map();
  }

  /**
   * Main decision point: Should this theme be expanded?
   * Trusts AI to understand complexity from context, not metrics
   */
  async shouldExpandTheme(
    theme: ConsolidatedTheme,
    currentDepth: number,
    parentTheme?: ConsolidatedTheme,
    siblingThemes?: ConsolidatedTheme[]
  ): Promise<ExpansionDecision> {
    // Simple cache check
    const cacheKey = `${theme.id}_${currentDepth}`;
    if (this.decisionCache.has(cacheKey)) {
      return this.decisionCache.get(cacheKey)!;
    }

    // Basic guardrails
    if (this.isObviouslyAtomic(theme)) {
      const decision: ExpansionDecision = {
        shouldExpand: false,
        isAtomic: true,
        reasoning: 'Single small file change',
        suggestedSubThemes: null,
      };
      this.decisionCache.set(cacheKey, decision);
      return decision;
    }

    // Let AI decide based on full context
    const prompt = this.buildContextRichPrompt(
      theme,
      currentDepth,
      parentTheme,
      siblingThemes
    );
    const decision = await this.getAIDecision(prompt);

    this.decisionCache.set(cacheKey, decision);
    return decision;
  }

  /**
   * Build a context-rich prompt that helps AI make natural decisions
   */
  private buildContextRichPrompt(
    theme: ConsolidatedTheme,
    currentDepth: number,
    parentTheme?: ConsolidatedTheme,
    siblingThemes?: ConsolidatedTheme[]
  ): string {
    // Level-specific instructions
    const levelGuidance = this.getLevelSpecificGuidance(currentDepth);

    // Include actual code context
    const codeContext = this.formatCodeContext(theme);

    // Parent and sibling context to avoid duplication
    const hierarchyContext = this.formatHierarchyContext(
      parentTheme,
      siblingThemes
    );

    return `You are analyzing a code change to build a hierarchical mindmap.
This mindmap should naturally organize code from high-level business themes down to atomic, testable units.

CURRENT CONTEXT:
Theme: "${theme.name}"
Description: ${theme.description}
Current depth: ${currentDepth}
Files involved: ${theme.affectedFiles.length} files

${hierarchyContext}

${levelGuidance}

CODE CHANGES:
${codeContext}

DECISION NEEDED:
Should this theme be broken down into sub-themes?

CONSIDER:
1. Does this theme contain multiple distinct concerns that could be understood separately?
2. Would decomposition make the changes clearer and more reviewable?
3. Are there natural boundaries in the code that suggest separate sub-themes?
4. At this depth, what level of granularity is most helpful?

${
  currentDepth >= 3
    ? `
ATOMIC CHECK:
If this represents a single, focused change (5-15 lines, one responsibility, one test), 
mark it as atomic and don't expand further.`
    : ''
}

RESPOND WITH JSON:
{
  "shouldExpand": boolean,
  "isAtomic": boolean,
  "reasoning": "Clear explanation why (max 30 words)",
  "suggestedSubThemes": [
    {
      "name": "What this accomplishes (max 10 words)",
      "description": "What changes (max 20 words)",
      "files": ["relevant", "files"],
      "rationale": "Why this is a separate concern (max 15 words)"
    }
  ] or null if shouldExpand is false
}`;
  }

  /**
   * Get level-specific guidance for the AI
   */
  private getLevelSpecificGuidance(depth: number): string {
    if (depth === 0) {
      return `LEVEL GUIDANCE (Root Level):
- Focus on high-level business capabilities and user-facing features
- Each theme should represent a complete user story or business value
- Don't decompose into technical implementation details yet
- Think: "What would I tell a product manager about this change?"`;
    } else if (depth <= 2) {
      return `LEVEL GUIDANCE (Intermediate Level ${depth}):
- Balance business functionality with technical organization  
- Start identifying major technical components within business features
- Group related changes that would be reviewed together
- Think: "What would I tell a tech lead about this change?"`;
    } else {
      return `LEVEL GUIDANCE (Deep Level ${depth}):
- Focus on atomic, unit-testable changes
- Each theme should be a single responsibility
- Look for changes that could have one focused test
- Think: "What would I tell a developer implementing this specific piece?"`;
    }
  }

  /**
   * Format code context with actual diffs, not metrics
   */
  private formatCodeContext(theme: ConsolidatedTheme): string {
    // Show actual code snippets
    const snippets = theme.codeSnippets
      .slice(0, 3)
      .map((snippet, idx) => {
        const lines = snippet.split('\n').slice(0, 20); // First 20 lines
        return `--- Change ${idx + 1} ---
${lines.join('\n')}${lines.length >= 20 ? '\n... (truncated)' : ''}`;
      })
      .join('\n\n');

    // Add file structure context
    const fileStructure = this.analyzeFileStructure(theme.affectedFiles);

    return `FILES CHANGED:
${fileStructure}

SAMPLE CODE CHANGES:
${snippets || 'No code snippets available'}`;
  }

  /**
   * Analyze file structure to provide architectural context
   */
  private analyzeFileStructure(files: string[]): string {
    const grouped = new Map<string, string[]>();

    files.forEach((file) => {
      const category = this.categorizeFile(file);

      if (!grouped.has(category)) {
        grouped.set(category, []);
      }
      grouped.get(category)!.push(file);
    });

    return Array.from(grouped.entries())
      .map(
        ([category, fileList]) =>
          `${category}:\n${fileList.map((f) => `  - ${f}`).join('\n')}`
      )
      .join('\n\n');
  }

  /**
   * Categorize file by its apparent purpose
   */
  private categorizeFile(filepath: string): string {
    if (filepath.includes('.test.') || filepath.includes('.spec.'))
      return 'Tests';
    if (filepath.includes('/test/') || filepath.includes('/tests/'))
      return 'Tests';
    if (filepath.includes('config') || filepath.endsWith('.json'))
      return 'Configuration';
    if (filepath.includes('/components/') || filepath.includes('/ui/'))
      return 'UI Components';
    if (filepath.includes('/services/') || filepath.includes('/api/'))
      return 'Business Logic';
    if (filepath.includes('/utils/') || filepath.includes('/helpers/'))
      return 'Utilities';
    if (filepath.includes('/types/') || filepath.endsWith('.d.ts'))
      return 'Type Definitions';
    return 'Other';
  }

  /**
   * Format parent and sibling context to prevent duplication
   */
  private formatHierarchyContext(
    parentTheme?: ConsolidatedTheme,
    siblingThemes?: ConsolidatedTheme[]
  ): string {
    let context = '';

    if (parentTheme) {
      context += `PARENT THEME: "${parentTheme.name}"
Purpose: ${parentTheme.description}\n\n`;
    }

    if (siblingThemes && siblingThemes.length > 0) {
      context += `SIBLING THEMES (already identified at this level):
${siblingThemes.map((s) => `- "${s.name}": ${s.description}`).join('\n')}

Ensure suggested sub-themes don't duplicate these existing themes.\n\n`;
    }

    return context;
  }

  /**
   * Simple check for obviously atomic changes
   */
  private isObviouslyAtomic(theme: ConsolidatedTheme): boolean {
    // Single file with minimal changes
    if (theme.affectedFiles.length === 1) {
      const totalLines = theme.codeSnippets.join('\n').split('\n').length;
      return totalLines < 15;
    }
    return false;
  }

  /**
   * Get AI decision from Claude
   */
  private async getAIDecision(prompt: string): Promise<ExpansionDecision> {
    try {
      const response = await this.claudeClient.callClaude(prompt);

      const extractionResult = JsonExtractor.extractAndValidateJson(
        response,
        'object',
        ['shouldExpand', 'reasoning']
      );

      if (extractionResult.success) {
        const data = extractionResult.data as {
          shouldExpand?: boolean;
          isAtomic?: boolean;
          reasoning?: string;
          suggestedSubThemes?: Array<{
            name: string;
            description: string;
            files: string[];
            rationale: string;
          }>;
        };

        return {
          shouldExpand: data.shouldExpand ?? false,
          isAtomic: data.isAtomic ?? false,
          reasoning: data.reasoning ?? 'No reasoning provided',
          suggestedSubThemes: data.suggestedSubThemes || null,
        };
      }

      // Fallback on parsing error
      logInfo(
        `Failed to parse AI expansion decision: ${extractionResult.error}`
      );
      return {
        shouldExpand: false,
        isAtomic: false,
        reasoning: 'Failed to parse AI response',
        suggestedSubThemes: null,
      };
    } catch (error) {
      logInfo(`AI expansion decision failed: ${error}`);
      return {
        shouldExpand: false,
        isAtomic: false,
        reasoning: `AI analysis failed: ${error}`,
        suggestedSubThemes: null,
      };
    }
  }

  /**
   * Clear the decision cache
   */
  clearCache(): void {
    this.decisionCache.clear();
  }
}

/**
 * Simplified expansion decision structure
 */
export interface ExpansionDecision {
  shouldExpand: boolean;
  isAtomic: boolean;
  reasoning: string;
  suggestedSubThemes: Array<{
    name: string;
    description: string;
    files: string[];
    rationale: string;
  }> | null;
}
