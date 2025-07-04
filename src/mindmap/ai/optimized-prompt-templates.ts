import { PromptTemplates } from '../utils/prompt-templates';
import { PromptType } from './prompt-types';

/**
 * Optimized prompt templates with reduced token usage and improved consistency
 */
export class OptimizedPromptTemplates extends PromptTemplates {
  // Shared context snippets to avoid repetition
  private static readonly SHARED_CONTEXT = {
    JSON_INSTRUCTION: 'Respond with ONLY valid JSON starting with {',
    CONCISENESS: 'Be specific but concise',
    CONFIDENCE_SCALE: 'confidence: 0.0-1.0',
    FILE_CONTEXT: 'File: {{filename}}\nChanges:\n{{content}}',
  };

  // Shared examples that can be referenced
  private static readonly SHARED_EXAMPLES = {
    GOOD_THEME_NAMES: [
      'Remove demo functionality',
      'Improve code review automation',
      'Add pull request feedback',
    ],
    BAD_THEME_NAMES: [
      'Delete greeting parameter',
      'Add AI services',
      'Implement commenting system',
    ],
    EXACT_CHANGES: [
      "Changed branches from ['main'] to ['**']",
      'Added detailedDescription field to interface',
      'Removed _buildEnhancedAnalysisPrompt method',
    ],
  };

  /**
   * Get optimized prompt template by type
   */
  getOptimizedTemplate(promptType: PromptType): string {
    const templates: Record<PromptType, string> = {
      [PromptType.CODE_ANALYSIS]: this.getCodeAnalysisPrompt(),
      [PromptType.THEME_EXTRACTION]: this.getThemeExtractionPrompt(),
      [PromptType.SIMILARITY_CHECK]: this.getSimilarityCheckPrompt(),
      [PromptType.THEME_EXPANSION]: this.getThemeExpansionPrompt(),
      [PromptType.DOMAIN_EXTRACTION]: this.getDomainExtractionPrompt(),
      [PromptType.THEME_NAMING]: this.getThemeNamingPrompt(),
      [PromptType.BATCH_SIMILARITY]: this.getBatchSimilarityPrompt(),
      [PromptType.CROSS_LEVEL_SIMILARITY]: this.getCrossLevelSimilarityPrompt(),
    };

    return templates[promptType] || '';
  }

  private getCodeAnalysisPrompt(): string {
    return `Analyze code structure:
{{filename}} ({{changeType}})
Diff:
{{diffContent}}

Extract:
- functionsChanged: names added/modified/removed
- classesChanged: classes/interfaces/types/enums
- importsChanged: module names only
- fileType, isTestFile, isConfigFile
- architecturalPatterns, businessDomain (1 word)
- codeComplexity: low/medium/high
- semanticDescription: what changed

${OptimizedPromptTemplates.SHARED_CONTEXT.JSON_INSTRUCTION}`;
  }

  private getThemeExtractionPrompt(): string {
    return `{{context}}

${OptimizedPromptTemplates.SHARED_CONTEXT.FILE_CONTEXT}

Identify:
- Exact changes (before→after)
- Business purpose
- User impact

JSON fields (max words):
- themeName (10)
- description (20)
- detailedDescription (15/null)
- businessImpact (15)
- technicalSummary (12)
- keyChanges: 3 items (10 each)
- ${OptimizedPromptTemplates.SHARED_CONTEXT.CONFIDENCE_SCALE}
- codePattern (3)

${OptimizedPromptTemplates.SHARED_CONTEXT.JSON_INSTRUCTION}`;
  }

  private getSimilarityCheckPrompt(): string {
    return `Compare themes:

T1: {{theme1Name}}
{{theme1Description}}
Files: {{theme1Files}}

T2: {{theme2Name}}
{{theme2Description}}
Files: {{theme2Files}}

Should merge? Consider feature overlap, shared changes, clarity.

JSON:
- shouldMerge: boolean
- ${OptimizedPromptTemplates.SHARED_CONTEXT.CONFIDENCE_SCALE}
- reasoning: brief
- scores (0-1): name, description, pattern, business, semantic

${OptimizedPromptTemplates.SHARED_CONTEXT.JSON_INSTRUCTION}`;
  }

  private getThemeExpansionPrompt(): string {
    return `Theme: {{themeName}}
{{themeDescription}}
Files: {{affectedFiles}}

Find distinct sub-concerns.

JSON:
- shouldExpand: boolean
- ${OptimizedPromptTemplates.SHARED_CONTEXT.CONFIDENCE_SCALE}
- subThemes: [{name, description, businessValue, affectedComponents[], relatedFiles[]}]
- reasoning

${OptimizedPromptTemplates.SHARED_CONTEXT.JSON_INSTRUCTION}`;
  }

  private getDomainExtractionPrompt(): string {
    return `Group by domain:
{{themes}}

Domains: {{availableDomains}}

JSON:
- domains: [{domain, themes[], confidence, userValue}]

${OptimizedPromptTemplates.SHARED_CONTEXT.JSON_INSTRUCTION}`;
  }

