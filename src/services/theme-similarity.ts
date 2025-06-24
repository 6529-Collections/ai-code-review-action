import { Theme } from './theme-service';
import {
  AISimilarityResult,
  SimilarityMetrics,
  ConsolidatedTheme,
  ConsolidationConfig,
  ThemePair,
} from '../types/similarity-types';
import { SimilarityCache } from './similarity-cache';
import { SimilarityCalculator } from '../utils/similarity-calculator';
import { AISimilarityService } from './ai-similarity';
import { BatchProcessor } from './batch-processor';
import { BusinessDomainService } from './business-domain';
import { ThemeNamingService } from './theme-naming';

export class ThemeSimilarityService {
  private config: ConsolidationConfig;
  private similarityCache: SimilarityCache;
  private similarityCalculator: SimilarityCalculator;
  private aiSimilarityService: AISimilarityService;
  private batchProcessor: BatchProcessor;
  private businessDomainService: BusinessDomainService;
  private themeNamingService: ThemeNamingService;

  constructor(anthropicApiKey: string, config?: Partial<ConsolidationConfig>) {
    this.config = {
      similarityThreshold: 0.6, // Lowered from 0.8 to 0.6 for better consolidation
      maxThemesPerParent: 5,
      minThemesForParent: 2,
      confidenceWeight: 0.3,
      businessDomainWeight: 0.4,
      maxHierarchyDepth: 4,
      expansionEnabled: true,
      crossLevelSimilarityCheck: true,
      ...config,
    };

    // Initialize services
    this.similarityCache = new SimilarityCache();
    this.similarityCalculator = new SimilarityCalculator();
    this.aiSimilarityService = new AISimilarityService(anthropicApiKey);
    this.batchProcessor = new BatchProcessor();
    this.businessDomainService = new BusinessDomainService();
    this.themeNamingService = new ThemeNamingService();

    console.log(
      `[CONFIG] Consolidation config: threshold=${this.config.similarityThreshold}, minForParent=${this.config.minThemesForParent}`
    );
  }

  async calculateSimilarity(
    theme1: Theme,
    theme2: Theme
  ): Promise<SimilarityMetrics> {
    // Check cache first
    const cacheKey = this.similarityCache.getCacheKey(theme1, theme2);
    const cached = this.similarityCache.getCachedSimilarity(cacheKey);
    if (cached) {
      console.log(
        `[CACHE] Using cached similarity for "${theme1.name}" vs "${theme2.name}"`
      );
      return cached.similarity;
    }

    // Check if we can skip AI with quick heuristics
    const quickCheck = this.similarityCalculator.quickSimilarityCheck(
      theme1,
      theme2
    );
    if (quickCheck.shouldSkipAI && quickCheck.similarity) {
      console.log(
        `[QUICK] ${quickCheck.reason} for "${theme1.name}" vs "${theme2.name}"`
      );
      this.similarityCache.cacheSimilarity(cacheKey, quickCheck.similarity);
      return quickCheck.similarity;
    }

    // Use AI for semantic similarity
    const aiSimilarity = await this.aiSimilarityService.calculateAISimilarity(
      theme1,
      theme2
    );

    // Still calculate file overlap (factual)
    const fileOverlap = this.similarityCalculator.calculateFileOverlap(
      theme1.affectedFiles,
      theme2.affectedFiles
    );

    // Combined score: 80% AI semantic understanding + 20% file overlap
    const combinedScore = aiSimilarity.semanticScore * 0.8 + fileOverlap * 0.2;

    const result = {
      nameScore: aiSimilarity.nameScore,
      descriptionScore: aiSimilarity.descriptionScore,
      fileOverlap,
      patternScore: aiSimilarity.patternScore,
      businessScore: aiSimilarity.businessScore,
      combinedScore,
    };

    // Cache the result
    this.similarityCache.cacheSimilarity(cacheKey, result);
    return result;
  }

