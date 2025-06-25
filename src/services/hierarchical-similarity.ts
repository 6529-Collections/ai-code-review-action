import { ConsolidatedTheme } from '../types/similarity-types';
import {
  CrossLevelSimilarity,
  DeduplicationResult,
} from '../types/expansion-types';
import { GenericCache } from '../utils/generic-cache';
import { ClaudeClient } from '../utils/claude-client';
import { JsonExtractor } from '../utils/json-extractor';
import { logInfo } from '../utils';

/**
 * Enhanced similarity service for multi-level theme hierarchies
 * Handles cross-level duplicate detection and hierarchy optimization
 */
export class HierarchicalSimilarityService {
  private claudeClient: ClaudeClient;
  private cache: GenericCache;

  constructor(anthropicApiKey: string) {
    this.claudeClient = new ClaudeClient(anthropicApiKey);
    this.cache = new GenericCache(1800000); // 30 minutes TTL
  }

  /**
   * Analyze similarity across multiple hierarchy levels
   * Identifies potential duplicates, overlaps, and optimization opportunities
   */
  async analyzeCrossLevelSimilarity(
    hierarchy: ConsolidatedTheme[]
  ): Promise<CrossLevelSimilarity[]> {
    logInfo('Starting cross-level similarity analysis');

    const allThemes = this.flattenHierarchy(hierarchy);
    const comparisons: CrossLevelSimilarityRequest[] = [];

    // Generate all cross-level comparison pairs
    for (let i = 0; i < allThemes.length; i++) {
      for (let j = i + 1; j < allThemes.length; j++) {
        const theme1 = allThemes[i];
        const theme2 = allThemes[j];

        // Only compare themes at different levels or with different parents
        if (this.shouldCompareThemes(theme1, theme2)) {
          comparisons.push({
            id: `cross_${theme1.id}_${theme2.id}`,
            theme1,
            theme2,
            levelDifference: Math.abs(theme1.level - theme2.level),
          });
        }
      }
    }

    logInfo(`Generated ${comparisons.length} cross-level comparisons`);

    if (comparisons.length > 100) {
      logInfo(
        `WARNING: Too many comparisons (${comparisons.length}), this may cause performance issues`
      );
    }

    // Process comparisons directly
    console.log(
      `[HIERARCHICAL] Starting ${comparisons.length} parallel Claude API calls`
    );
    const results = await Promise.all(
      comparisons.map((comparison, index) => {
        console.log(
          `[HIERARCHICAL] Starting comparison ${index + 1}/${comparisons.length}`
        );
        return this.analyzeCrossLevelSimilarityPair(comparison);
      })
    );

    logInfo(
      `Completed cross-level similarity analysis: ${results.length} results`
    );
    return results;
  }

  /**
   * Deduplicate themes across hierarchy levels
   */
  async deduplicateHierarchy(
    hierarchy: ConsolidatedTheme[]
  ): Promise<DeduplicationResult> {
    const crossLevelSimilarities =
      await this.analyzeCrossLevelSimilarity(hierarchy);

    // Filter for high-similarity themes that should be merged
    const duplicates = crossLevelSimilarities.filter(
      (similarity) =>
        similarity.similarityScore > 0.85 &&
        ['duplicate', 'overlap'].includes(similarity.relationshipType)
    );

    const mergedThemes: DeduplicationResult['mergedThemes'] = [];
    const processedIds = new Set<string>();
    let duplicatesRemoved = 0;
    let overlapsResolved = 0;

    for (const duplicate of duplicates) {
      if (
        processedIds.has(duplicate.theme1.id) ||
        processedIds.has(duplicate.theme2.id)
      ) {
        continue; // Already processed
      }

      const mergedTheme = this.mergeThemes(
        duplicate.theme1,
        duplicate.theme2,
        duplicate.action
      );

      mergedThemes.push({
        sourceIds: [duplicate.theme1.id, duplicate.theme2.id],
        targetTheme: mergedTheme,
        mergeReason: duplicate.reasoning,
      });

      processedIds.add(duplicate.theme1.id);
      processedIds.add(duplicate.theme2.id);

      if (duplicate.relationshipType === 'duplicate') {
        duplicatesRemoved++;
      } else {
        overlapsResolved++;
      }
    }

    const originalCount = this.countThemes(hierarchy);
    const deduplicatedHierarchy = this.applyMerges(hierarchy);
    const deduplicatedCount = this.countThemes(deduplicatedHierarchy);

    return {
      originalCount,
      deduplicatedCount,
      mergedThemes,
      duplicatesRemoved,
      overlapsResolved,
    };
  }

