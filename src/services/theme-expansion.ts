import { ConsolidatedTheme } from '../types/similarity-types';
import { GenericCache } from '../utils/generic-cache';
import { ClaudeClient } from '../utils/claude-client';
import { JsonExtractor } from '../utils/json-extractor';
import { CodeChange, SmartContext } from '../utils/ai-code-analyzer';
import { logInfo } from '../utils';
import {
  ConcurrencyManager,
  ConcurrencyOptions,
} from '../utils/concurrency-manager';

// Configuration for theme expansion
export interface ExpansionConfig {
  maxDepth: number; // Maximum hierarchy depth (default: 4)
  minComplexityScore: number; // Minimum complexity to warrant expansion (default: 0.7)
  minFilesForExpansion: number; // Minimum files required for expansion (default: 2)
  businessImpactThreshold: number; // Minimum business impact for expansion (default: 0.6)
  concurrencyLimit: number; // Maximum concurrent operations (default: 5)
  maxRetries: number; // Maximum retry attempts (default: 3)
  retryDelay: number; // Base retry delay in ms (default: 1000)
  retryBackoffMultiplier: number; // Backoff multiplier (default: 2)
  enableProgressLogging: boolean; // Enable progress logging (default: true)
}

export const DEFAULT_EXPANSION_CONFIG: ExpansionConfig = {
  maxDepth: 4,
  minComplexityScore: 0.7,
  minFilesForExpansion: 2,
  businessImpactThreshold: 0.6,
  concurrencyLimit: 5,
  maxRetries: 3,
  retryDelay: 1000,
  retryBackoffMultiplier: 2,
  enableProgressLogging: true,
};

export interface ExpansionCandidate {
  theme: ConsolidatedTheme;
  parentTheme?: ConsolidatedTheme;
  expansionReason: string;
  complexityScore: number;
  businessPatterns: string[];
}

export interface SubThemeAnalysis {
  subThemes: ConsolidatedTheme[];
  shouldExpand: boolean;
  confidence: number;
  reasoning: string;
  businessLogicPatterns: string[];
  userFlowPatterns: string[];
}

export interface ExpansionRequest {
  id: string;
  theme: ConsolidatedTheme;
  parentTheme?: ConsolidatedTheme;
  depth: number;
  context: ExpansionContext;
}

export interface ExpansionContext {
  relevantFiles: string[];
  codeChanges: CodeChange[];
  smartContext: SmartContext;
  businessScope: string;
  parentBusinessLogic?: string;
}

export interface ExpansionResult {
  requestId: string;
  success: boolean;
  expandedTheme?: ConsolidatedTheme;
  subThemes: ConsolidatedTheme[];
  error?: string;
  processingTime: number;
}

export class ThemeExpansionService {
  private claudeClient: ClaudeClient;
  private cache: GenericCache;
  private config: ExpansionConfig;

  constructor(anthropicApiKey: string, config: Partial<ExpansionConfig> = {}) {
    this.claudeClient = new ClaudeClient(anthropicApiKey);
    this.cache = new GenericCache(3600000); // 1 hour TTL
    this.config = { ...DEFAULT_EXPANSION_CONFIG, ...config };
  }