  async consolidateThemes(themes: Theme[]): Promise<ConsolidatedTheme[]> {
    console.log(`[CONSOLIDATION] Starting with ${themes.length} themes`);
    if (themes.length === 0) return [];

    // Step 1: Find merge candidates
    console.log(`[CONSOLIDATION] Step 1: Finding merge candidates`);
    const mergeGroups = await this.findMergeGroups(themes);
    console.log(`[CONSOLIDATION] Found ${mergeGroups.size} merge groups`);

    // Step 2: Create consolidated themes
    console.log(`[CONSOLIDATION] Step 2: Creating consolidated themes`);
    const consolidated = await this.createConsolidatedThemes(
      mergeGroups,
      themes
    );
    console.log(
      `[CONSOLIDATION] Created ${consolidated.length} consolidated themes`
    );

    // Step 3: Build hierarchies
    console.log(`[CONSOLIDATION] Step 3: Building hierarchies`);
    const hierarchical = await this.buildHierarchies(consolidated);
    console.log(
      `[CONSOLIDATION] Final result: ${hierarchical.length} themes (${(((themes.length - hierarchical.length) / themes.length) * 100).toFixed(1)}% reduction)`
    );

    return hierarchical;
  }

  private async findMergeGroups(
    themes: Theme[]
  ): Promise<Map<string, string[]>> {
    console.log(
      `[OPTIMIZATION] Using batch processing for ${themes.length} themes`
    );

    // Step 1: Collect all theme pairs that need comparison
    const allPairs: ThemePair[] = [];
    for (let i = 0; i < themes.length; i++) {
      for (let j = i + 1; j < themes.length; j++) {
        allPairs.push({
          theme1: themes[i],
          theme2: themes[j],
          id: `${themes[i].id}-${themes[j].id}`,
        });
      }
    }

    console.log(`[OPTIMIZATION] Total pairs to analyze: ${allPairs.length}`);

    // Step 2: Calculate similarities using batch processing and early termination
    const similarities = await this.calculateBatchSimilarities(allPairs);

    // Step 3: Build merge groups based on calculated similarities
    return this.buildMergeGroupsFromSimilarities(themes, similarities);
  }

