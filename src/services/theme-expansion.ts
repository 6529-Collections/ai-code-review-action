import { ConsolidatedTheme } from '../types/similarity-types';
import { GenericCache } from '../utils/generic-cache';
import { ClaudeClient } from '../utils/claude-client';
import { JsonExtractor } from '../utils/json-extractor';
import {
  ConcurrencyManager,
  ConcurrencyOptions,
} from '../utils/concurrency-manager';
import { SecureFileNamer } from '../utils/secure-file-namer';
import {
  AIExpansionDecisionService,
  ExpansionDecision,
} from './ai-expansion-decision-service';
import { logger } from '../utils/logger';

// Configuration for theme expansion
export interface ExpansionConfig {
  maxDepth: number; // Maximum hierarchy depth - set high to allow natural stopping
  concurrencyLimit: number; // Maximum concurrent operations (default: 5)
  maxRetries: number; // Maximum retry attempts (default: 3)
  retryDelay: number; // Base retry delay in ms (default: 1000)
  retryBackoffMultiplier: number; // Backoff multiplier (default: 2)
  enableProgressLogging: boolean; // Enable progress logging (default: true)
  dynamicConcurrency: boolean; // Enable dynamic concurrency (default: true)
  enableJitter: boolean; // Enable jitter in retries (default: true)
}

export const DEFAULT_EXPANSION_CONFIG: ExpansionConfig = {
  maxDepth: 20, // Allow very deep natural expansion
  concurrencyLimit: 5,
  maxRetries: 3,
  retryDelay: 1000,
  retryBackoffMultiplier: 2,
  enableProgressLogging: false,
  dynamicConcurrency: true,
  enableJitter: true,
};

export interface ExpansionCandidate {
  theme: ConsolidatedTheme;
  parentTheme?: ConsolidatedTheme;
  expansionDecision: ExpansionDecision;
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
  context: ExpansionCandidate;
}

export interface ExpansionResult {
  requestId: string;
  success: boolean;
  expandedTheme?: ConsolidatedTheme;
  subThemes: ConsolidatedTheme[];
  error?: string;
  processingTime: number;
}

/**
 * Effectiveness tracking for theme expansion
 */
export interface ExpansionEffectiveness {
  themesEvaluated: number;
  themesExpanded: number;
  expansionRate: number;
  processingTime: number;
  aiCallsUsed: number;
  maxDepthReached: number;
  atomicThemesIdentified: number;
}

export interface ExpansionStopReason {
  themeId: string;
  themeName: string;
  depth: number;
  reason: 'atomic' | 'ai-decision' | 'max-depth' | 'error';
  details: string;
  fileCount: number;
  lineCount: number;
}

export class ThemeExpansionService {
  private claudeClient: ClaudeClient;
  private cache: GenericCache;
  private config: ExpansionConfig;
  private aiDecisionService: AIExpansionDecisionService;
  private effectiveness: ExpansionEffectiveness = {
    themesEvaluated: 0,
    themesExpanded: 0,
    expansionRate: 0,
    processingTime: 0,
    aiCallsUsed: 0,
    maxDepthReached: 0,
    atomicThemesIdentified: 0,
  };
  private expansionStopReasons: ExpansionStopReason[] = [];

