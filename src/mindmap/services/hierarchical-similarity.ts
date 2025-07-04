import { ConsolidatedTheme } from '../types/similarity-types';
import {
  CrossLevelSimilarity,
  DeduplicationResult,
} from '../types/expansion-types';
import { GenericCache } from '@/shared/cache/generic-cache';
import { ClaudeClient } from '@/shared/utils/claude-client';
import { JsonExtractor } from '@/shared/utils/json-extractor';
import { logInfo } from '../../utils';
import { ConcurrencyManager } from '@/shared/utils/concurrency-manager';
import { logger } from '@/shared/utils/logger';

/**
 * Effectiveness tracking for hierarchical similarity analysis
 */
export interface HierarchicalEffectiveness {
  crossLevelComparisonsGenerated: number;
  duplicatesFound: number;
  overlapsResolved: number;
  processingTime: number;
  aiCallsUsed: number;
  filteringReduction: number;
}

/**
 * Enhanced similarity service for multi-level theme hierarchies
 * Handles cross-level duplicate detection and hierarchy optimization
 */
export class HierarchicalSimilarityService {
  private claudeClient: ClaudeClient;
  private cache: GenericCache;
  private effectiveness: HierarchicalEffectiveness = {
    crossLevelComparisonsGenerated: 0,
    duplicatesFound: 0,
    overlapsResolved: 0,
    processingTime: 0,
    aiCallsUsed: 0,
    filteringReduction: 0,
  };

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
    const startTime = Date.now();
    const initialAICalls = this.claudeClient.getMetrics().totalCalls;

    logger.info('HIERARCHICAL', 'Starting cross-level similarity analysis');

    // Reset effectiveness tracking
    this.resetEffectiveness();

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

    // Track pre-filtering effectiveness
    const totalPossibleComparisons =
      (allThemes.length * (allThemes.length - 1)) / 2;
    this.effectiveness.filteringReduction =
      ((totalPossibleComparisons - comparisons.length) /
        totalPossibleComparisons) *
      100;
    this.effectiveness.crossLevelComparisonsGenerated = comparisons.length;

    logger.info(
      'HIERARCHICAL',
      `Generated ${comparisons.length} cross-level comparisons`
    );
    logger.info(
      'HIERARCHICAL',
      `Pre-filtering reduced comparisons by ${this.effectiveness.filteringReduction.toFixed(1)}% (${totalPossibleComparisons} → ${comparisons.length})`
    );

    if (comparisons.length > 100) {
      logger.warn(
        'HIERARCHICAL',
        `Too many comparisons (${comparisons.length}), this may cause performance issues`
      );
    }

    // Process comparisons with controlled concurrency
    console.log(
      `[HIERARCHICAL] Starting ${comparisons.length} Claude API calls with concurrency limit of 10`
    );

    const results = await ConcurrencyManager.processConcurrentlyWithLimit(
      comparisons,
      async (comparison) => {
        return await this.analyzeCrossLevelSimilarityPair(comparison);
      },
      {
        concurrencyLimit: 5,
        maxRetries: 3,
        enableLogging: false,
        onProgress: (completed, total) => {
          console.log(
            `[HIERARCHICAL] Cross-level analysis progress: ${completed}/${total} comparisons`
          );
        },
        onError: (error, comparison, retryCount) => {
          console.warn(
            `[HIERARCHICAL] Retry ${retryCount} for comparison ${comparison.id}: ${error.message}`
          );
        },
      }
    );

    // Extract successful results
    const successfulResults: CrossLevelSimilarity[] = [];
    let failedCount = 0;

    for (const result of results) {
      if (result && typeof result === 'object' && 'error' in result) {
        failedCount++;
        console.warn(
          `[HIERARCHICAL] Failed comparison after all retries: ${result.item.id}`
        );
      } else {
        successfulResults.push(result as CrossLevelSimilarity);
      }
    }

    if (failedCount > 0) {
      console.warn(
        `[HIERARCHICAL] ${failedCount}/${comparisons.length} comparisons failed after retries`
      );
    }

    // Update effectiveness metrics
    this.effectiveness.processingTime = Date.now() - startTime;
    this.effectiveness.aiCallsUsed =
      this.claudeClient.getMetrics().totalCalls - initialAICalls;