  private async calculateBatchSimilarities(
    pairs: ThemePair[]
  ): Promise<Map<string, SimilarityMetrics>> {
    const similarities = new Map<string, SimilarityMetrics>();
    let aiCallsSkipped = 0;
    let aiCallsMade = 0;

    // First pass: Process pairs that can be resolved with quick checks or cache
    const needsAI: ThemePair[] = [];

    for (const pair of pairs) {
      const cacheKey = this.similarityCache.getCacheKey(
        pair.theme1,
        pair.theme2
      );
      const cached = this.similarityCache.getCachedSimilarity(cacheKey);

      if (cached) {
        similarities.set(pair.id, cached.similarity);
        continue;
      }

      const quickCheck = this.similarityCalculator.quickSimilarityCheck(
        pair.theme1,
        pair.theme2
      );
      if (quickCheck.shouldSkipAI && quickCheck.similarity) {
        similarities.set(pair.id, quickCheck.similarity);
        this.similarityCache.cacheSimilarity(cacheKey, quickCheck.similarity);
        aiCallsSkipped++;
      } else {
        needsAI.push(pair);
      }
    }

    console.log(
      `[OPTIMIZATION] Quick resolution: ${similarities.size} pairs, AI needed: ${needsAI.length}, Skipped: ${aiCallsSkipped}`
    );

    // Second pass: Process remaining pairs with AI in batches
    if (needsAI.length > 0) {
      // Adapt batch size based on previous failures
      const adaptiveBatchSize = this.batchProcessor.getAdaptiveBatchSize();
      console.log(
        `[BATCH] Using adaptive batch size: ${adaptiveBatchSize} (failures: ${this.batchProcessor.getFailureCount()})`
      );

      const batches = this.batchProcessor.chunkArray(
        needsAI,
        adaptiveBatchSize
      );

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log(
          `[BATCH] Processing batch ${i + 1}/${batches.length} with ${batch.length} pairs`
        );

        try {
          const batchResults =
            await this.batchProcessor.processBatchSimilarity(batch);
          aiCallsMade++;

          // Check if we got valid results
          const validResults = batchResults.filter((r) => !r.error);
          if (validResults.length === 0) {
            throw new Error('No valid results in batch response');
          }

          // Reset failure counter on success
          this.batchProcessor.decrementFailures();

          for (const result of batchResults) {
            if (result.error) {
              console.warn(
                `[BATCH] Error for pair ${result.pairId}: ${result.error}`
              );
              // Use fallback similarity for errored pairs
              const pair = batch.find((p) => p.id === result.pairId);
              if (pair) {
                const fallback =
                  await this.aiSimilarityService.calculateAISimilarity(
                    pair.theme1,
                    pair.theme2
                  );
                similarities.set(
                  result.pairId,
                  this.aiSimilarityToMetrics(fallback, pair.theme1, pair.theme2)
                );
              }
            } else {
              const pair = batch.find((p) => p.id === result.pairId);
              if (pair) {
                const metrics = this.aiSimilarityToMetrics(
                  result.similarity,
                  pair.theme1,
                  pair.theme2
                );
                similarities.set(result.pairId, metrics);

                // Cache the result
                const cacheKey = this.similarityCache.getCacheKey(
                  pair.theme1,
                  pair.theme2
                );
                this.similarityCache.cacheSimilarity(cacheKey, metrics);
              }
            }
          }
        } catch (error) {
          this.batchProcessor.incrementFailures();
          console.error(
            `[BATCH] Batch processing failed (failures: ${this.batchProcessor.getFailureCount()}):`,
            error
          );

          // If too many failures, fall back to individual processing
          if (this.batchProcessor.getFailureCount() >= 3) {
            console.warn(
              `[BATCH] Too many failures, switching to individual processing for remaining batches`
            );

            // Process remaining pairs individually
            for (const pair of batch) {
              try {
                const similarity = await this.calculateSimilarity(
                  pair.theme1,
                  pair.theme2
                );
                similarities.set(pair.id, similarity);
              } catch (individualError) {
                console.warn(
                  `[INDIVIDUAL] Failed to process pair ${pair.id}:`,
                  individualError
                );
                // Use minimal fallback
                similarities.set(pair.id, {
                  nameScore: 0.1,
                  descriptionScore: 0.1,
                  fileOverlap: 0,
                  patternScore: 0.1,
                  businessScore: 0.1,
                  combinedScore: 0.1,
                });
              }
            }
          }
        }
      }
    }

