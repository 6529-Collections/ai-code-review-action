import { Theme } from './theme-service';
import {
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
      similarityThreshold: 0.7, // Now represents confidence threshold for merge decision
      maxThemesPerParent: 5,
      minThemesForParent: 2,
      maxHierarchyDepth: 4,
      expansionEnabled: true,
      crossLevelSimilarityCheck: true,
      // Remove unused weight configurations
      confidenceWeight: 0.3, // Keep for backwards compatibility
      businessDomainWeight: 0.4, // Keep for backwards compatibility
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
      console.log(
        `[SKIP] No file overlap and different names for "${theme1.name}" vs "${theme2.name}"`
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

    // Process all pairs through calculateSimilarity (which handles caching and skipping)
    for (const pair of pairs) {
      try {
        const similarity = await this.calculateSimilarity(
          pair.theme1,
          pair.theme2
        );
        similarities.set(pair.id, similarity);
      } catch (error) {
        console.warn(`[SIMILARITY] Failed to process pair ${pair.id}:`, error);
        // Use non-match result for failed comparisons
        similarities.set(pair.id, {
          combinedScore: 0,
          nameScore: 0,
          descriptionScore: 0,
          fileOverlap: 0,
          patternScore: 0,
          businessScore: 0,
        });
      }
    }

    console.log(`[SIMILARITY] Processed ${similarities.size} pairs`);
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
}
