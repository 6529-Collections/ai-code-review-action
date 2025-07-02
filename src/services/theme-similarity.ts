import { Theme } from './theme-service';
import {
  SimilarityMetrics,
  ConsolidatedTheme,
  ConsolidationConfig,
  ThemePair,
  AISimilarityResult,
} from '../types/similarity-types';
import { SimilarityCache } from './similarity-cache';
import { SimilarityCalculator } from '../utils/similarity-calculator';
import { AISimilarityService } from './ai-similarity';
import { BatchProcessor } from './ai/batch/batch-processor';
import { BusinessDomainService } from './business-domain';
import { ThemeNamingService } from './theme-naming';
import { ConcurrencyManager } from '../utils/concurrency-manager';
import { logger } from '../utils/logger';
import { SimilarityResult, BatchProcessingOptions } from '../types/batch-types';

/**
 * Effectiveness tracking for similarity analysis
 */
export interface SimilarityEffectiveness {
  pairsAnalyzed: number;
  mergesDecided: number;
  mergeRate: number;
  processingTime: number;
  aiCallsUsed: number;
}

export class ThemeSimilarityService {
  private config: ConsolidationConfig;
  private similarityCache: SimilarityCache;
  private similarityCalculator: SimilarityCalculator;
  private aiSimilarityService: AISimilarityService;
  private batchProcessor: BatchProcessor;
  private businessDomainService: BusinessDomainService;
  private themeNamingService: ThemeNamingService;
  private pendingCalculations: Map<string, Promise<SimilarityMetrics>> =
    new Map();
  private effectiveness: SimilarityEffectiveness = {
    pairsAnalyzed: 0,
    mergesDecided: 0,
    mergeRate: 0,
    processingTime: 0,
    aiCallsUsed: 0,
  };

  constructor(anthropicApiKey: string, config?: Partial<ConsolidationConfig>) {
    this.config = {
      similarityThreshold: 0.7, // Now represents confidence threshold for merge decision
      maxThemesPerParent: 5,
      minThemesForParent: 2,
      maxHierarchyDepth: 4,
      expansionEnabled: true,
      crossLevelSimilarityCheck: true,
      ...config,
    };

    // Initialize services
    this.similarityCache = new SimilarityCache();
    this.similarityCalculator = new SimilarityCalculator();
    this.aiSimilarityService = new AISimilarityService(anthropicApiKey);
    this.batchProcessor = BatchProcessor.getInstance(anthropicApiKey);
    this.businessDomainService = new BusinessDomainService(anthropicApiKey);
    this.themeNamingService = new ThemeNamingService();

    logger.logProcess('Initialized ThemeSimilarityService', {
      threshold: this.config.similarityThreshold,
      minForParent: this.config.minThemesForParent,
      maxDepth: this.config.maxHierarchyDepth,
    });
  }

  async calculateSimilarity(
    theme1: Theme,
    theme2: Theme
  ): Promise<SimilarityMetrics> {
    const cacheKey = this.similarityCache.getCacheKey(theme1, theme2);

    // Check if already calculating
    const pending = this.pendingCalculations.get(cacheKey);
    if (pending) {
      logger.trace('SIMILARITY', `Pending: ${theme1.name} vs ${theme2.name}`);
      return pending;
    }

    // Check cache
    const cached = this.similarityCache.getCachedSimilarity(cacheKey);
    if (cached) {
      logger.trace('SIMILARITY', `Cache hit: ${theme1.name} vs ${theme2.name}`);
      return cached.similarity;
    }

    // Start new calculation
    const calculationPromise = this.doCalculateSimilarity(
      theme1,
      theme2,
      cacheKey
    );
    this.pendingCalculations.set(cacheKey, calculationPromise);

    try {
      const result = await calculationPromise;
      return result;
    } finally {
      this.pendingCalculations.delete(cacheKey);
    }
  }