    console.log(
      `[OPTIMIZATION] Processed ${similarities.size} pairs (${aiCallsSkipped} skipped, ${aiCallsMade} AI calls)`
    );
    return similarities;
  }

  private buildMergeGroupsFromSimilarities(
    themes: Theme[],
    similarities: Map<string, SimilarityMetrics>
  ): Map<string, string[]> {
    const mergeGroups = new Map<string, string[]>();
    const processed = new Set<string>();

    for (const theme of themes) {
      if (processed.has(theme.id)) continue;

      const group = [theme.id];
      processed.add(theme.id);

      // Find all themes that should merge with this one
      for (const otherTheme of themes) {
        if (processed.has(otherTheme.id)) continue;

        const pairId = `${theme.id}-${otherTheme.id}`;
        const reversePairId = `${otherTheme.id}-${theme.id}`;
        const similarity =
          similarities.get(pairId) || similarities.get(reversePairId);

        if (
          similarity &&
          similarity.combinedScore >= this.config.similarityThreshold
        ) {
          group.push(otherTheme.id);
          processed.add(otherTheme.id);
          console.log(
            `[MERGE] "${theme.name}" + "${otherTheme.name}" (score: ${similarity.combinedScore.toFixed(2)})`
          );
        }
      }

      mergeGroups.set(theme.id, group);
    }

    return mergeGroups;
  }

  private async createConsolidatedThemes(
    mergeGroups: Map<string, string[]>,
    allThemes: Theme[]
  ): Promise<ConsolidatedTheme[]> {
    const consolidated: ConsolidatedTheme[] = [];
    const themeMap = new Map(allThemes.map((t) => [t.id, t]));

    for (const [, groupIds] of mergeGroups) {
      const themesInGroup = groupIds
        .map((id) => themeMap.get(id))
        .filter((t): t is Theme => t !== undefined);

      if (themesInGroup.length === 1) {
        // Single theme - convert to consolidated
        consolidated.push(this.themeToConsolidated(themesInGroup[0]));
      } else {
        // Multiple themes - merge them
        const merged = await this.mergeThemes(themesInGroup);
        consolidated.push(merged);
      }
    }

    return consolidated;
  }

  private async buildHierarchies(
    themes: ConsolidatedTheme[]
  ): Promise<ConsolidatedTheme[]> {
    // Group themes by business domain
    const domainGroups =
      await this.businessDomainService.groupByBusinessDomain(themes);
    const result: ConsolidatedTheme[] = [];

    console.log(`[HIERARCHY] Found ${domainGroups.size} business domains:`);
    for (const [domain, domainThemes] of domainGroups) {
      console.log(
        `[HIERARCHY] Domain "${domain}": ${domainThemes.length} themes (min required: ${this.config.minThemesForParent})`
      );

      if (domainThemes.length >= this.config.minThemesForParent) {
        // Create parent theme
        console.log(`[HIERARCHY] ✅ Creating parent theme for "${domain}"`);
        const parentTheme = this.themeNamingService.createParentTheme(
          domain,
          domainThemes
        );

        // Set children
        domainThemes.forEach((child) => {
          child.level = 1;
          child.parentId = parentTheme.id;
        });

        parentTheme.childThemes = domainThemes;
        result.push(parentTheme);
      } else {
        // Keep as root themes
        console.log(
          `[HIERARCHY] ⚠️ Keeping "${domain}" themes as individual (below threshold)`
        );
        domainThemes.forEach((theme) => {
          theme.level = 0;
          result.push(theme);
        });
      }
    }

    return result;
  }

  private themeToConsolidated(theme: Theme): ConsolidatedTheme {
    return {
      id: theme.id,
      name: theme.name,
      description: theme.description,
      level: 0,
      childThemes: [],
      affectedFiles: theme.affectedFiles,
      confidence: theme.confidence,
      businessImpact: theme.description,
      codeSnippets: theme.codeSnippets,
      context: theme.context,
      lastAnalysis: theme.lastAnalysis,
      sourceThemes: [theme.id],
      consolidationMethod: 'single',
    };
  }

  private async mergeThemes(themes: Theme[]): Promise<ConsolidatedTheme> {
    const allFiles = new Set<string>();
    const allSnippets: string[] = [];
    let totalConfidence = 0;

    themes.forEach((theme) => {
      theme.affectedFiles.forEach((file) => allFiles.add(file));
      allSnippets.push(...theme.codeSnippets);
      totalConfidence += theme.confidence;
    });

    // Generate AI-powered name and description for merged themes
    const { name, description } =
      await this.themeNamingService.generateMergedThemeNameAndDescription(
        themes
      );

    return {
      id: `merged-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      name,
      description,
      level: 0,
      childThemes: [],
      affectedFiles: Array.from(allFiles),
      confidence: totalConfidence / themes.length,
      businessImpact: themes.map((t) => t.description).join('; '),
      codeSnippets: allSnippets,
      context: themes.map((t) => t.context).join('\n'),
      lastAnalysis: new Date(),
      sourceThemes: themes.map((t) => t.id),
      consolidationMethod: 'merge',
    };
  }

  private aiSimilarityToMetrics(
    aiResult: AISimilarityResult,
    theme1: Theme,
    theme2: Theme
  ): SimilarityMetrics {
    const fileOverlap = this.similarityCalculator.calculateFileOverlap(
      theme1.affectedFiles,
      theme2.affectedFiles
    );

    return {
      nameScore: aiResult.nameScore,
      descriptionScore: aiResult.descriptionScore,
      fileOverlap,
      patternScore: aiResult.patternScore,
      businessScore: aiResult.businessScore,
      combinedScore: aiResult.semanticScore * 0.8 + fileOverlap * 0.2,
    };
  }
}
