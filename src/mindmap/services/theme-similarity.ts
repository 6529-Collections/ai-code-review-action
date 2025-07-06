import { Theme } from '@/shared/types/theme-types';
import {
  SimilarityMetrics,
  ConsolidatedTheme,
  ConsolidationConfig,
  ThemePair,
} from '../types/similarity-types';
import { SimilarityCache } from './similarity-cache';
import { SimilarityCalculator } from '@/shared/utils/similarity-calculator';
import { AISimilarityService } from './ai/ai-similarity';
import { BusinessDomainService } from './business-domain';
import { ThemeNamingService } from './theme-naming';
import { logger } from '@/shared/utils/logger';

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
    this.businessDomainService = new BusinessDomainService(anthropicApiKey);
    this.themeNamingService = new ThemeNamingService();

  }

  async calculateSimilarity(
    theme1: Theme,
    theme2: Theme
  ): Promise<SimilarityMetrics> {
    const cacheKey = this.similarityCache.getCacheKey(theme1, theme2);

    // Check if already calculating
    const pending = this.pendingCalculations.get(cacheKey);
    if (pending) {
      return pending;
    }

    // Check cache
    const cached = this.similarityCache.getCachedSimilarity(cacheKey);
    if (cached) {
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
    if (themes.length === 0) return [];

    const startTime = Date.now();
    const initialAICalls = this.aiSimilarityService
      .getClaudeClient()
      .getMetrics().totalCalls;

    // Step 1: Find merge candidates
    const mergeGroups = await this.findMergeGroups(themes);

    // Step 2: Create consolidated themes
    const consolidated = await this.createConsolidatedThemes(
      mergeGroups,
      themes
    );

    // Step 3: Build hierarchies
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

    // Split into batches for optimal processing
    const batchSize = this.calculateOptimalBatchSize(pairs.length);
    const batches = this.createPairBatches(pairs, batchSize);


    // Process batches using Promise.all
    // ClaudeClient handles rate limiting and queuing
    const results = await Promise.all(
      batches.map(async (batch, index) => {
        try {
          return await this.processSimilarityBatch(batch);
        } catch (error) {
          logger.warn('THEME-SIMILARITY', `Batch ${index + 1} failed: ${error}`);
          return new Map<string, SimilarityMetrics>(); // Return empty map for failed batch
        }
      })
    );

    // Store results
    let successCount = 0;
    for (const batchResultMap of results) {
      if (batchResultMap.size > 0) {
        successCount++;
        for (const [pairId, similarity] of batchResultMap) {
          similarities.set(pairId, similarity);
        }
      }
    }

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
    const themeMap = new Map(allThemes.map((t) => [t.id, t]));
    
    // Process merge groups in parallel
    const groupEntries = Array.from(mergeGroups.entries());
    const consolidated = await Promise.all(
      groupEntries.map(async ([, groupIds]) => {
        const themesInGroup = groupIds
          .map((id) => themeMap.get(id))
          .filter((t): t is Theme => t !== undefined);

        if (themesInGroup.length === 1) {
          // Single theme - convert to consolidated
          return this.themeToConsolidated(themesInGroup[0]);
        } else {
          // Multiple themes - merge them
          return await this.mergeThemes(themesInGroup);
        }
      })
    );

    return consolidated;
  }

  private async buildHierarchies(
    themes: ConsolidatedTheme[]
  ): Promise<ConsolidatedTheme[]> {
    // Group themes by business domain
    const domainGroups =
      await this.businessDomainService.groupByBusinessDomain(themes);
    const result: ConsolidatedTheme[] = [];

    for (const [domain, domainThemes] of domainGroups) {
      if (domainThemes.length >= this.config.minThemesForParent) {
        // Create parent theme
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

      // New rich fields
      consolidationSummary: `Merged ${themes.length} similar themes`,
      combinedTechnicalDetails: combinedTechnicalDetails || undefined,
      unifiedUserImpact: unifiedUserImpact || undefined,
      keyChanges: allKeyChanges.length > 0 ? allKeyChanges : undefined,
      mainFunctionsChanged:
        allFunctions.size > 0 ? Array.from(allFunctions) : undefined,
      mainClassesChanged:
        allClasses.size > 0 ? Array.from(allClasses) : undefined,
      codeMetrics: allFiles.size > 0
        ? {
            filesChanged: allFiles.size,
          }
        : undefined,
      codeExamples: allCodeExamples.length > 0 ? allCodeExamples : undefined, // Include all examples
    };
  }

  /**
   * Calculate optimal batch size based on total pairs and complexity
   * PRD: "Dynamic batch sizing" - adapt to content complexity
   */
  private calculateOptimalBatchSize(totalPairs: number): number {
    // Dynamic batch sizing optimized for concurrency while respecting token limits
    // Target: Create enough batches to utilize 8-10 concurrent request slots
    
    // Apply token-based limits
    if (totalPairs <= 10) return Math.max(1, Math.ceil(totalPairs / 3)); // 3-4 small batches
    if (totalPairs <= 30) return Math.max(3, Math.ceil(totalPairs / 8)); // 8 batches max
    if (totalPairs <= 100) return Math.max(5, Math.ceil(totalPairs / 10)); // 10 batches max
    if (totalPairs <= 200) return Math.max(10, Math.ceil(totalPairs / 10)); // 10 batches max
    return Math.max(15, Math.ceil(totalPairs / 10)); // Still target 10 batches for large sets
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
   * Process a batch of theme pairs with a single AI call
   * This is the key optimization - multiple pairs analyzed in one API call
   */
  private async processSimilarityBatch(
    pairs: ThemePair[]
  ): Promise<Map<string, SimilarityMetrics>> {
    const batchResults = new Map<string, SimilarityMetrics>();

    // Build batch prompt for multiple pair analysis
    const batchPrompt = this.buildBatchSimilarityPrompt(pairs);

    try {
      // Single AI call for entire batch
      const response = await this.aiSimilarityService.calculateBatchSimilarity(
        batchPrompt,
        pairs.length
      );

      // Parse batch response into individual similarity metrics
      this.parseBatchSimilarityResponse(response, pairs, batchResults);

    } catch (error) {

      // Fallback to individual processing if batch fails
      await this.processBatchIndividually(pairs, batchResults);
    }

    return batchResults;
  }

  /**
   * Build optimized prompt for batch similarity analysis
   * PRD: "Structured prompts with clear sections"
   */
  private buildBatchSimilarityPrompt(pairs: ThemePair[]): string {
    const pairDescriptions = pairs
      .map((pair, index) => {
        return `Pair ${index + 1}:
Theme A: "${pair.theme1.name}" - ${pair.theme1.description}
Theme B: "${pair.theme2.name}" - ${pair.theme2.description}
Files A: ${pair.theme1.affectedFiles?.join(', ') || 'none'}
Files B: ${pair.theme2.affectedFiles?.join(', ') || 'none'}`;
      })
      .join('\n\n');

    return `You are analyzing theme similarity for code review mindmap organization.

Analyze similarity between these ${pairs.length} theme pairs:

${pairDescriptions}

For each pair, consider:
- Business logic overlap (most important)
- Affected file overlap
- Functional relationship
- User impact similarity

Respond with ONLY valid JSON:
{
  "results": [
    {
      "pairIndex": 1,
      "shouldMerge": boolean,
      "combinedScore": 0.0-1.0,
      "nameScore": 0.0-1.0,
      "descriptionScore": 0.0-1.0,
      "businessScore": 0.0-1.0,
      "reasoning": "max 20 words"
    }
  ]
}

Threshold: >0.7 for merge recommendation.
Be conservative - only merge when themes serve the same business purpose.`;
  }

  /**
   * Parse batch AI response into individual similarity metrics
   */
  private parseBatchSimilarityResponse(
    response: { results: unknown[] },
    pairs: ThemePair[],
    results: Map<string, SimilarityMetrics>
  ): void {
    try {
      const batchData =
        typeof response === 'string' ? JSON.parse(response) : response;

      if (!batchData.results || !Array.isArray(batchData.results)) {
        throw new Error('Invalid batch response format');
      }

      for (const result of batchData.results) {
        const pairIndex = result.pairIndex - 1; // Convert to 0-based
        if (pairIndex >= 0 && pairIndex < pairs.length) {
          const pair = pairs[pairIndex];
          const similarity: SimilarityMetrics = {
            combinedScore: Math.max(0, Math.min(1, result.combinedScore || 0)),
            nameScore: Math.max(0, Math.min(1, result.nameScore || 0)),
            descriptionScore: Math.max(
              0,
              Math.min(1, result.descriptionScore || 0)
            ),
            businessScore: Math.max(0, Math.min(1, result.businessScore || 0)),
            fileOverlap: Math.max(0, Math.min(1, result.fileOverlap || 0)),
            patternScore: Math.max(0, Math.min(1, result.patternScore || 0)),
          };

          results.set(pair.id, similarity);
        }
      }

    } catch (error) {
      throw error;
    }
  }

  /**
   * Fallback to individual processing if batch fails
   */
  private async processBatchIndividually(
    pairs: ThemePair[],
    results: Map<string, SimilarityMetrics>
  ): Promise<void> {
    // Process individual pairs in parallel instead of sequential
    // ClaudeClient handles rate limiting and queuing
    const individualPromises = pairs.map(async (pair) => {
      try {
        const similarity = await this.calculateSimilarity(
          pair.theme1,
          pair.theme2
        );
        return { pairId: pair.id, similarity };
      } catch (error) {
        // Set default non-match result
        return {
          pairId: pair.id,
          similarity: {
            combinedScore: 0,
            nameScore: 0,
            descriptionScore: 0,
            businessScore: 0,
            fileOverlap: 0,
            patternScore: 0,
          }
        };
      }
    });

    // Wait for all individual calculations to complete
    const individualResults = await Promise.all(individualPromises);
    
    // Store results in the map
    for (const { pairId, similarity } of individualResults) {
      results.set(pairId, similarity);
    }
  }

}