  constructor(anthropicApiKey: string, config: Partial<ExpansionConfig> = {}) {
    this.claudeClient = new ClaudeClient(anthropicApiKey);
    this.cache = new GenericCache(3600000); // 1 hour TTL
    this.config = { ...DEFAULT_EXPANSION_CONFIG, ...config };
    this.aiDecisionService = new AIExpansionDecisionService(anthropicApiKey);
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
    const startTime = Date.now();
    const initialAICalls = this.claudeClient.getMetrics().totalCalls;

    logger.info(
      'EXPANSION',
      `Starting hierarchical expansion of ${consolidatedThemes.length} themes`
    );
    logger.debug(
      'EXPANSION',
      `Input theme names: ${consolidatedThemes.map((t) => t.name).join(', ')}`
    );
    
    // DEBUG: Log all input themes with IDs
    console.log(`[INPUT-THEMES] Starting with ${consolidatedThemes.length} root themes:`);
    consolidatedThemes.forEach((theme, i) => {
      console.log(`  [INPUT-THEME-${i}] "${theme.name}" (ID: ${theme.id})`);
    });

    // Reset effectiveness tracking
    this.resetEffectiveness();

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

    // Update effectiveness metrics
    this.effectiveness.processingTime = Date.now() - startTime;
    this.effectiveness.aiCallsUsed =
      this.claudeClient.getMetrics().totalCalls - initialAICalls;
    this.effectiveness.expansionRate =
      this.effectiveness.themesEvaluated > 0
        ? (this.effectiveness.themesExpanded /
            this.effectiveness.themesEvaluated) *
          100
        : 0;

    logger.info(
      'EXPANSION',
      `Completed expansion: ${expandedThemes.length}/${consolidatedThemes.length} themes (${this.effectiveness.expansionRate.toFixed(1)}% expansion rate)`
    );
    logger.debug(
      'EXPANSION',
      `Expanded theme names: ${expandedThemes.map((t) => t.name).join(', ')}`
    );
    logger.info(
      'EXPANSION',
      `Max depth reached: ${this.effectiveness.maxDepthReached}, Atomic themes: ${this.effectiveness.atomicThemesIdentified}`
    );

    // Log expansion stop reasons for analysis
    console.log(`[EXPANSION-ANALYSIS] Expansion stop reasons summary:`);
    console.log(`[EXPANSION-ANALYSIS] Total themes that stopped expanding: ${this.expansionStopReasons.length}`);
    
    const reasonCounts = this.expansionStopReasons.reduce((acc, reason) => {
      acc[reason.reason] = (acc[reason.reason] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    Object.entries(reasonCounts).forEach(([reason, count]) => {
      console.log(`[EXPANSION-ANALYSIS] ${reason}: ${count} themes`);
    });

    // Log themes that exceeded PRD limits but were marked atomic
    const oversizedAtomic = this.expansionStopReasons.filter(r => 
      r.reason === 'atomic' && (r.lineCount > 15 || r.fileCount > 1)
    );
    
    if (oversizedAtomic.length > 0) {
      console.log(`[EXPANSION-ANALYSIS] ⚠️  ${oversizedAtomic.length} themes marked atomic but exceed PRD limits:`);
      oversizedAtomic.forEach(r => {
        console.log(`  - "${r.themeName}" (${r.fileCount} files, ${r.lineCount} lines) at depth ${r.depth}`);
      });
    }

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
    // Track depth metrics
    this.effectiveness.maxDepthReached = Math.max(
      this.effectiveness.maxDepthReached,
      currentDepth
    );

    // PRD: No artificial limits - depth emerges from complexity
    if (currentDepth >= this.config.maxDepth) {
      logger.info(
        'EXPANSION',
        `Deep expansion at level ${currentDepth} - complexity demands it`
      );
    }

    // Check if theme is candidate for expansion
    const expansionCandidate = await this.evaluateExpansionCandidate(
      theme,
      parentTheme,
      currentDepth
    );
    if (!expansionCandidate) {
      console.log(
        `[EXPANSION-FLOW] Theme "${theme.name}" NOT selected for expansion at depth ${currentDepth}`
      );
      console.log(
        `[EXPANSION-FLOW] Will only process existing ${theme.childThemes.length} child themes`
      );
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

    // Create expansion request with the expansion candidate as context
    const expansionRequest: ExpansionRequest = {
      id: SecureFileNamer.generateHierarchicalId('expansion', theme.id),
      theme,
      parentTheme,
      depth: currentDepth,
      context: expansionCandidate, // Pass the expansion candidate with AI decision
    };

    // Process expansion
    const result = await this.processExpansionRequest(expansionRequest);

    if (!result.success || !result.expandedTheme) {
      logger.info(
        'EXPANSION',
        `Expansion failed for theme ${theme.name}: ${result.error}`
      );
      return theme;
    }

    // Track successful expansion
    this.effectiveness.themesExpanded++;

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

    // Process existing children only if we didn't create new sub-themes
    let expandedExistingChildren: ConsolidatedTheme[] = [];
    
    if (result.subThemes.length === 0) {
      // Only process existing children if we didn't create new sub-themes
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
    } else {
      // We created new sub-themes, so skip existing children to avoid duplicates
      console.log(
        `[EXPANSION-FLOW] Skipping existing children processing - ${result.subThemes.length} new sub-themes were created`
      );
    }

    // Combine all child themes
    const allChildThemes = [...expandedExistingChildren, ...expandedSubThemes];
    
    // DEBUG: Log theme combination details
    console.log(`[COMBINE] Parent: "${result.expandedTheme.name}" (ID: ${result.expandedTheme.id})`);
    console.log(`[COMBINE] Existing children: ${expandedExistingChildren.length}`);
    expandedExistingChildren.forEach((child, i) => 
      console.log(`  [EXISTING-${i}] "${child.name}" (ID: ${child.id})`));
    console.log(`[COMBINE] New sub-themes: ${expandedSubThemes.length}`);
    expandedSubThemes.forEach((child, i) => 
      console.log(`  [NEW-${i}] "${child.name}" (ID: ${child.id})`));
    console.log(`[COMBINE] Total after combination: ${allChildThemes.length}`);
    allChildThemes.forEach((child, i) => 
      console.log(`  [TOTAL-${i}] "${child.name}" (ID: ${child.id})`));

    // Deduplicate child themes using AI
    const deduplicatedChildren =
      await this.deduplicateSubThemes(allChildThemes);

    // NEW: Re-evaluate merged themes for potential expansion (PRD compliance)
    const finalChildren = await this.reEvaluateMergedThemes(
      deduplicatedChildren,
      currentDepth + 1,
      result.expandedTheme
    );

    // DEBUG: Log final theme assembly
    console.log(`[FINAL-ASSEMBLY] Theme "${result.expandedTheme.name}" (ID: ${result.expandedTheme.id}) final children: ${finalChildren.length}`);
    finalChildren.forEach((child, i) => 
      console.log(`  [FINAL-CHILD-${i}] "${child.name}" (ID: ${child.id})`));
    
    return {
      ...result.expandedTheme!,
      childThemes: finalChildren,
      isExpanded: true,
    };
  }

  /**
   * Evaluate if a theme is a candidate for expansion using AI-driven decisions
   */
  private async evaluateExpansionCandidate(
    theme: ConsolidatedTheme,
    parentTheme?: ConsolidatedTheme,
    currentDepth: number = 0
  ): Promise<ExpansionCandidate | null> {
    // Track theme evaluation
    this.effectiveness.themesEvaluated++;

    // Get sibling themes for context
    const siblingThemes =
      parentTheme?.childThemes.filter((t) => t.id !== theme.id) || [];

    // Let AI decide based on full context
    console.log(`[AI-DECISION-INPUT] Calling AI for theme: "${theme.name}"`);
    console.log(`[AI-DECISION-INPUT] Parent: "${parentTheme?.name || 'none'}"`);
    console.log(`[AI-DECISION-INPUT] Siblings: ${siblingThemes.length} themes`);
    console.log(`[AI-DECISION-INPUT] Depth: ${currentDepth}`);

    const expansionDecision = await this.aiDecisionService.shouldExpandTheme(
      theme,
      currentDepth,
      parentTheme,
      siblingThemes
    );

    console.log(
      `[AI-DECISION-OUTPUT] Result for "${theme.name}": expand=${expansionDecision.shouldExpand}`
    );

    // Update theme with PRD-aligned decision metadata
    theme.isAtomic = expansionDecision.isAtomic;

    // Track expansion metrics for PRD analysis
    const expansionMetrics = {
      naturalDepth: currentDepth,
      reason: 'complexity-driven',
      atomicSize: theme.codeSnippets.join('\n').split('\n').length,
      reasoning: expansionDecision.reasoning,
    };

    // If theme is atomic or shouldn't expand, return null
    if (!expansionDecision.shouldExpand) {
      // Detailed logging for expansion decisions
      console.log(
        `[EXPANSION-DECISION] Evaluating theme: "${theme.name}" at depth ${currentDepth}`
      );
      console.log(
        `[EXPANSION-DECISION] Theme files: [${theme.affectedFiles.join(', ')}]`
      );
      console.log(
        `[EXPANSION-DECISION] Code lines: ${theme.codeSnippets.join('\n').split('\n').length}`
      );
      console.log(
        `[EXPANSION-DECISION] AI Decision: shouldExpand=${expansionDecision.shouldExpand}, isAtomic=${expansionDecision.isAtomic}`
      );
      console.log(
        `[EXPANSION-DECISION] AI Reasoning: "${expansionDecision.reasoning}"`
      );
      console.log(
        `[EXPANSION-DECISION] Business Context: "${expansionDecision.businessContext}"`
      );
      console.log(
        `[EXPANSION-DECISION] Technical Context: "${expansionDecision.technicalContext}"`
      );
      console.log(
        `[EXPANSION-DECISION] Testability: "${expansionDecision.testabilityAssessment}"`
      );
      if (expansionDecision.suggestedSubThemes) {
        console.log(
          `[EXPANSION-DECISION] Suggested sub-themes: ${expansionDecision.suggestedSubThemes.length} items`
        );
      } else {
        console.log(`[EXPANSION-DECISION] No sub-themes suggested`);
      }
      console.log('---');

      if (expansionDecision.isAtomic) {
        this.effectiveness.atomicThemesIdentified++;
      }

      // Track expansion stop reason
      this.expansionStopReasons.push({
        themeId: theme.id,
        themeName: theme.name,
        depth: currentDepth,
        reason: expansionDecision.isAtomic ? 'atomic' : 'ai-decision',
        details: expansionDecision.reasoning,
        fileCount: theme.affectedFiles.length,
        lineCount: theme.codeSnippets.join('\n').split('\n').length
      });

      logger.info(
        'EXPANSION',
        `Theme "${theme.name}" stops expansion at depth ${currentDepth}: ${expansionDecision.reasoning}`
      );

      // Log PRD metrics
      if (expansionMetrics.atomicSize > 15) {
        logger.warn(
          'EXPANSION',
          `Atomic theme exceeds PRD size (${expansionMetrics.atomicSize} > 15 lines)`
        );
      }

      return null;
    }

    // Return candidate for expansion
    return {
      theme,
      parentTheme,
      expansionDecision,
    };
  }

  /**
   * Re-evaluate merged themes for potential expansion after deduplication
   * PRD: Ensure merged themes still follow atomic guidelines
   */
  private async reEvaluateMergedThemes(
    themes: ConsolidatedTheme[],
    currentDepth: number,
    parentTheme?: ConsolidatedTheme
  ): Promise<ConsolidatedTheme[]> {
    // Check if re-evaluation is disabled
    const reEvaluateAfterMerge = process.env.RE_EVALUATE_AFTER_MERGE !== 'false';
    if (!reEvaluateAfterMerge) {
      console.log(`[RE-EVALUATION] Re-evaluation disabled (RE_EVALUATE_AFTER_MERGE=false)`);
      return themes;
    }

    const reEvaluatedThemes: ConsolidatedTheme[] = [];
    const maxAtomicSize = parseInt(process.env.MAX_ATOMIC_SIZE || '15');
    const strictAtomicLimits = process.env.STRICT_ATOMIC_LIMITS !== 'false';
    
    for (const theme of themes) {
      // Check if this was a merged theme (has multiple source themes)
      if (theme.sourceThemes && theme.sourceThemes.length > 1) {
        const totalLines = theme.codeSnippets.join('\n').split('\n').length;
        console.log(`[RE-EVALUATION] Checking merged theme "${theme.name}" (${totalLines} lines, ${theme.affectedFiles.length} files)`);
        
        // PRD: If merged theme exceeds atomic size, it should be re-evaluated
        const exceedsLineLimit = strictAtomicLimits && totalLines > maxAtomicSize;
        const exceedsFileLimit = strictAtomicLimits && theme.affectedFiles.length > 1;
        
        if (exceedsLineLimit || exceedsFileLimit) {
          console.log(`[RE-EVALUATION] Merged theme "${theme.name}" exceeds atomic limits -> re-evaluating for expansion`);
          
          // Re-evaluate if it should expand
          const expansionCandidate = await this.evaluateExpansionCandidate(
            theme,
            parentTheme,
            currentDepth
          );
          
          if (expansionCandidate) {
            console.log(`[RE-EVALUATION] Merged theme "${theme.name}" needs expansion after deduplication`);
            // Recursively expand the merged theme
            const expanded = await this.expandThemeRecursively(
              theme,
              currentDepth,
              parentTheme
            );
            reEvaluatedThemes.push(expanded);
          } else {
            console.log(`[RE-EVALUATION] Merged theme "${theme.name}" remains atomic despite size`);
            reEvaluatedThemes.push(theme);
          }
        } else {
          console.log(`[RE-EVALUATION] Merged theme "${theme.name}" within atomic limits -> keeping as-is`);
          reEvaluatedThemes.push(theme);
        }
      } else {
        // Not a merged theme, keep as is
        reEvaluatedThemes.push(theme);
      }
    }
    
    return reEvaluatedThemes;
  }

  /**
   * Deduplicate sub-themes using AI to identify duplicates
   */
  private async deduplicateSubThemes(
    subThemes: ConsolidatedTheme[]
  ): Promise<ConsolidatedTheme[]> {
    // DEBUG: Log deduplication input
    console.log(`[DEDUP-IN] Processing ${subThemes.length} sub-themes:`);
    subThemes.forEach((theme, i) => 
      console.log(`  [DEDUP-IN-${i}] "${theme.name}" (ID: ${theme.id})`));
    
    if (subThemes.length <= 1) {
      console.log(`[DEDUP-OUT] Returning ${subThemes.length} sub-themes unchanged (too few to deduplicate)`);
      return subThemes;
    }

    // Check if batch deduplication is disabled
    const skipBatchDedup = process.env.SKIP_BATCH_DEDUP === 'true';
    const minThemesForBatchDedup = parseInt(
      process.env.MIN_THEMES_FOR_BATCH_DEDUP || '5'
    );

    if (skipBatchDedup) {
      logger.info(
        'EXPANSION',
        `Skipping batch deduplication (SKIP_BATCH_DEDUP=true)`
      );
      return subThemes;
    }

    if (subThemes.length < minThemesForBatchDedup) {
      logger.info(
        'EXPANSION',
        `Skipping batch deduplication: ${subThemes.length} themes < minimum ${minThemesForBatchDedup}`
      );
      return subThemes;
    }

    // Pre-deduplication state logging
    console.log(`[DEDUP-BEFORE] Themes before deduplication:`);
    subThemes.forEach(t => {
      const lines = t.codeSnippets.join('\n').split('\n').length;
      console.log(`  - "${t.name}" (${t.affectedFiles.length} files, ${lines} lines)`);
    });

    logger.info(
      'EXPANSION',
      `Deduplicating ${subThemes.length} sub-themes using AI`
    );

    // Calculate optimal batch size based on theme count
    const batchSize = this.calculateOptimalBatchSize(subThemes.length);
    const batches: ConsolidatedTheme[][] = [];

    for (let i = 0; i < subThemes.length; i += batchSize) {
      batches.push(subThemes.slice(i, i + batchSize));
    }

    // Process each batch with concurrency limit and context-aware settings
    const deduplicationResults =
      await ConcurrencyManager.processConcurrentlyWithLimit(
        batches,
        (batch) => this.deduplicateBatch(batch),
        {
          dynamicConcurrency: true,
          context: 'theme_processing',
          enableJitter: true,
          enableLogging: this.config.enableProgressLogging,
          onProgress: (completed, total) => {
            if (this.config.enableProgressLogging && total > 1) {
              console.log(
                `[THEME-EXPANSION] Deduplication progress: ${completed}/${total} batches (batch size: ${batchSize})`
              );
            }
          },
        }
      );

    // Extract successful results
    const successfulResults: ConsolidatedTheme[][][] = [];
    for (const result of deduplicationResults) {
      if (result && typeof result === 'object' && 'error' in result) {
        console.warn(
          `[THEME-EXPANSION] Deduplication batch failed: ${(result as { error?: Error }).error?.message || 'Unknown error'}`
        );
        // For failed batches, we could return the original batch as fallback
        // but for now, we'll skip failed batches
      } else {
        successfulResults.push(result as ConsolidatedTheme[][]);
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

    logger.info(
      'EXPANSION',
      `Deduplication complete: ${subThemes.length} themes → ${finalThemes.length} themes`
    );

    // Second pass: check if any of the final themes are still duplicates
    // This handles cases where duplicates were in different batches
    // Skip if disabled via environment variable or theme count is too small
    const skipSecondPass = process.env.SKIP_SECOND_PASS_DEDUP === 'true';
    const minThemesForSecondPass = parseInt(
      process.env.MIN_THEMES_FOR_SECOND_PASS_DEDUP || '10'
    );

    if (
      finalThemes.length > 1 &&
      !skipSecondPass &&
      finalThemes.length >= minThemesForSecondPass
    ) {
      logger.info(
        'EXPANSION',
        `Running second pass deduplication on ${finalThemes.length} themes`
      );
      const secondPassResult =
        await this.runSecondPassDeduplication(finalThemes);
      logger.info(
        'EXPANSION',
        `Second pass complete: ${finalThemes.length} themes → ${secondPassResult.length} themes`
      );

      // Post-deduplication state logging (after second pass)
      console.log(`[DEDUP-AFTER] Final themes after second pass deduplication:`);
      secondPassResult.forEach(t => {
        const lines = t.codeSnippets.join('\n').split('\n').length;
        if (t.sourceThemes && t.sourceThemes.length > 1) {
          console.log(`  - "${t.name}" (MERGED from ${t.sourceThemes.length} themes, ${t.affectedFiles.length} files, ${lines} lines)`);
        } else {
          console.log(`  - "${t.name}" (unchanged, ${t.affectedFiles.length} files, ${lines} lines)`);
        }
      });

      return secondPassResult;
    } else if (skipSecondPass) {
      logger.info(
        'EXPANSION',
        `Skipping second pass deduplication (SKIP_SECOND_PASS_DEDUP=true)`
      );
    } else if (finalThemes.length < minThemesForSecondPass) {
      logger.info(
        'EXPANSION',
        `Skipping second pass deduplication: ${finalThemes.length} themes < minimum ${minThemesForSecondPass}`
      );
    }

    // Post-deduplication state logging (no second pass)
    console.log(`[DEDUP-AFTER] Final themes after first pass deduplication:`);
    finalThemes.forEach(t => {
      const lines = t.codeSnippets.join('\n').split('\n').length;
      if (t.sourceThemes && t.sourceThemes.length > 1) {
        console.log(`  - "${t.name}" (MERGED from ${t.sourceThemes.length} themes, ${t.affectedFiles.length} files, ${lines} lines)`);
      } else {
        console.log(`  - "${t.name}" (unchanged, ${t.affectedFiles.length} files, ${lines} lines)`);
      }
    });

    // DEBUG: Log deduplication output
    console.log(`[DEDUP-OUT] Returning ${finalThemes.length} sub-themes:`);
    finalThemes.forEach((theme, i) => 
      console.log(`  [DEDUP-OUT-${i}] "${theme.name}" (ID: ${theme.id})`));
    
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
These themes have already been deduplicated within their groups. Only identify EXACT duplicates across groups.

CRITICAL REQUIREMENTS for identifying duplicates:
- Themes must represent IDENTICAL code changes (not just similar)
- Themes must affect the exact same files AND same functionality
- Themes must have the same business purpose
- When in doubt, DO NOT merge - preserving granularity is more important than consolidation

${themes
  .map(
    (theme, index) => `
Theme ${index + 1}: "${theme.name}"
Description: ${theme.description}
${theme.detailedDescription ? `Details: ${theme.detailedDescription}` : ''}
Files: ${theme.affectedFiles.join(', ')}
Business Impact: ${theme.businessImpact || 'N/A'}
`
  )
  .join('\n')}

Only identify themes that are EXACT duplicates. Be extremely conservative.

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
      logger.info('EXPANSION', `Second pass deduplication failed: ${error}`);
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
Analyze these sub-themes and identify which ones describe IDENTICAL changes (not just related functionality).

IMPORTANT: Only group themes that are truly duplicates - representing exactly the same code change.
- Themes that touch related but different functionality should NOT be merged
- Themes with different business purposes should NOT be merged
- Themes affecting different files or different parts of files should NOT be merged
- When in doubt, keep themes separate to preserve granularity

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
        logger.info(
          'EXPANSION',
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

      // Log batch deduplication results
      const mergedCount = groups.filter((g) => g.length > 1).length;
      const keptSeparate = groups.filter((g) => g.length === 1).length;

      if (process.env.VERBOSE_DEDUP_LOGGING === 'true') {
        console.log(
          `[BATCH-DEDUP] Processed ${themes.length} themes into ${groups.length} groups`
        );
        console.log(
          `[BATCH-DEDUP] ${mergedCount} groups will be merged, ${keptSeparate} themes kept separate`
        );
        groups.forEach((group, idx) => {
          if (group.length > 1) {
            console.log(
              `[BATCH-DEDUP] Group ${idx + 1}: Merging ${group.length} themes: ${group.map((t) => `"${t.name}"`).join(', ')}`
            );
          }
        });
      } else {
        logger.info(
          'EXPANSION',
          `Batch deduplication: ${themes.length} themes → ${groups.length} groups (${mergedCount} merged, ${keptSeparate} separate)`
        );
      }

      return groups;
    } catch (error) {
      logger.info('EXPANSION', `Deduplication batch failed: ${error}`);
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
        id: SecureFileNamer.generateSecureId('dedup'),
        name: data.name || themes[0].name,
        description: data.description || themes[0].description,
        detailedDescription: data.detailedDescription,
        affectedFiles: Array.from(allFiles),
        codeSnippets: allSnippets,
        keyChanges: [...new Set(allKeyChanges)], // Deduplicate key changes
        confidence: totalConfidence / themes.length,
        sourceThemes: themes.flatMap((t) => t.sourceThemes),
        consolidationMethod: 'merge' as const,
        consolidationSummary: `Merged ${themes.length} similar themes`,
      };
    } catch (error) {
      logger.info('EXPANSION', `Sub-theme merge failed: ${error}`);
      return themes[0]; // Use first theme as fallback
    }
  }

  /**
   * Calculate optimal batch size based on total theme count
   */
  private calculateOptimalBatchSize(themeCount: number): number {
    if (themeCount < 20) return 4; // Small PRs: smaller batches for faster feedback
    if (themeCount < 50) return 6; // Medium PRs: current size
    if (themeCount < 100) return 8; // Large PRs: bigger batches for efficiency
    return 10; // Huge PRs: maximum batch size
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
          childThemes: analysis.subThemes,
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
   * Analyze theme for potential sub-themes using expansion decision
   */
  private async analyzeThemeForSubThemes(
    request: ExpansionRequest
  ): Promise<SubThemeAnalysis> {
    const { theme, parentTheme, depth } = request;
    const expansionCandidate = request.context;

    // We already have the expansion decision from evaluateExpansionCandidate
    if (expansionCandidate?.expansionDecision?.suggestedSubThemes) {
      // Convert suggested sub-themes to ConsolidatedThemes
      const suggestedSubThemes = expansionCandidate.expansionDecision.suggestedSubThemes;
      
      // DEBUG: Log AI-generated sub-themes before conversion
      console.log(`[AI-SUBTHEMES] Parent: "${theme.name}" (ID: ${theme.id}) AI generated ${suggestedSubThemes.length} sub-themes:`);
      suggestedSubThemes.forEach((suggested, i) => {
        console.log(`  [AI-SUBTHEME-${i}] "${suggested.name}"`);
      });
      
      const subThemes = this.convertSuggestedToConsolidatedThemes(
        suggestedSubThemes,
        theme
      );
      
      // DEBUG: Log converted sub-themes
      console.log(`[AI-CONVERTED] Converted to ${subThemes.length} ConsolidatedThemes:`);
      subThemes.forEach((converted, i) => {
        console.log(`  [AI-CONVERTED-${i}] "${converted.name}" (ID: ${converted.id})`);
      });

      return {
        subThemes,
        shouldExpand: true,
        confidence: 0.8,
        reasoning: expansionCandidate.expansionDecision.reasoning,
        businessLogicPatterns: [],
        userFlowPatterns: [],
      };
    }

    // Fallback: Ask for sub-theme analysis if not already provided
    const siblingThemes =
      parentTheme?.childThemes.filter((t) => t.id !== theme.id) || [];

    const prompt = `
You already decided this theme should be expanded. Now create the specific sub-themes.

THEME TO EXPAND:
Name: ${theme.name}
Description: ${theme.description}
Business Impact: ${theme.businessImpact}
Current Level: ${theme.level}
Depth: ${depth}
Files: ${theme.affectedFiles.join(', ')}

${
  parentTheme
    ? `PARENT CONTEXT: ${parentTheme.name} - ${parentTheme.businessImpact}`
    : ''
}

${
  siblingThemes.length > 0
    ? `SIBLING THEMES (avoid duplication):
${siblingThemes.map((s) => `- ${s.name}`).join('\n')}
`
    : ''
}

CODE TO ANALYZE:
${theme.codeSnippets.slice(0, 5).join('\n---\n')}

CREATE SUB-THEMES:
${
  depth < 3
    ? `Focus on distinct business capabilities or user features within this theme.`
    : `Focus on atomic, testable units (5-15 lines, single responsibility).`
}

Return JSON with specific sub-themes:
{
  "subThemes": [
    {
      "name": "What this accomplishes (max 8 words)",
      "description": "What changes (max 15 words)",
      "businessImpact": "User benefit (max 12 words)",
      "relevantFiles": ["specific files for this sub-theme"],
      "rationale": "Why this is separate (max 15 words)"
    }
  ],
  "reasoning": "Overall expansion rationale (max 20 words)"
}`;

    try {
      const response = await this.claudeClient.callClaude(prompt);

      const extractionResult = JsonExtractor.extractAndValidateJson(
        response,
        'object',
        ['subThemes']
      );

      if (!extractionResult.success) {
        logger.info(
          'EXPANSION',
          `Failed to parse sub-themes for ${theme.name}: ${extractionResult.error}`
        );
        return {
          subThemes: [],
          shouldExpand: false,
          confidence: 0.3,
          reasoning: `Sub-theme parsing failed: ${extractionResult.error}`,
          businessLogicPatterns: [],
          userFlowPatterns: [],
        };
      }

      const analysis = extractionResult.data as {
        subThemes?: Array<{
          name: string;
          description: string;
          businessImpact: string;
          relevantFiles: string[];
          rationale: string;
        }>;
        reasoning?: string;
      };

      // Convert to ConsolidatedTheme objects
      const subThemes = this.convertSuggestedToConsolidatedThemes(
        analysis.subThemes || [],
        theme
      );

      return {
        subThemes,
        shouldExpand: subThemes.length > 0,
        confidence: 0.8,
        reasoning: analysis.reasoning || 'Sub-themes identified',
        businessLogicPatterns: [],
        userFlowPatterns: [],
      };
    } catch (error) {
      logger.info(
        'EXPANSION',
        `AI analysis failed for theme ${theme.name}: ${error}`
      );
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

  /**
   * Convert suggested sub-themes to ConsolidatedTheme objects
   */
  private convertSuggestedToConsolidatedThemes(
    suggestedThemes: Array<{
      name: string;
      description: string;
      files?: string[];
      businessImpact?: string;
      relevantFiles?: string[];
      rationale?: string;
    }>,
    parentTheme: ConsolidatedTheme
  ): ConsolidatedTheme[] {
    return suggestedThemes.map((suggested, index) => {
      const relevantFiles = suggested.files || suggested.relevantFiles || [];
      const validFiles = relevantFiles.filter((file) =>
        parentTheme.affectedFiles.includes(file)
      );

      return {
        id: SecureFileNamer.generateHierarchicalId(
          'sub',
          parentTheme.id,
          index
        ),
        name: suggested.name,
        description: suggested.description,
        level: parentTheme.level + 1,
        parentId: parentTheme.id,
        childThemes: [],
        affectedFiles:
          validFiles.length > 0 ? validFiles : [parentTheme.affectedFiles[0]], // Fallback to first parent file
        confidence: 0.8,
        businessImpact:
          suggested.businessImpact ||
          suggested.rationale ||
          suggested.description,
        codeSnippets: parentTheme.codeSnippets.filter((snippet) =>
          validFiles.some((file) => snippet.includes(file))
        ),
        context: `${parentTheme.context}\n\nSub-theme: ${suggested.description}`,
        lastAnalysis: new Date(),
        sourceThemes: [parentTheme.id],
        consolidationMethod: 'expansion' as const,
        isAtomic: parentTheme.level >= 3, // Deeper levels likely atomic
      };
    });
  }

  /**
   * Get effectiveness metrics for this expansion analysis
   */
  getEffectiveness(): ExpansionEffectiveness {
    return { ...this.effectiveness };
  }

  /**
   * Reset effectiveness metrics
   */
  resetEffectiveness(): void {
    this.effectiveness = {
      themesEvaluated: 0,
      themesExpanded: 0,
      expansionRate: 0,
      processingTime: 0,
      aiCallsUsed: 0,
      maxDepthReached: 0,
      atomicThemesIdentified: 0,
    };
  }
}