  private async doCalculateSimilarity(
    theme1: Theme,
    theme2: Theme,
    cacheKey: string
  ): Promise<SimilarityMetrics> {
    // Only skip if absolutely certain they're different
    const fileOverlap = this.similarityCalculator.calculateFileOverlap(
      theme1.affectedFiles,
      theme2.affectedFiles
    );
    const nameSimilarity = this.similarityCalculator.calculateNameSimilarity(
      theme1.name,
      theme2.name
    );

    // Skip only if NO file overlap AND completely different names
    if (fileOverlap === 0 && nameSimilarity < 0.1) {
      logger.trace(
        'SIMILARITY',
        `Skip: no overlap - ${theme1.name} vs ${theme2.name}`
      );
      const result = {
        combinedScore: 0,
        nameScore: 0,
        descriptionScore: 0,
        fileOverlap: 0,
        patternScore: 0,
        businessScore: 0,
      };
      this.similarityCache.cacheSimilarity(cacheKey, result);
      return result;
    }

    // Ask Claude with full context
    const aiResult = await this.aiSimilarityService.calculateAISimilarity(
      theme1,
      theme2
    );

    // Convert to SimilarityMetrics using confidence as the primary score
    const result = {
      combinedScore: aiResult.shouldMerge
        ? aiResult.confidence
        : (1 - aiResult.confidence) * 0.3,
      nameScore: 0, // Not used anymore
      descriptionScore: 0, // Not used anymore
      fileOverlap, // Keep for reference
      patternScore: 0, // Not used anymore
      businessScore: 0, // Not used anymore
    };

    // Cache the result
    this.similarityCache.cacheSimilarity(cacheKey, result);
    return result;
  }

  async consolidateThemes(themes: Theme[]): Promise<ConsolidatedTheme[]> {
    console.log(`[CONSOLIDATION] Starting with ${themes.length} themes`);
    if (themes.length === 0) return [];

    const startTime = Date.now();
    const initialAICalls = this.aiSimilarityService
      .getClaudeClient()
      .getMetrics().totalCalls;

    // Step 1: Find merge candidates
    logger.info('SIMILARITY', 'Step 1: Finding merge candidates');
    const mergeGroups = await this.findMergeGroups(themes);
    logger.info('SIMILARITY', `Found ${mergeGroups.size} merge groups`);

    // Step 2: Create consolidated themes
    logger.info('SIMILARITY', 'Step 2: Creating consolidated themes');
    const consolidated = await this.createConsolidatedThemes(
      mergeGroups,
      themes
    );
    logger.info(
      'SIMILARITY',
      `Created ${consolidated.length} consolidated themes`
    );

    // Step 3: Build hierarchies
    logger.info('SIMILARITY', 'Step 3: Building hierarchies');
    const hierarchical = await this.buildHierarchies(consolidated);

    // Update effectiveness metrics
    this.effectiveness.processingTime = Date.now() - startTime;
    this.effectiveness.aiCallsUsed =
      this.aiSimilarityService.getClaudeClient().getMetrics().totalCalls -
      initialAICalls;
    this.effectiveness.mergeRate =
      this.effectiveness.pairsAnalyzed > 0
        ? (this.effectiveness.mergesDecided /
            this.effectiveness.pairsAnalyzed) *
          100
        : 0;

    const reductionPercent = (
      ((themes.length - hierarchical.length) / themes.length) *
      100
    ).toFixed(1);
    logger.info(
      'SIMILARITY',
      `Final result: ${hierarchical.length} themes (${reductionPercent}% reduction, ${this.effectiveness.mergeRate.toFixed(1)}% merge rate)`
    );

    return hierarchical;
  }

  /**
   * Get effectiveness metrics for this similarity analysis
   */
  getEffectiveness(): SimilarityEffectiveness {
    return { ...this.effectiveness };
  }

  /**
   * Reset effectiveness metrics
   */
  resetEffectiveness(): void {
    this.effectiveness = {
      pairsAnalyzed: 0,
      mergesDecided: 0,
      mergeRate: 0,
      processingTime: 0,
      aiCallsUsed: 0,
    };
  }