    logger.info(
      'HIERARCHICAL',
      `Completed cross-level similarity analysis: ${successfulResults.length} successful results in ${this.effectiveness.processingTime}ms`
    );
    return successfulResults;
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
    // Use environment variable to control threshold (default: more strict 0.95 vs original 0.85)
    const similarityThreshold = parseFloat(
      process.env.CROSS_LEVEL_DEDUP_THRESHOLD || '0.95'
    );
    const allowOverlapMerging = process.env.ALLOW_OVERLAP_MERGING !== 'false';

    const duplicates = crossLevelSimilarities.filter((similarity) => {
      const meetsThreshold = similarity.similarityScore > similarityThreshold;
      const isStrictDuplicate = similarity.relationshipType === 'duplicate';
      const isOverlap = similarity.relationshipType === 'overlap';
      const shouldMerge =
        meetsThreshold &&
        (isStrictDuplicate || (allowOverlapMerging && isOverlap));

      // Log detailed deduplication decisions
      if (process.env.VERBOSE_DEDUP_LOGGING === 'true') {
        console.log(
          `[CROSS-LEVEL-DEDUP] Similarity: ${similarity.similarityScore.toFixed(3)} (threshold: ${similarityThreshold})`
        );
        console.log(
          `[CROSS-LEVEL-DEDUP] Relationship: ${similarity.relationshipType}`
        );
        console.log(`[CROSS-LEVEL-DEDUP] Theme1: "${similarity.theme1.name}"`);
        console.log(`[CROSS-LEVEL-DEDUP] Theme2: "${similarity.theme2.name}"`);
        console.log(
          `[CROSS-LEVEL-DEDUP] Decision: ${shouldMerge ? 'MERGE' : 'KEEP_SEPARATE'}`
        );
        console.log(`[CROSS-LEVEL-DEDUP] Reasoning: ${similarity.reasoning}`);
        console.log('---');
      }

      return shouldMerge;
    });

    console.log(
      `[CROSS-LEVEL-DEDUP] Found ${duplicates.length} themes to merge (threshold: ${similarityThreshold}, allowOverlap: ${allowOverlapMerging})`
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
        this.effectiveness.duplicatesFound++;
      } else {
        overlapsResolved++;
        this.effectiveness.overlapsResolved++;
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
    // Basic hierarchy rules
    if (theme1.level === theme2.level && theme1.parentId === theme2.parentId) {
      return false;
    }

    if (theme1.parentId === theme2.id || theme2.parentId === theme1.id) {
      return false;
    }

    const levelDifference = Math.abs(theme1.level - theme2.level);
    if (levelDifference > 1) {
      return false;
    }

    // Intelligent pre-filtering optimizations (PRD: "Efficient cross-reference indexing")

    // 1. File overlap check - skip if zero file overlap
    const fileOverlap = this.calculateFileOverlap(theme1, theme2);
    if (fileOverlap === 0) {
      // Check name similarity as secondary filter
      const nameSimilarity = this.calculateNameSimilarity(
        theme1.name,
        theme2.name
      );
      if (nameSimilarity < 0.3) {
        // No file overlap AND very different names = very unlikely to be related
        return false;
      }
    }

    // 2. Business domain filtering - skip if clearly different domains
    if (this.areDifferentBusinessDomains(theme1, theme2)) {
      return false;
    }

    // 3. Size mismatch filtering - skip if one is much larger than the other
    if (this.hasSevereSizeMismatch(theme1, theme2)) {
      return false;
    }

    // 4. Type mismatch filtering - skip incompatible change types
    if (this.hasIncompatibleChangeTypes(theme1, theme2)) {
      return false;
    }

    return true;
  }

  /**
   * Calculate file overlap between two themes
   * Returns ratio 0.0-1.0 of overlapping files
   */
  private calculateFileOverlap(
    theme1: ConsolidatedTheme,
    theme2: ConsolidatedTheme
  ): number {
    const files1 = new Set(theme1.affectedFiles || []);
    const files2 = new Set(theme2.affectedFiles || []);

    if (files1.size === 0 || files2.size === 0) {
      return 0;
    }

    const intersection = new Set([...files1].filter((x) => files2.has(x)));
    const union = new Set([...files1, ...files2]);

    return intersection.size / union.size;
  }