  /**
   * Validate hierarchy integrity after expansion
   */
  validateHierarchyIntegrity(hierarchy: ConsolidatedTheme[]): boolean {
    const allThemes = this.flattenHierarchy(hierarchy);
    const themeIds = new Set(allThemes.map((t) => t.id));

    // Check for orphaned themes
    for (const theme of allThemes) {
      if (theme.parentId && !themeIds.has(theme.parentId)) {
        logInfo(
          `Found orphaned theme: ${theme.name} (parent ${theme.parentId} not found)`
        );
        return false;
      }
    }

    // Check for circular references
    for (const theme of allThemes) {
      if (this.hasCircularReference(theme, allThemes)) {
        logInfo(`Found circular reference in theme: ${theme.name}`);
        return false;
      }
    }

    // Check level consistency
    for (const theme of allThemes) {
      if (theme.parentId) {
        const parent = allThemes.find((t) => t.id === theme.parentId);
        if (parent && theme.level !== parent.level + 1) {
          logInfo(
            `Level inconsistency: ${theme.name} level ${theme.level}, parent level ${parent.level}`
          );
          return false;
        }
      }
    }

    return true;
  }

  // Private helper methods

  private flattenHierarchy(
    hierarchy: ConsolidatedTheme[]
  ): ConsolidatedTheme[] {
    const flattened: ConsolidatedTheme[] = [];

    const traverse = (themes: ConsolidatedTheme[]): void => {
      for (const theme of themes) {
        flattened.push(theme);
        if (theme.childThemes.length > 0) {
          traverse(theme.childThemes);
        }
      }
    };

    traverse(hierarchy);
    return flattened;
  }

  private shouldCompareThemes(
    theme1: ConsolidatedTheme,
    theme2: ConsolidatedTheme
  ): boolean {
    // Don't compare themes at the same level with the same parent
    if (theme1.level === theme2.level && theme1.parentId === theme2.parentId) {
      return false;
    }

    // Don't compare parent-child relationships
    if (theme1.parentId === theme2.id || theme2.parentId === theme1.id) {
      return false;
    }

    // Don't compare themes that are too far apart in the hierarchy
    const levelDifference = Math.abs(theme1.level - theme2.level);
    if (levelDifference > 1) {
      return false;
    }

    return true;
  }