  private getThemeNamingPrompt(): string {
    return `Name this theme (user-focused, 2-5 words):
Current: {{currentName}}
{{description}}
Changes: {{keyChanges}}

JSON:
- themeName
- alternativeNames: 2-3
- reasoning

${OptimizedPromptTemplates.SHARED_CONTEXT.JSON_INSTRUCTION}`;
  }

  private getBatchSimilarityPrompt(): string {
    return `Analyze pairs:
{{pairs}}

JSON:
- results: [{pairId, shouldMerge, confidence, scores: {name, description, pattern, business, semantic}}]

${OptimizedPromptTemplates.SHARED_CONTEXT.JSON_INSTRUCTION}`;
  }

  private getCrossLevelSimilarityPrompt(): string {
    return `Parent: {{parentTheme}}
Child: {{childTheme}}

JSON:
- relationship: parent_child|duplicate|none
- ${OptimizedPromptTemplates.SHARED_CONTEXT.CONFIDENCE_SCALE}
- action: keep_both|merge_into_parent|merge_into_child|make_sibling
- reasoning

${OptimizedPromptTemplates.SHARED_CONTEXT.JSON_INSTRUCTION}`;
  }

  /**
   * Dynamic context trimming to stay within token limits
   */
  trimContext(
    context: string,
    maxTokens: number,
    preserveKeys: string[] = []
  ): string {
    // Rough estimate: 1 token ≈ 4 characters
    const maxChars = maxTokens * 4;

    if (context.length <= maxChars) {
      return context;
    }

    // Preserve important keys
    const preserved: string[] = [];
    const remaining: string[] = [];

    const lines = context.split('\n');
    for (const line of lines) {
      const shouldPreserve = preserveKeys.some((key) =>
        line.toLowerCase().includes(key.toLowerCase())
      );

      if (shouldPreserve) {
        preserved.push(line);
      } else {
        remaining.push(line);
      }
    }

    // Build trimmed context
    let trimmed = preserved.join('\n');
    const remainingSpace = maxChars - trimmed.length - 50; // Buffer

    if (remainingSpace > 0) {
      const additionalContext = remaining.join('\n');
      if (additionalContext.length > remainingSpace) {
        trimmed +=
          '\n' +
          additionalContext.substring(0, remainingSpace) +
          '\n...(trimmed)';
      } else {
        trimmed += '\n' + additionalContext;
      }
    }

    return trimmed;
  }

  /**
   * Select most relevant examples based on context
   */
  selectExamples(
    promptType: PromptType,
    context: Record<string, any>,
    maxExamples: number = 2
  ): string[] {
    // TODO: Implement intelligent example selection based on context
    // For now, return empty array to save tokens
    return [];
  }

  /**
   * Optimize file content for prompts
   */
  optimizeFileContent(content: string, focusAreas?: string[]): string {
    const lines = content.split('\n');
    const optimized: string[] = [];
    let inRelevantSection = false;
    let contextLines = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check if line contains focus areas
      const isRelevant =
        focusAreas?.some((area) =>
          line.toLowerCase().includes(area.toLowerCase())
        ) || false;

      if (isRelevant) {
        inRelevantSection = true;
        contextLines = 3; // Include 3 lines of context after relevant line

        // Add previous line for context if not already added
        if (i > 0 && optimized[optimized.length - 1] !== lines[i - 1]) {
          optimized.push(lines[i - 1]);
        }
      }

      if (inRelevantSection || contextLines > 0) {
        optimized.push(line);
        if (!isRelevant) {
          contextLines--;
        }
      }

      // Always include diff markers
      if (
        line.startsWith('+') ||
        line.startsWith('-') ||
        line.startsWith('@@')
      ) {
        if (optimized[optimized.length - 1] !== line) {
          optimized.push(line);
        }
        inRelevantSection = true;
        contextLines = 2;
      }
    }

    return optimized.join('\n');
  }

  /**
   * Create a token-efficient prompt
   */
  createEfficientPrompt(
    template: string,
    variables: Record<string, any>,
    maxTokens: number = 3000
  ): string {
    // Optimize large variables
    const optimizedVars = { ...variables };

    // Trim file content if present
    if (optimizedVars.content && optimizedVars.content.length > 1000) {
      optimizedVars.content = this.optimizeFileContent(
        optimizedVars.content,
        optimizedVars.focusAreas
      );
    }

    // Include all files - AI needs complete context
    // No trimming needed for modern AI models

    // Replace variables
    let prompt = template;
    for (const [key, value] of Object.entries(optimizedVars)) {
      const placeholder = `{{${key}}}`;
      const replacement = Array.isArray(value)
        ? value.join(', ')
        : String(value);
      prompt = prompt.replace(new RegExp(placeholder, 'g'), replacement);
    }

    // Trim if still too long
    return this.trimContext(prompt, maxTokens);
  }
}