  /**
   * Process items concurrently with limit and retry logic
   */
  private async processConcurrentlyWithLimit<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    options?: {
      concurrencyLimit?: number;
      maxRetries?: number;
      retryDelay?: number;
      onProgress?: (completed: number, total: number) => void;
      onError?: (error: Error, item: T, retryCount: number) => void;
    }
  ): Promise<Array<R | { error: Error; item: T }>> {
    const concurrencyOptions: ConcurrencyOptions<T> = {
      concurrencyLimit:
        options?.concurrencyLimit || this.config.concurrencyLimit,
      maxRetries: options?.maxRetries || this.config.maxRetries,
      retryDelay: options?.retryDelay || this.config.retryDelay,
      retryBackoffMultiplier: this.config.retryBackoffMultiplier,
      onProgress:
        options?.onProgress && this.config.enableProgressLogging
          ? options.onProgress
          : undefined,
      onError: options?.onError,
      enableLogging: this.config.enableProgressLogging,
    };

    return ConcurrencyManager.processConcurrentlyWithLimit(
      items,
      processor,
      concurrencyOptions
    );
  }

  /**
   * Main entry point for expanding themes hierarchically
   */
  async expandThemesHierarchically(
    consolidatedThemes: ConsolidatedTheme[]
  ): Promise<ConsolidatedTheme[]> {
    console.log(
      `[DEBUG-EXPANSION] Starting hierarchical expansion of ${consolidatedThemes.length} themes`
    );
    console.log(
      `[DEBUG-EXPANSION] Input theme names: ${consolidatedThemes.map((t) => t.name).join(', ')}`
    );

    logInfo(
      `Starting hierarchical expansion of ${consolidatedThemes.length} themes`
    );

    // Process themes with concurrency limit and retry logic
    const results = await this.processConcurrentlyWithLimit(
      consolidatedThemes,
      (theme) => this.expandThemeRecursively(theme, 0),
      {
        onProgress: (completed, total) => {
          if (this.config.enableProgressLogging) {
            console.log(
              `[THEME-EXPANSION] Progress: ${completed}/${total} root themes expanded`
            );
          }
        },
        onError: (error, theme, retryCount) => {
          console.warn(
            `[THEME-EXPANSION] Retry ${retryCount} for theme "${theme.name}": ${error.message}`
          );
        },
      }
    );

    // Separate successful and failed results
    const expandedThemes: ConsolidatedTheme[] = [];
    const failedThemes: Array<{ theme: ConsolidatedTheme; error: Error }> = [];

    for (const result of results) {
      if ('error' in result) {
        failedThemes.push({ theme: result.item, error: result.error });
      } else {
        expandedThemes.push(result);
      }
    }

    if (failedThemes.length > 0) {
      console.warn(
        `[THEME-EXPANSION] Failed to expand ${failedThemes.length} themes after retries:`
      );
      for (const failed of failedThemes) {
        console.warn(`  - ${failed.theme.name}: ${failed.error.message}`);
      }
    }

    console.log(
      `[DEBUG-EXPANSION] Completed expansion with ${expandedThemes.length}/${consolidatedThemes.length} themes`
    );
    console.log(
      `[DEBUG-EXPANSION] Expanded theme names: ${expandedThemes.map((t) => t.name).join(', ')}`
    );

    logInfo(
      `Completed hierarchical expansion: ${expandedThemes.length}/${consolidatedThemes.length} themes processed successfully`
    );
    return expandedThemes;
  }

  /**
   * Recursively expand a theme to maximum depth
   */
  private async expandThemeRecursively(
    theme: ConsolidatedTheme,
    currentDepth: number,
    parentTheme?: ConsolidatedTheme
  ): Promise<ConsolidatedTheme> {
    // Check depth limit
    if (currentDepth >= this.config.maxDepth) {
      return theme;
    }

    // Check if theme is candidate for expansion
    const expansionCandidate = await this.evaluateExpansionCandidate(
      theme,
      parentTheme
    );
    if (!expansionCandidate) {
      // Still process existing child themes recursively
      const childResults = await this.processConcurrentlyWithLimit(
        theme.childThemes,
        (child: ConsolidatedTheme) =>
          this.expandThemeRecursively(child, currentDepth + 1, theme),
        {
          onProgress: (completed, total) => {
            if (this.config.enableProgressLogging && total > 1) {
              console.log(
                `[THEME-EXPANSION] Child themes progress: ${completed}/${total} for "${theme.name}"`
              );
            }
          },
        }
      );

      // Extract successful results, keep failed themes as fallback
      const expandedChildren: ConsolidatedTheme[] = [];
      for (const result of childResults) {
        if ('error' in result) {
          console.warn(
            `[THEME-EXPANSION] Failed to expand child theme: ${result.error.message}`
          );
          expandedChildren.push(result.item); // Keep original theme if expansion fails
        } else {
          expandedChildren.push(result);
        }
      }

      return { ...theme, childThemes: expandedChildren };
    }

    // Create expansion request
    const expansionRequest: ExpansionRequest = {
      id: `expansion_${theme.id}_${Date.now()}`,
      theme,
      parentTheme,
      depth: currentDepth,
      context: await this.buildExpansionContext(theme, parentTheme),
    };

    // Process expansion
    const result = await this.processExpansionRequest(expansionRequest);

    if (!result.success || !result.expandedTheme) {
      logInfo(`Expansion failed for theme ${theme.name}: ${result.error}`);
      return theme;
    }

    // Recursively expand new sub-themes
    const subThemeResults = await this.processConcurrentlyWithLimit(
      result.subThemes,
      (subTheme: ConsolidatedTheme) =>
        this.expandThemeRecursively(
          subTheme,
          currentDepth + 1,
          result.expandedTheme
        ),
      {
        onProgress: (completed, total) => {
          if (this.config.enableProgressLogging && total > 1) {
            console.log(
              `[THEME-EXPANSION] Sub-themes progress: ${completed}/${total} for "${theme.name}"`
            );
          }
        },
      }
    );

    // Extract successful sub-themes
    const expandedSubThemes: ConsolidatedTheme[] = [];
    for (const subResult of subThemeResults) {
      if ('error' in subResult) {
        console.warn(
          `[THEME-EXPANSION] Failed to expand sub-theme: ${subResult.error.message}`
        );
        expandedSubThemes.push(subResult.item); // Keep original if expansion fails
      } else {
        expandedSubThemes.push(subResult);
      }
    }

    // Also expand existing child themes
    const existingChildResults = await this.processConcurrentlyWithLimit(
      result.expandedTheme!.childThemes,
      (child: ConsolidatedTheme) =>
        this.expandThemeRecursively(
          child,
          currentDepth + 1,
          result.expandedTheme
        ),
      {
        onProgress: (completed, total) => {
          if (this.config.enableProgressLogging && total > 1) {
            console.log(
              `[THEME-EXPANSION] Existing children progress: ${completed}/${total} for "${theme.name}"`
            );
          }
        },
      }
    );

    // Extract successful existing children
    const expandedExistingChildren: ConsolidatedTheme[] = [];
    for (const childResult of existingChildResults) {
      if ('error' in childResult) {
        console.warn(
          `[THEME-EXPANSION] Failed to expand existing child: ${childResult.error.message}`
        );
        expandedExistingChildren.push(childResult.item); // Keep original if expansion fails
      } else {
        expandedExistingChildren.push(childResult);
      }
    }

    // Combine all child themes
    const allChildThemes = [...expandedExistingChildren, ...expandedSubThemes];

    // Deduplicate child themes using AI
    const deduplicatedChildren =
      await this.deduplicateSubThemes(allChildThemes);

    return {
      ...result.expandedTheme!,
      childThemes: deduplicatedChildren,
      isExpanded: true,
    };
  }

  /**
   * Evaluate if a theme is a candidate for expansion
   */
  private async evaluateExpansionCandidate(
    theme: ConsolidatedTheme,
    parentTheme?: ConsolidatedTheme
  ): Promise<ExpansionCandidate | null> {
    // Basic checks
    if (theme.affectedFiles.length < this.config.minFilesForExpansion) {
      return null;
    }

    // Calculate complexity score based on various factors
    const complexityScore = this.calculateComplexityScore(theme);
    if (complexityScore < this.config.minComplexityScore) {
      return null;
    }

    // Analyze business patterns
    const businessPatterns = await this.identifyBusinessPatterns(theme);
    if (businessPatterns.length < 2) {
      return null; // Need at least 2 distinct patterns for expansion
    }

    return {
      theme,
      parentTheme,
      expansionReason: `Complex theme with ${businessPatterns.length} business patterns`,
      complexityScore,
      businessPatterns,
    };
  }

  /**
   * Calculate complexity score for expansion candidacy
   */
  private calculateComplexityScore(theme: ConsolidatedTheme): number {
    let score = 0;

    // File count factor (normalized)
    score += Math.min(theme.affectedFiles.length / 10, 0.3);

    // Description length factor (complexity often correlates with description length)
    score += Math.min(theme.description.length / 500, 0.2);

    // Business impact factor
    score += Math.min(theme.businessImpact.length / 300, 0.2);

    // Code snippets diversity
    score += Math.min(theme.codeSnippets.length / 20, 0.15);

    // Child theme count (existing complexity)
    score += Math.min(theme.childThemes.length / 5, 0.15);

    return Math.min(score, 1.0);
  }

  /**
   * Deduplicate sub-themes using AI to identify duplicates
   */
  private async deduplicateSubThemes(
    subThemes: ConsolidatedTheme[]
  ): Promise<ConsolidatedTheme[]> {
    if (subThemes.length <= 1) {
      return subThemes;
    }

    logInfo(`Deduplicating ${subThemes.length} sub-themes using AI`);

    // Process in batches of 4-8 themes
    const batchSize = 6;
    const batches: ConsolidatedTheme[][] = [];

    for (let i = 0; i < subThemes.length; i += batchSize) {
      batches.push(subThemes.slice(i, i + batchSize));
    }

    // Process each batch with concurrency limit
    const deduplicationResults = await this.processConcurrentlyWithLimit(
      batches,
      (batch) => this.deduplicateBatch(batch),
      {
        onProgress: (completed, total) => {
          if (this.config.enableProgressLogging && total > 1) {
            console.log(
              `[THEME-EXPANSION] Deduplication progress: ${completed}/${total} batches`
            );
          }
        },
      }
    );

    // Extract successful results
    const successfulResults: ConsolidatedTheme[][][] = [];
    for (const result of deduplicationResults) {
      if ('error' in result) {
        console.warn(
          `[THEME-EXPANSION] Deduplication batch failed: ${result.error.message}`
        );
        // For failed batches, we could return the original batch as fallback
        // but for now, we'll skip failed batches
      } else {
        successfulResults.push(result);
      }
    }

    // Flatten and combine results
    const allGroups = successfulResults.flat();

    // Merge groups that span batches
    const finalThemes: ConsolidatedTheme[] = [];
    const processedIds = new Set<string>();

    for (const group of allGroups) {
      if (group.length === 1) {
        // Single theme, no duplicates
        if (!processedIds.has(group[0].id)) {
          finalThemes.push(group[0]);
          processedIds.add(group[0].id);
        }
      } else {
        // Multiple themes to merge
        const unprocessedThemes = group.filter((t) => !processedIds.has(t.id));
        if (unprocessedThemes.length > 0) {
          const mergedTheme = await this.mergeSubThemes(unprocessedThemes);
          finalThemes.push(mergedTheme);
          unprocessedThemes.forEach((t) => processedIds.add(t.id));
        }
      }
    }

    logInfo(
      `Deduplication complete: ${subThemes.length} themes → ${finalThemes.length} themes`
    );

    // Second pass: check if any of the final themes are still duplicates
    // This handles cases where duplicates were in different batches
    if (finalThemes.length > 1) {
      logInfo(
        `Running second pass deduplication on ${finalThemes.length} themes`
      );
      const secondPassResult =
        await this.runSecondPassDeduplication(finalThemes);
      logInfo(
        `Second pass complete: ${finalThemes.length} themes → ${secondPassResult.length} themes`
      );
      return secondPassResult;
    }

    return finalThemes;
  }

  /**
   * Run a second pass to catch duplicates that were in different batches
   */
  private async runSecondPassDeduplication(
    themes: ConsolidatedTheme[]
  ): Promise<ConsolidatedTheme[]> {
    // Create a single batch with all themes for comprehensive comparison
    const prompt = `
These themes have already been deduplicated within their groups, but there might still be duplicates across groups.
Please do a final check to identify any remaining duplicates:

${themes
  .map(
    (theme, index) => `
Theme ${index + 1}: "${theme.name}"
Description: ${theme.description}
${theme.detailedDescription ? `Details: ${theme.detailedDescription}` : ''}
Files: ${theme.affectedFiles.join(', ')}
`
  )
  .join('\n')}

Only identify themes that are CLEARLY duplicates. Be conservative.

CRITICAL: Respond with ONLY valid JSON.

{
  "duplicateGroups": [
    {
      "themeIndices": [1, 4],
      "reasoning": "Both implement the exact same testing configuration change"
    }
  ]
}

If no duplicates found, return: {"duplicateGroups": []}`;

    try {
      const response = await this.claudeClient.callClaude(prompt);
      const extractionResult = JsonExtractor.extractAndValidateJson(
        response,
        'object',
        ['duplicateGroups']
      );

      if (!extractionResult.success) {
        // No duplicates found or parsing failed
        return themes;
      }

      const data = extractionResult.data as {
        duplicateGroups?: Array<{
          themeIndices: number[];
          reasoning: string;
        }>;
      };

      if (!data.duplicateGroups || data.duplicateGroups.length === 0) {
        return themes;
      }

      // Process duplicate groups
      const finalThemes: ConsolidatedTheme[] = [];
      const processedIndices = new Set<number>();

      for (const group of data.duplicateGroups) {
        const duplicateThemes: ConsolidatedTheme[] = [];

        for (const index of group.themeIndices) {
          if (
            index >= 1 &&
            index <= themes.length &&
            !processedIndices.has(index - 1)
          ) {
            duplicateThemes.push(themes[index - 1]);
            processedIndices.add(index - 1);
          }
        }

        if (duplicateThemes.length > 1) {
          const mergedTheme = await this.mergeSubThemes(duplicateThemes);
          finalThemes.push(mergedTheme);
        } else if (duplicateThemes.length === 1) {
          finalThemes.push(duplicateThemes[0]);
        }
      }

      // Add themes that weren't in any duplicate group
      themes.forEach((theme, index) => {
        if (!processedIndices.has(index)) {
          finalThemes.push(theme);
        }
      });

      return finalThemes;
    } catch (error) {
      logInfo(`Second pass deduplication failed: ${error}`);
      return themes;
    }
  }

  /**
   * Process a batch of themes for deduplication
   */
  private async deduplicateBatch(
    themes: ConsolidatedTheme[]
  ): Promise<ConsolidatedTheme[][]> {
    const prompt = `
Analyze these sub-themes and identify which ones describe the same change or functionality:

${themes
  .map(
    (theme, index) => `
Theme ${index + 1}: "${theme.name}"
Description: ${theme.description}
${theme.detailedDescription ? `Details: ${theme.detailedDescription}` : ''}
Files: ${theme.affectedFiles.join(', ')}
${theme.keyChanges ? `Key changes: ${theme.keyChanges.join('; ')}` : ''}
`
  )
  .join('\n')}

Questions:
1. Which themes are describing the same change (even if worded differently)?
2. Group duplicate themes together
3. For each group, explain why they are duplicates

CRITICAL: Respond with ONLY valid JSON.

{
  "groups": [
    {
      "themeIndices": [1, 3],
      "reasoning": "Both themes describe the same CI workflow change"
    },
    {
      "themeIndices": [2],
      "reasoning": "Unique theme about type definitions"
    }
  ]
}`;

    try {
      const response = await this.claudeClient.callClaude(prompt);
      const extractionResult = JsonExtractor.extractAndValidateJson(
        response,
        'object',
        ['groups']
      );

      if (!extractionResult.success) {
        logInfo(
          `Failed to parse deduplication response: ${extractionResult.error}`
        );
        // Return each theme as its own group
        return themes.map((theme) => [theme]);
      }

      const data = extractionResult.data as {
        groups?: Array<{
          themeIndices: number[];
          reasoning: string;
        }>;
      };

      // Convert indices to theme groups
      const groups: ConsolidatedTheme[][] = [];
      const processedIndices = new Set<number>();

      if (data.groups) {
        for (const group of data.groups) {
          const themeGroup: ConsolidatedTheme[] = [];
          for (const index of group.themeIndices) {
            if (
              index >= 1 &&
              index <= themes.length &&
              !processedIndices.has(index - 1)
            ) {
              themeGroup.push(themes[index - 1]);
              processedIndices.add(index - 1);
            }
          }
          if (themeGroup.length > 0) {
            groups.push(themeGroup);
          }
        }
      }

      // Add any themes not in groups
      themes.forEach((theme, index) => {
        if (!processedIndices.has(index)) {
          groups.push([theme]);
        }
      });

      return groups;
    } catch (error) {
      logInfo(`Deduplication batch failed: ${error}`);
      // Return each theme as its own group
      return themes.map((theme) => [theme]);
    }
  }

  /**
   * Merge duplicate sub-themes into a single theme
   */
  private async mergeSubThemes(
    themes: ConsolidatedTheme[]
  ): Promise<ConsolidatedTheme> {
    if (themes.length === 1) {
      return themes[0];
    }

    const prompt = `
These themes have been identified as duplicates describing the same change:

${themes
  .map(
    (theme, index) => `
Theme ${index + 1}: "${theme.name}"
Description: ${theme.description}
${theme.detailedDescription ? `Details: ${theme.detailedDescription}` : ''}
${theme.technicalSummary ? `Technical: ${theme.technicalSummary}` : ''}
`
  )
  .join('\n')}

Create a single, unified theme that best represents this change. Combine the best aspects of each description.

CRITICAL: Respond with ONLY valid JSON.

{
  "name": "unified theme name",
  "description": "clear, comprehensive description",
  "detailedDescription": "detailed explanation combining all relevant details",
  "reasoning": "why this unified version is better"
}`;

    try {
      const response = await this.claudeClient.callClaude(prompt);
      const extractionResult = JsonExtractor.extractAndValidateJson(
        response,
        'object',
        ['name', 'description']
      );

      if (!extractionResult.success) {
        // Use the first theme as fallback
        return themes[0];
      }

      const data = extractionResult.data as {
        name?: string;
        description?: string;
        detailedDescription?: string;
        reasoning?: string;
      };

      // Combine all data from duplicate themes
      const allFiles = new Set<string>();
      const allSnippets: string[] = [];
      const allKeyChanges: string[] = [];
      let totalConfidence = 0;

      themes.forEach((theme) => {
        theme.affectedFiles.forEach((file) => allFiles.add(file));
        allSnippets.push(...theme.codeSnippets);
        if (theme.keyChanges) allKeyChanges.push(...theme.keyChanges);
        totalConfidence += theme.confidence;
      });

      return {
        ...themes[0], // Use first theme as base
        id: `dedup-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        name: data.name || themes[0].name,
        description: data.description || themes[0].description,
        detailedDescription: data.detailedDescription,
        affectedFiles: Array.from(allFiles),
        codeSnippets: allSnippets,
        keyChanges: [...new Set(allKeyChanges)], // Deduplicate key changes
        confidence: totalConfidence / themes.length,
        sourceThemes: themes.flatMap((t) => t.sourceThemes),
        consolidationMethod: 'merge' as const,
        consolidationSummary: `Deduplicated ${themes.length} similar sub-themes: ${data.reasoning || 'Identified as duplicates'}`,
      };
    } catch (error) {
      logInfo(`Sub-theme merge failed: ${error}`);
      return themes[0]; // Use first theme as fallback
    }
  }

  /**
   * Identify distinct business patterns within a theme
   */
  private async identifyBusinessPatterns(
    theme: ConsolidatedTheme
  ): Promise<string[]> {
    const cacheKey = `business_patterns_${theme.id}`;
    const cached = this.cache.get(cacheKey);

    if (cached) {
      return cached as string[];
    }

    const prompt = `
Analyze this code theme for distinct business logic patterns and user flows:

Theme: ${theme.name}
Description: ${theme.description}
Business Impact: ${theme.businessImpact}
Affected Files: ${theme.affectedFiles.join(', ')}

Code Context:
${theme.codeSnippets.slice(0, 3).join('\n---\n')}

Identify distinct business patterns within this theme. Look for:
1. Different user interaction flows
2. Separate business logic concerns
3. Distinct functional areas
4. Different data processing patterns
5. Separate integration points

Return a JSON array of distinct business pattern names (max 6):
["pattern1", "pattern2", ...]

Focus on business value, not technical implementation details.
`;

    try {
      const response = await this.claudeClient.callClaude(prompt);

      const extractionResult = JsonExtractor.extractAndValidateJson(
        response,
        'array',
        undefined
      );

      if (!extractionResult.success) {
        logInfo(
          `Failed to parse business patterns for ${theme.name}: ${extractionResult.error}`
        );
        return [];
      }

      const patterns = extractionResult.data as string[];

      this.cache.set(cacheKey, patterns, 3600000); // Cache for 1 hour
      return patterns;
    } catch (error) {
      logInfo(
        `Failed to identify business patterns for ${theme.name}: ${error}`
      );
      return [];
    }
  }

  /**
   * Build expansion context for AI analysis
   */
  private async buildExpansionContext(
    theme: ConsolidatedTheme,
    parentTheme?: ConsolidatedTheme
  ): Promise<ExpansionContext> {
    return {
      relevantFiles: theme.affectedFiles,
      codeChanges: [], // Would be populated from theme context
      smartContext: {} as SmartContext, // Would be populated from theme context
      businessScope: theme.businessImpact,
      parentBusinessLogic: parentTheme?.businessImpact,
    };
  }

  /**
   * Process a single expansion request
   */
  private async processExpansionRequest(
    request: ExpansionRequest
  ): Promise<ExpansionResult> {
    const startTime = Date.now();

    try {
      const analysis = await this.analyzeThemeForSubThemes(request);

      if (analysis.shouldExpand && analysis.subThemes.length > 0) {
        // Create expanded theme with new sub-themes
        const expandedTheme: ConsolidatedTheme = {
          ...request.theme,
          childThemes: [...request.theme.childThemes, ...analysis.subThemes],
        };

        return {
          requestId: request.id,
          success: true,
          expandedTheme,
          subThemes: analysis.subThemes,
          processingTime: Date.now() - startTime,
        };
      } else {
        return {
          requestId: request.id,
          success: true,
          expandedTheme: request.theme,
          subThemes: [],
          processingTime: Date.now() - startTime,
        };
      }
    } catch (error) {
      return {
        requestId: request.id,
        success: false,
        subThemes: [],
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Analyze theme for potential sub-themes using AI
   */
  private async analyzeThemeForSubThemes(
    request: ExpansionRequest
  ): Promise<SubThemeAnalysis> {
    const { theme, parentTheme, depth } = request;

    const prompt = `
Analyze this code theme for potential sub-theme expansion:

THEME TO ANALYZE:
Name: ${theme.name}
Description: ${theme.description}
Business Impact: ${theme.businessImpact}
Current Level: ${theme.level}
Expansion Depth: ${depth}
Files: ${theme.affectedFiles.join(', ')}

${
  parentTheme
    ? `PARENT THEME CONTEXT:
Name: ${parentTheme.name}
Business Logic: ${parentTheme.businessImpact}`
    : ''
}

CODE CONTEXT:
${theme.codeSnippets.slice(0, 5).join('\n---\n')}

ANALYSIS TASK:
Determine if this theme contains distinct sub-patterns that warrant separate sub-themes.
Focus on:
1. Business logic separation (different business rules/processes)
2. User flow distinction (different user interaction patterns)
3. Functional area separation (different system responsibilities)
4. Data processing patterns (different data handling approaches)

EXPANSION CRITERIA:
- Sub-themes must have distinct business value
- Each sub-theme should represent a coherent business concept
- Avoid technical implementation splitting
- Maintain file scope relevance
- Ensure no duplication with parent or sibling themes

Return JSON:
{
  "shouldExpand": boolean,
  "confidence": number (0-1),
  "reasoning": "explanation of decision",
  "businessLogicPatterns": ["pattern1", "pattern2"],
  "userFlowPatterns": ["flow1", "flow2"],
  "subThemes": [
    {
      "name": "Sub-theme name",
      "description": "Business-focused description",
      "businessImpact": "User/business value",
      "relevantFiles": ["file1.ts", "file2.ts"],
      "confidence": number (0-1)
    }
  ]
}

Only create sub-themes if there are genuinely distinct business concerns.
`;

    try {
      const response = await this.claudeClient.callClaude(prompt);

      const extractionResult = JsonExtractor.extractAndValidateJson(
        response,
        'object',
        ['shouldExpand', 'confidence', 'reasoning', 'subThemes']
      );

      if (!extractionResult.success) {
        logInfo(
          `Failed to parse expansion analysis for ${theme.name}: ${extractionResult.error}`
        );
        // Return no expansion
        return {
          subThemes: [],
          shouldExpand: false,
          confidence: 0.3,
          reasoning: `Analysis parsing failed: ${extractionResult.error}`,
          businessLogicPatterns: [],
          userFlowPatterns: [],
        };
      }

      const analysis = extractionResult.data as {
        shouldExpand?: boolean;
        confidence?: number;
        reasoning?: string;
        businessLogicPatterns?: string[];
        userFlowPatterns?: string[];
        subThemes?: Array<{
          name: string;
          description: string;
          businessImpact: string;
          relevantFiles: string[];
          confidence: number;
        }>;
      };

      // Convert to ConsolidatedTheme objects
      const subThemes: ConsolidatedTheme[] = (analysis.subThemes || []).map(
        (
          subTheme: {
            name: string;
            description: string;
            businessImpact: string;
            relevantFiles: string[];
            confidence: number;
          },
          index: number
        ) => ({
          id: `${theme.id}_sub_${index}_${Date.now()}`,
          name: subTheme.name,
          description: subTheme.description,
          level: theme.level + 1,
          parentId: theme.id,
          childThemes: [],
          affectedFiles: subTheme.relevantFiles.filter((file: string) =>
            theme.affectedFiles.includes(file)
          ),
          confidence: subTheme.confidence,
          businessImpact: subTheme.businessImpact,
          codeSnippets: theme.codeSnippets.filter((snippet) =>
            subTheme.relevantFiles.some((file: string) =>
              snippet.includes(file)
            )
          ),
          context: theme.context,
          lastAnalysis: new Date(),
          sourceThemes: [theme.id],
          consolidationMethod: 'hierarchy' as const,
        })
      );

      return {
        subThemes,
        shouldExpand: (analysis.shouldExpand || false) && subThemes.length > 0,
        confidence: analysis.confidence || 0.5,
        reasoning: analysis.reasoning || 'No reasoning provided',
        businessLogicPatterns: analysis.businessLogicPatterns || [],
        userFlowPatterns: analysis.userFlowPatterns || [],
      };
    } catch (error) {
      logInfo(`AI analysis failed for theme ${theme.name}: ${error}`);
      return {
        subThemes: [],
        shouldExpand: false,
        confidence: 0,
        reasoning: `Analysis failed: ${error}`,
        businessLogicPatterns: [],
        userFlowPatterns: [],
      };
    }
  }
}