  private async analyzeCrossLevelSimilarityPair(
    request: CrossLevelSimilarityRequest
  ): Promise<CrossLevelSimilarity> {
    const { theme1, theme2, levelDifference } = request;

    const cacheKey = `cross_level_${theme1.id}_${theme2.id}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached as CrossLevelSimilarity;
    }

    const prompt = `
Analyze these two themes from different hierarchy levels for similarity and relationship:

THEME 1:
Level: ${theme1.level}
Name: ${theme1.name}
Description: ${theme1.description}
Business Impact: ${theme1.businessImpact}
Files: ${theme1.affectedFiles.join(', ')}
Parent: ${theme1.parentId || 'None'}

THEME 2:
Level: ${theme2.level}
Name: ${theme2.name}
Description: ${theme2.description}
Business Impact: ${theme2.businessImpact}
Files: ${theme2.affectedFiles.join(', ')}
Parent: ${theme2.parentId || 'None'}

Level Difference: ${levelDifference}

ANALYSIS TASK:
Determine the relationship between these themes across hierarchy levels:

1. SIMILARITY SCORE (0-1): How similar are these themes in business purpose?
2. RELATIONSHIP TYPE: 
   - "duplicate": Essentially the same theme (should be merged)
   - "overlap": Significant overlap in scope (should be consolidated)
   - "related": Related but distinct (keep separate)
   - "distinct": Completely different themes

3. MERGE ACTION:
   - "merge_up": Merge into higher-level theme
   - "merge_down": Merge into lower-level theme
   - "merge_sibling": Merge at same level under common parent
   - "keep_separate": Keep as separate themes

Return JSON:
{
  "similarityScore": number (0-1),
  "relationshipType": "duplicate|overlap|related|distinct",
  "action": "merge_up|merge_down|merge_sibling|keep_separate",
  "confidence": number (0-1),
  "reasoning": "detailed explanation of decision"
}

Focus on business value and avoid merging themes with distinct business purposes.
`;

    try {
      console.log(
        `[HIERARCHICAL] Making Claude call for themes: ${theme1.name} vs ${theme2.name}`
      );
      const response = await this.claudeClient.callClaude(prompt);
      console.log(`[HIERARCHICAL] Got response length: ${response.length}`);

      const extractionResult = JsonExtractor.extractAndValidateJson(
        response,
        'object',
        [
          'similarityScore',
          'relationshipType',
          'action',
          'confidence',
          'reasoning',
        ]
      );

      if (!extractionResult.success) {
        console.warn(
          `[HIERARCHICAL] Failed to parse AI response: ${extractionResult.error}`
        );
        console.debug(
          `[HIERARCHICAL] Original response: ${extractionResult.originalResponse?.substring(0, 200)}...`
        );

        // Return conservative default
        const fallbackResult: CrossLevelSimilarity = {
          theme1,
          theme2,
          levelDifference,
          similarityScore: 0.2,
          relationshipType: 'distinct',
          action: 'keep_separate',
          confidence: 0.3,
          reasoning: `AI response parsing failed: ${extractionResult.error}`,
        };

        this.cache.set(cacheKey, fallbackResult, 1800000); // Cache for 30 minutes
        return fallbackResult;
      }

      const analysis = extractionResult.data as {
        similarityScore?: number;
        relationshipType?: 'duplicate' | 'overlap' | 'related' | 'distinct';
        action?: 'merge_up' | 'merge_down' | 'merge_sibling' | 'keep_separate';
        confidence?: number;
        reasoning?: string;
      };

      const result: CrossLevelSimilarity = {
        theme1,
        theme2,
        levelDifference,
        similarityScore: analysis.similarityScore || 0.2,
        relationshipType: analysis.relationshipType || 'distinct',
        action: analysis.action || 'keep_separate',
        confidence: analysis.confidence || 0.3,
        reasoning: analysis.reasoning || 'No reasoning provided',
      };

      this.cache.set(cacheKey, result, 1800000); // Cache for 30 minutes
      return result;
    } catch (error) {
      console.error(
        `[HIERARCHICAL] AI analysis failed for ${theme1.name} vs ${theme2.name}:`,
        error
      );
      console.error(`[HIERARCHICAL] Error details:`, {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
      });

      // Return conservative default on any error
      const fallbackResult: CrossLevelSimilarity = {
        theme1,
        theme2,
        levelDifference,
        similarityScore: 0.2,
        relationshipType: 'distinct',
        action: 'keep_separate',
        confidence: 0.3,
        reasoning: `AI analysis failed: ${error}`,
      };

      this.cache.set(cacheKey, fallbackResult, 1800000); // Cache for 30 minutes
      return fallbackResult;
    }
  }

  private mergeThemes(
    theme1: ConsolidatedTheme,
    theme2: ConsolidatedTheme,
    action: CrossLevelSimilarity['action']
  ): ConsolidatedTheme {
    // Determine which theme should be the primary one based on action
    const primaryTheme =
      action === 'merge_up'
        ? theme1.level < theme2.level
          ? theme1
          : theme2
        : theme1.level > theme2.level
          ? theme1
          : theme2;

    const secondaryTheme = primaryTheme === theme1 ? theme2 : theme1;

    return {
      ...primaryTheme,
      description:
        `${primaryTheme.description} ${secondaryTheme.description}`.trim(),
      businessImpact:
        `${primaryTheme.businessImpact} ${secondaryTheme.businessImpact}`.trim(),
      affectedFiles: [
        ...new Set([
          ...primaryTheme.affectedFiles,
          ...secondaryTheme.affectedFiles,
        ]),
      ],
      codeSnippets: [
        ...primaryTheme.codeSnippets,
        ...secondaryTheme.codeSnippets,
      ],
      confidence: Math.max(primaryTheme.confidence, secondaryTheme.confidence),
      sourceThemes: [
        ...primaryTheme.sourceThemes,
        ...secondaryTheme.sourceThemes,
      ],
      consolidationMethod: 'merge',
      lastAnalysis: new Date(),
    };
  }

  private countThemes(hierarchy: ConsolidatedTheme[]): number {
    return this.flattenHierarchy(hierarchy).length;
  }

  private applyMerges(hierarchy: ConsolidatedTheme[]): ConsolidatedTheme[] {
    // This would implement the actual merge logic
    // For now, return the original hierarchy
    // In a full implementation, this would rebuild the hierarchy with merged themes
    return hierarchy;
  }

  private hasCircularReference(
    theme: ConsolidatedTheme,
    allThemes: ConsolidatedTheme[],
    visited: Set<string> = new Set()
  ): boolean {
    if (visited.has(theme.id)) {
      return true; // Found a cycle
    }

    visited.add(theme.id);

    if (theme.parentId) {
      const parent = allThemes.find((t) => t.id === theme.parentId);
      if (parent && this.hasCircularReference(parent, allThemes, visited)) {
        return true;
      }
    }

    visited.delete(theme.id); // Remove from visited when backtracking
    return false;
  }
}

interface CrossLevelSimilarityRequest {
  id: string;
  theme1: ConsolidatedTheme;
  theme2: ConsolidatedTheme;
  levelDifference: number;
}