  /**
   * Calculate name similarity using simple token matching
   * Returns ratio 0.0-1.0 of similarity
   */
  private calculateNameSimilarity(name1: string, name2: string): number {
    const tokens1 = new Set(name1.toLowerCase().split(/\s+/));
    const tokens2 = new Set(name2.toLowerCase().split(/\s+/));

    const intersection = new Set([...tokens1].filter((x) => tokens2.has(x)));
    const union = new Set([...tokens1, ...tokens2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Check if themes belong to clearly different business domains
   * Uses heuristic domain detection from descriptions
   */
  private areDifferentBusinessDomains(
    theme1: ConsolidatedTheme,
    theme2: ConsolidatedTheme
  ): boolean {
    const domain1 = this.inferBusinessDomain(theme1);
    const domain2 = this.inferBusinessDomain(theme2);

    // Known incompatible domain pairs
    const incompatiblePairs = [
      ['ui', 'api'],
      ['auth', 'docs'],
      ['test', 'feature'],
      ['config', 'logic'],
    ];

    for (const [d1, d2] of incompatiblePairs) {
      if (
        (domain1 === d1 && domain2 === d2) ||
        (domain1 === d2 && domain2 === d1)
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Simple domain inference from theme content
   */
  private inferBusinessDomain(theme: ConsolidatedTheme): string {
    const text = `${theme.name} ${theme.description}`.toLowerCase();

    if (
      text.includes('ui') ||
      text.includes('interface') ||
      text.includes('component')
    ) {
      return 'ui';
    }
    if (
      text.includes('api') ||
      text.includes('endpoint') ||
      text.includes('service')
    ) {
      return 'api';
    }
    if (
      text.includes('auth') ||
      text.includes('login') ||
      text.includes('security')
    ) {
      return 'auth';
    }
    if (
      text.includes('test') ||
      text.includes('spec') ||
      text.includes('mock')
    ) {
      return 'test';
    }
    if (
      text.includes('config') ||
      text.includes('setting') ||
      text.includes('env')
    ) {
      return 'config';
    }
    if (
      text.includes('doc') ||
      text.includes('readme') ||
      text.includes('comment')
    ) {
      return 'docs';
    }

    return 'general';
  }

  /**
   * Check if themes have severe size mismatch (one much larger than other)
   */
  private hasSevereSizeMismatch(
    theme1: ConsolidatedTheme,
    theme2: ConsolidatedTheme
  ): boolean {
    const size1 =
      (theme1.affectedFiles?.length || 0) +
      (theme1.codeMetrics?.linesAdded || 0);
    const size2 =
      (theme2.affectedFiles?.length || 0) +
      (theme2.codeMetrics?.linesAdded || 0);

    if (size1 === 0 || size2 === 0) {
      return false; // Can't judge size mismatch
    }

    const ratio = Math.max(size1, size2) / Math.min(size1, size2);
    return ratio > 10; // One is 10x larger than the other
  }

  /**
   * Check if themes have incompatible change types
   */
  private hasIncompatibleChangeTypes(
    theme1: ConsolidatedTheme,
    theme2: ConsolidatedTheme
  ): boolean {
    // Extract change type indicators from descriptions
    const type1 = this.inferChangeType(theme1);
    const type2 = this.inferChangeType(theme2);

    // Incompatible type pairs
    const incompatibleTypes = [
      ['add', 'remove'],
      ['create', 'delete'],
      ['new', 'fix'],
    ];

    for (const [t1, t2] of incompatibleTypes) {
      if ((type1 === t1 && type2 === t2) || (type1 === t2 && type2 === t1)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Simple change type inference
   */
  private inferChangeType(theme: ConsolidatedTheme): string {
    const text = `${theme.name} ${theme.description}`.toLowerCase();

    if (
      text.includes('add') ||
      text.includes('create') ||
      text.includes('new')
    ) {
      return 'add';
    }
    if (
      text.includes('remove') ||
      text.includes('delete') ||
      text.includes('drop')
    ) {
      return 'remove';
    }
    if (
      text.includes('fix') ||
      text.includes('bug') ||
      text.includes('error')
    ) {
      return 'fix';
    }
    if (
      text.includes('update') ||
      text.includes('modify') ||
      text.includes('change')
    ) {
      return 'update';
    }

    return 'general';
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

  /**
   * Get effectiveness metrics for this hierarchical analysis
   */
  getEffectiveness(): HierarchicalEffectiveness {
    return { ...this.effectiveness };
  }

  /**
   * Reset effectiveness metrics
   */
  resetEffectiveness(): void {
    this.effectiveness = {
      crossLevelComparisonsGenerated: 0,
      duplicatesFound: 0,
      overlapsResolved: 0,
      processingTime: 0,
      aiCallsUsed: 0,
      filteringReduction: 0,
    };
  }
}

interface CrossLevelSimilarityRequest {
  id: string;
  theme1: ConsolidatedTheme;
  theme2: ConsolidatedTheme;
  levelDifference: number;
}