  private async findMergeGroups(
    themes: Theme[]
  ): Promise<Map<string, string[]>> {
    logger.debug(
      'SIMILARITY',
      `Using batch processing for ${themes.length} themes`
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

    this.effectiveness.pairsAnalyzed = allPairs.length;
    logger.info('SIMILARITY', `Total pairs to analyze: ${allPairs.length}`);

    // Step 2: Calculate similarities using batch processing and early termination
    const similarities = await this.calculateBatchSimilarities(allPairs);

    // Step 3: Build merge groups based on calculated similarities
    return this.buildMergeGroupsFromSimilarities(themes, similarities);
  }

  private async calculateBatchSimilarities(
    pairs: ThemePair[]
  ): Promise<Map<string, SimilarityMetrics>> {
    const similarities = new Map<string, SimilarityMetrics>();

    // Use batch AI processing for significant performance improvement
    logger.debug('SIMILARITY', `Processing ${pairs.length} pairs in batches`);

    // Split into batches for optimal processing
    const batchSize = this.calculateOptimalBatchSize(pairs.length);
    const batches = this.createPairBatches(pairs, batchSize);

    logger.debug(
      'SIMILARITY',
      `${batches.length} batches of ~${batchSize} pairs each`
    );

    // Process batches concurrently
    const results = await ConcurrencyManager.processConcurrentlyWithLimit(
      batches,
      async (batch) => {
        return await this.processSimilarityBatch(batch);
      },
      {
        concurrencyLimit: 3, // Fewer concurrent batches since each is larger
        maxRetries: 2,
        enableLogging: false,
        onProgress: (completed, total) => {
          // Only log major progress milestones to reduce noise
          if (completed % Math.max(1, Math.floor(total / 4)) === 0) {
            const pairsCompleted = completed * batchSize;
            const totalPairs = pairs.length;
            logger.debug(
              'SIMILARITY',
              `Progress: ${pairsCompleted}/${totalPairs} pairs (${Math.round((completed / total) * 100)}%)`
            );
          }
        },
        onError: (error, batch, retryCount) => {
          logger.warn(
            'SIMILARITY',
            `Retry ${retryCount} for batch: ${error.message}`
          );
        },
      }
    );

    // Store successful results
    let successCount = 0;
    let failedCount = 0;

    for (const result of results) {
      if (result && typeof result === 'object' && 'error' in result) {
        failedCount++;
        // For failed batches, we can't process individual pairs, so skip them
        console.warn(`[SIMILARITY-BATCH] Batch failed: ${result.error}`);
      } else {
        successCount++;
        // result is a Map<string, SimilarityMetrics> from processSimilarityBatch
        const batchResultMap = result as Map<string, SimilarityMetrics>;
        for (const [pairId, similarity] of batchResultMap) {
          similarities.set(pairId, similarity);
        }
      }
    }

    logger.info(
      'SIMILARITY',
      `Batch processing: ${successCount} successful, ${failedCount} failed`
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
          logger.trace(
            'SIMILARITY',
            `Merge: ${theme.name} + ${otherTheme.name} (${similarity.combinedScore.toFixed(2)})`
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
      // Build codeContext from theme's codeChanges
      codeContext: this.buildCodeContext(theme),
      // Include new detailed fields
      detailedDescription: theme.detailedDescription,
      technicalSummary: theme.technicalSummary,
      keyChanges: theme.keyChanges,
      userScenario: theme.userScenario,
      mainFunctionsChanged: theme.mainFunctionsChanged,
      mainClassesChanged: theme.mainClassesChanged,
      codeMetrics: theme.codeMetrics,
      codeExamples: theme.codeExamples,
    };
  }

  private buildCodeContext(theme: Theme): ConsolidatedTheme['codeContext'] {
    const fileMap = new Map<
      string,
      Array<{
        type: 'added' | 'removed' | 'modified';
        startLine: number;
        endLine: number;
        content: string;
        diff: string;
      }>
    >();

    let totalLinesChanged = 0;

    // Build file-grouped changes from theme's codeChanges
    theme.codeChanges.forEach((codeChange) => {
      if (!fileMap.has(codeChange.file)) {
        fileMap.set(codeChange.file, []);
      }

      const changes = fileMap.get(codeChange.file)!;

      // Convert codeChange to our format
      changes.push({
        type: this.inferChangeType(codeChange),
        startLine: 0, // CodeChange doesn't have startLine
        endLine: 0, // CodeChange doesn't have endLine
        content: codeChange.semanticDescription || '',
        diff: codeChange.diffHunk || '',
      });

      totalLinesChanged += codeChange.linesAdded + codeChange.linesRemoved;
    });

    // If no codeChanges available, fallback to basic info
    if (fileMap.size === 0) {
      theme.affectedFiles.forEach((filePath, index) => {
        fileMap.set(filePath, [
          {
            type: 'modified',
            startLine: 0,
            endLine: 0,
            content: theme.codeSnippets[index] || '',
            diff: '',
          },
        ]);
      });

      totalLinesChanged =
        (theme.codeMetrics?.linesAdded || 0) +
        (theme.codeMetrics?.linesRemoved || 0);
    }

    return {
      files: Array.from(fileMap.entries()).map(([path, changes]) => ({
        path,
        changes,
      })),
      totalLinesChanged,
    };
  }

  private inferChangeType(codeChange: {
    linesAdded: number;
    linesRemoved: number;
  }): 'added' | 'removed' | 'modified' {
    if (codeChange.linesAdded > 0 && codeChange.linesRemoved === 0) {
      return 'added';
    } else if (codeChange.linesRemoved > 0 && codeChange.linesAdded === 0) {
      return 'removed';
    } else {
      return 'modified';
    }
  }

  private buildMergedCodeContext(
    themes: Theme[]
  ): ConsolidatedTheme['codeContext'] {
    const fileMap = new Map<
      string,
      Array<{
        type: 'added' | 'removed' | 'modified';
        startLine: number;
        endLine: number;
        content: string;
        diff: string;
      }>
    >();

    let totalLinesChanged = 0;

    // Combine codeChanges from all themes
    themes.forEach((theme) => {
      theme.codeChanges.forEach((codeChange) => {
        if (!fileMap.has(codeChange.file)) {
          fileMap.set(codeChange.file, []);
        }

        const changes = fileMap.get(codeChange.file)!;

        changes.push({
          type: this.inferChangeType(codeChange),
          startLine: 0, // CodeChange doesn't have startLine
          endLine: 0, // CodeChange doesn't have endLine
          content: codeChange.semanticDescription || '',
          diff: codeChange.diffHunk || '',
        });

        totalLinesChanged += codeChange.linesAdded + codeChange.linesRemoved;
      });
    });

    // Fallback to basic info if no codeChanges
    if (fileMap.size === 0) {
      const allFiles = new Set<string>();
      const allSnippets: string[] = [];

      themes.forEach((theme) => {
        theme.affectedFiles.forEach((file) => allFiles.add(file));
        allSnippets.push(...theme.codeSnippets);
      });

      Array.from(allFiles).forEach((filePath, index) => {
        fileMap.set(filePath, [
          {
            type: 'modified',
            startLine: 0,
            endLine: 0,
            content: allSnippets[index] || '',
            diff: '',
          },
        ]);
      });

      totalLinesChanged = themes.reduce(
        (total, theme) =>
          total +
          (theme.codeMetrics?.linesAdded || 0) +
          (theme.codeMetrics?.linesRemoved || 0),
        0
      );
    }

    return {
      files: Array.from(fileMap.entries()).map(([path, changes]) => ({
        path,
        changes,
      })),
      totalLinesChanged,
    };
  }

  private async mergeThemes(themes: Theme[]): Promise<ConsolidatedTheme> {
    const allFiles = new Set<string>();
    const allSnippets: string[] = [];
    let totalConfidence = 0;

    // Combine all rich fields
    const allKeyChanges: string[] = [];
    const allFunctions = new Set<string>();
    const allClasses = new Set<string>();
    const allCodeExamples: Array<{
      file: string;
      description: string;
      snippet: string;
    }> = [];
    let totalLinesAdded = 0;
    let totalLinesRemoved = 0;

    themes.forEach((theme) => {
      theme.affectedFiles.forEach((file) => allFiles.add(file));
      allSnippets.push(...theme.codeSnippets);
      totalConfidence += theme.confidence;

      // Combine new fields
      if (theme.keyChanges) allKeyChanges.push(...theme.keyChanges);
      if (theme.mainFunctionsChanged)
        theme.mainFunctionsChanged.forEach((f) => allFunctions.add(f));
      if (theme.mainClassesChanged)
        theme.mainClassesChanged.forEach((c) => allClasses.add(c));
      if (theme.codeExamples) allCodeExamples.push(...theme.codeExamples);
      if (theme.codeMetrics) {
        totalLinesAdded += theme.codeMetrics.linesAdded;
        totalLinesRemoved += theme.codeMetrics.linesRemoved;
      }
    });

    // Generate AI-powered name and description for merged themes
    const { name, description } =
      await this.themeNamingService.generateMergedThemeNameAndDescription(
        themes
      );

    // Combine technical summaries
    const combinedTechnicalDetails = themes
      .filter((t) => t.technicalSummary)
      .map((t) => t.technicalSummary)
      .join('. ');

    // Combine user scenarios
    const unifiedUserImpact = themes
      .filter((t) => t.userScenario)
      .map((t) => t.userScenario)
      .join('. Additionally, ');

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
      // Build combined codeContext from all themes
      codeContext: this.buildMergedCodeContext(themes),

      // New rich fields
      consolidationSummary: `Merged ${themes.length} similar themes`,
      combinedTechnicalDetails: combinedTechnicalDetails || undefined,
      unifiedUserImpact: unifiedUserImpact || undefined,
      keyChanges: allKeyChanges.length > 0 ? allKeyChanges : undefined,
      mainFunctionsChanged:
        allFunctions.size > 0 ? Array.from(allFunctions) : undefined,
      mainClassesChanged:
        allClasses.size > 0 ? Array.from(allClasses) : undefined,
      codeMetrics:
        totalLinesAdded > 0 || totalLinesRemoved > 0
          ? {
              linesAdded: totalLinesAdded,
              linesRemoved: totalLinesRemoved,
              filesChanged: allFiles.size,
            }
          : undefined,
      codeExamples:
        allCodeExamples.length > 0 ? allCodeExamples.slice(0, 5) : undefined, // Limit to 5 examples
    };
  }

  /**
   * Calculate optimal batch size based on total pairs and complexity
   * PRD: "Dynamic batch sizing" - adapt to content complexity
   */
  private calculateOptimalBatchSize(totalPairs: number): number {
    // Dynamic batch sizing based on total pairs and estimated complexity
    if (totalPairs <= 10) return Math.max(1, totalPairs); // Small PRs - process all at once
    if (totalPairs <= 50) return 25; // Medium PRs - moderate batching
    if (totalPairs <= 200) return 50; // Large PRs - larger batches for efficiency
    return 75; // Very large PRs - maximum batch size for token limits
  }

  /**
   * Split pairs into optimally-sized batches for AI processing
   */
  private createPairBatches(
    pairs: ThemePair[],
    batchSize: number
  ): ThemePair[][] {
    const batches: ThemePair[][] = [];
    for (let i = 0; i < pairs.length; i += batchSize) {
      batches.push(pairs.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Process a batch of theme pairs using unified batch processor
   * This is the key optimization - multiple pairs analyzed in one API call
   */
  private async processSimilarityBatch(
    pairs: ThemePair[]
  ): Promise<Map<string, SimilarityMetrics>> {
    const batchResults = new Map<string, SimilarityMetrics>();
    const batchContext = logger.startOperation('Similarity Batch Processing', {
      pairCount: pairs.length,
    });

    try {
      // Convert ThemePairs to format expected by BatchProcessor
      const batchPairs = pairs.map((pair) => ({
        theme1: pair.theme1 as unknown as ConsolidatedTheme,
        theme2: pair.theme2 as unknown as ConsolidatedTheme,
      }));

      // Use unified batch processor
      const batchResponse = await this.batchProcessor.processSimilarityBatch(
        batchPairs,
        { maxBatchSize: 8 } as BatchProcessingOptions
      );

      if (batchResponse.success && batchResponse.results.length > 0) {
        // Convert unified results back to SimilarityMetrics format
        this.convertUnifiedResultsToSimilarityMetrics(
          batchResponse.results,
          pairs,
          batchResults
        );

        logger.logProgress({
          current: batchResponse.results.length,
          total: pairs.length,
          message: 'Batch similarity processing completed',
          context: 'Batch Processing',
        });
      } else {
        throw new Error(`Batch processing returned no results or failed`);
      }

      logger.endOperation(batchContext, true, {
        processedPairs: batchResponse.results.length,
        successRate: batchResponse.results.length / pairs.length,
      });
    } catch (error) {
      logger.logError('Batch similarity processing failed', error as Error, {
        pairCount: pairs.length,
        fallbackToIndividual: true,
      });

      logger.endOperation(batchContext, false);

      // Fallback to individual processing if batch fails
      logger.logProcess(
        `Falling back to individual processing for ${pairs.length} pairs`
      );
      await this.processBatchIndividually(pairs, batchResults);
    }

    return batchResults;
  }

  /**
   * Convert unified batch results to SimilarityMetrics format
   */
  private convertUnifiedResultsToSimilarityMetrics(
    results: SimilarityResult[],
    originalPairs: ThemePair[],
    batchResults: Map<string, SimilarityMetrics>
  ): void {
    results.forEach((result, index) => {
      if (index < originalPairs.length) {
        const pair = originalPairs[index];
        const cacheKey = this.similarityCache.getCacheKey(
          pair.theme1,
          pair.theme2
        );

        const similarityMetrics: SimilarityMetrics = {
          nameScore: result.scores.name,
          descriptionScore: result.scores.description,
          patternScore: result.scores.pattern,
          businessScore: result.scores.business,
          fileOverlap: result.scores.semantic,
          combinedScore: result.confidence,
        };

        batchResults.set(cacheKey, similarityMetrics);

        // Cache the result for future use
        this.similarityCache.cacheSimilarity(cacheKey, similarityMetrics);
      }
    });
  }

  /**
   * Fallback to individual processing if batch fails
   */
  private async processBatchIndividually(
    pairs: ThemePair[],
    results: Map<string, SimilarityMetrics>
  ): Promise<void> {
    console.log(
      `[SIMILARITY-FALLBACK] Processing ${pairs.length} pairs individually`
    );

    for (const pair of pairs) {
      try {
        const similarity = await this.calculateSimilarity(
          pair.theme1,
          pair.theme2
        );
        results.set(pair.id, similarity);
      } catch (error) {
        console.warn(
          `[SIMILARITY-FALLBACK] Failed individual processing for ${pair.id}: ${error}`
        );
        // Set default non-match result
        results.set(pair.id, {
          combinedScore: 0,
          nameScore: 0,
          descriptionScore: 0,
          businessScore: 0,
          fileOverlap: 0,
          patternScore: 0,
        });
      }
    }
  }

  /**
   * Convert AI similarity result to SimilarityMetrics
   */
  private convertAIResultToMetrics(
    aiResult: AISimilarityResult
  ): SimilarityMetrics {
    return {
      combinedScore: Math.max(0, Math.min(1, aiResult.semanticScore || 0)),
      nameScore: Math.max(0, Math.min(1, aiResult.nameScore || 0)),
      descriptionScore: Math.max(
        0,
        Math.min(1, aiResult.descriptionScore || 0)
      ),
      businessScore: Math.max(0, Math.min(1, aiResult.businessScore || 0)),
      fileOverlap: 0, // Not available in AI result, would need separate calculation
      patternScore: Math.max(0, Math.min(1, aiResult.patternScore || 0)),
    };
  }
}
