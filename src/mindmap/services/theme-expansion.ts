import { ConsolidatedTheme } from '../types/similarity-types';
import { GenericCache } from '@/shared/cache/generic-cache';
import { ClaudeClient } from '@/shared/utils/claude-client';
import { JsonExtractor } from '@/shared/utils/json-extractor';
import { SecureFileNamer } from '../utils/secure-file-namer';
import { AIMindmapService } from './ai/ai-mindmap-service';
import { ThemeMindmapConverter } from './theme-mindmap-converter';
import { ExpansionDecision as AIMindmapExpansionDecision } from '../types/mindmap-types';
import { logger } from '@/shared/logger/logger';
import { LoggerServices } from '@/shared/logger/constants';

// Configuration for theme expansion
export interface ExpansionConfig {
  maxDepth: number; // Maximum hierarchy depth - set high to allow natural stopping
  enableProgressLogging: boolean; // Enable progress logging (default: false)
}

export const DEFAULT_EXPANSION_CONFIG: ExpansionConfig = {
  maxDepth: 20, // Allow very deep natural expansion
  enableProgressLogging: false,
};

export interface ExpansionCandidate {
  theme: ConsolidatedTheme;
  parentTheme?: ConsolidatedTheme;
  expansionDecision: AIMindmapExpansionDecision; // Use the new mindmap expansion decision
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
}

export class ThemeExpansionService {
  private claudeClient: ClaudeClient;
  private cache: GenericCache;
  private config: ExpansionConfig;
  private aiMindmapService: AIMindmapService;
  private converter = ThemeMindmapConverter;
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
    this.aiMindmapService = new AIMindmapService(anthropicApiKey);
  }

  /**
   * Process items sequentially with retry logic
   * ClaudeClient handles rate limiting and queuing
   */

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


    // Reset effectiveness tracking
    this.resetEffectiveness();

    // Process all themes concurrently - let ClaudeClient handle rate limiting
    logger.info(LoggerServices.EXPANSION, `Processing all ${consolidatedThemes.length} themes concurrently`);
    
    const themePromises = consolidatedThemes.map(async (theme) => {
      try {
        return await this.expandThemeRecursively(theme, 0);
      } catch (error) {
        logger.warn(LoggerServices.EXPANSION, `Failed to expand theme "${theme.name}": ${error instanceof Error ? error.message : 'Unknown error'}`);
        return { error: error instanceof Error ? error : new Error(String(error)), item: theme };
      }
    });
    
    const results = await Promise.all(themePromises);

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
      logger.warn(
        LoggerServices.EXPANSION,
        `Failed to expand ${failedThemes.length} themes after retries:`
      );
      for (const failed of failedThemes) {
        logger.warn(LoggerServices.EXPANSION, `  - ${failed.theme.name}: ${failed.error.message}`);
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
    logger.info(LoggerServices.EXPANSION, `Expansion stop reasons summary:`);
    logger.info(
      LoggerServices.EXPANSION,
      `Total themes that stopped expanding: ${this.expansionStopReasons.length}`
    );

    const reasonCounts = this.expansionStopReasons.reduce(
      (acc, reason) => {
        acc[reason.reason] = (acc[reason.reason] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    Object.entries(reasonCounts).forEach(([reason, count]) => {
      logger.info(LoggerServices.EXPANSION, `${reason}: ${count} themes`);
    });

    // Log themes that exceeded PRD limits but were marked atomic
    const oversizedAtomic = this.expansionStopReasons.filter(
      (r) => r.reason === 'atomic' && r.fileCount > 1
    );

    if (oversizedAtomic.length > 0) {
      logger.warn(
        LoggerServices.EXPANSION,
        `${oversizedAtomic.length} themes marked atomic but exceed PRD limits:`
      );
      oversizedAtomic.forEach((r) => {
        logger.warn(
          LoggerServices.EXPANSION,
          `  - "${r.themeName}" (${r.fileCount} files) at depth ${r.depth}`
        );
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
      // Still process existing child themes recursively
      // Process child themes concurrently - let ClaudeClient handle rate limiting
      const childPromises = theme.childThemes.map(async (child) => {
        try {
          return await this.expandThemeRecursively(child, currentDepth + 1, theme);
        } catch (error) {
          logger.warn(LoggerServices.EXPANSION, `Failed to expand child theme "${child.name}": ${error instanceof Error ? error.message : 'Unknown error'}`);
          return { error: error instanceof Error ? error : new Error(String(error)), item: child };
        }
      });
      
      const childResults = await Promise.all(childPromises);

      // Extract successful results, keep failed themes as fallback
      const expandedChildren: ConsolidatedTheme[] = [];
      for (const result of childResults) {
        if ('error' in result) {
          logger.warn(
            LoggerServices.EXPANSION,
            `Failed to expand child theme: ${result.error.message}`
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
      // Log expansion request context on failure
      logger.error(
        LoggerServices.EXPANSION,
        `Theme: "${theme.name}" (ID: ${theme.id})`
      );
      logger.error(
        LoggerServices.EXPANSION,
        `Request ID: ${expansionRequest.id}`
      );
      logger.error(LoggerServices.EXPANSION, `Depth: ${currentDepth}`);
      logger.error(
        LoggerServices.EXPANSION,
        `Parent: ${parentTheme?.name || 'none'}`
      );
      logger.error(LoggerServices.EXPANSION, `Error: ${result.error}`);
      logger.error(
        LoggerServices.EXPANSION,
        `Processing time: ${result.processingTime}ms`
      );

      logger.info(
        'EXPANSION',
        `Expansion failed for theme ${theme.name}: ${result.error}`
      );
      return theme;
    }

    // Track successful expansion
    this.effectiveness.themesExpanded++;

    // Recursively expand new sub-themes concurrently
    const subThemePromises = result.subThemes.map(async (subTheme) => {
      try {
        return await this.expandThemeRecursively(
          subTheme,
          currentDepth + 1,
          result.expandedTheme
        );
      } catch (error) {
        logger.warn(LoggerServices.EXPANSION, `Failed to expand sub-theme "${subTheme.name}": ${error instanceof Error ? error.message : 'Unknown error'}`);
        return { error: error instanceof Error ? error : new Error(String(error)), item: subTheme };
      }
    });
    
    const subThemeResults = await Promise.all(subThemePromises);

    // Extract successful sub-themes
    const expandedSubThemes: ConsolidatedTheme[] = [];
    for (const subResult of subThemeResults) {
      if ('error' in subResult) {
        logger.warn(
          LoggerServices.EXPANSION,
          `Failed to expand sub-theme: ${subResult.error.message}`
        );
        expandedSubThemes.push(subResult.item); // Keep original if expansion fails
      } else {
        expandedSubThemes.push(subResult);
      }
    }

    // Process existing children only if we didn't create new sub-themes
    const expandedExistingChildren: ConsolidatedTheme[] = [];

    if (result.subThemes.length === 0) {
      // Only process existing children if we didn't create new sub-themes concurrently
      const existingChildPromises = result.expandedTheme!.childThemes.map(async (child) => {
        try {
          return await this.expandThemeRecursively(
            child,
            currentDepth + 1,
            result.expandedTheme
          );
        } catch (error) {
          logger.warn(LoggerServices.EXPANSION, `Failed to expand existing child "${child.name}": ${error instanceof Error ? error.message : 'Unknown error'}`);
          return { error: error instanceof Error ? error : new Error(String(error)), item: child };
        }
      });
      
      const existingChildResults = await Promise.all(existingChildPromises);

      // Extract successful existing children
      for (const childResult of existingChildResults) {
        if ('error' in childResult) {
          logger.warn(
            LoggerServices.EXPANSION,
            `Failed to expand existing child: ${childResult.error.message}`
          );
          expandedExistingChildren.push(childResult.item); // Keep original if expansion fails
        } else {
          expandedExistingChildren.push(childResult);
        }
      }
    } else {
      // We created new sub-themes, so skip existing children to avoid duplicates
      logger.debug(
        LoggerServices.EXPANSION,
        `Skipping existing children processing - ${result.subThemes.length} new sub-themes were created`
      );
    }

    // Combine all child themes
    const allChildThemes = [...expandedExistingChildren, ...expandedSubThemes];


    // Re-evaluate merged themes for potential expansion (PRD compliance)
    const finalChildren = await this.reEvaluateMergedThemes(
      allChildThemes,
      currentDepth + 1,
      result.expandedTheme
    );


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

    // Convert theme to MindmapNode for AI analysis
    const mindmapNode = this.converter.convertThemeToMindmapNode(theme);
    
    // Let AI decide based on full context
    const expansionDecision = await this.aiMindmapService.shouldExpandNode(
      mindmapNode,
      currentDepth
    );


    // Update theme with PRD-aligned decision metadata
    theme.isAtomic = expansionDecision.isAtomic;


    // If theme is atomic or shouldn't expand, return null
    if (!expansionDecision.shouldExpand) {

      if (expansionDecision.isAtomic) {
        this.effectiveness.atomicThemesIdentified++;
      }

      // Track expansion stop reason
      this.expansionStopReasons.push({
        themeId: theme.id,
        themeName: theme.name,
        depth: currentDepth,
        reason: expansionDecision.isAtomic ? 'atomic' : 'ai-decision',
        details: expansionDecision.atomicReason || 'AI decision',
        fileCount: theme.affectedFiles.length,
      });

      logger.info(
        'EXPANSION',
        `Theme "${theme.name}" stops expansion at depth ${currentDepth}: ${expansionDecision.atomicReason || 'AI decision'}`
      );


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
    // Re-evaluation is disabled by default
    logger.debug(
      LoggerServices.EXPANSION,
      `Re-evaluation disabled (disabled by default)`
    );
    return themes;

    const reEvaluatedThemes: ConsolidatedTheme[] = [];
    const strictAtomicLimits = true;

    for (const theme of themes) {
      // Check if this was a merged theme (has multiple source themes)
      if (theme.sourceThemes && theme.sourceThemes.length > 1) {
        logger.debug(
          LoggerServices.EXPANSION,
          `Checking merged theme "${theme.name}" (${theme.affectedFiles.length} files, ${theme.sourceThemes.length} sources)`
        );

        // PRD: If merged theme has complexity indicators, it should be re-evaluated
        const exceedsFileLimit =
          strictAtomicLimits && theme.affectedFiles.length > 1;
        const hasMultipleSources = theme.sourceThemes.length > 2;

        if (exceedsFileLimit || hasMultipleSources) {
          logger.debug(
            LoggerServices.EXPANSION,
            `Merged theme "${theme.name}" exceeds atomic limits -> re-evaluating for expansion`
          );

          // Re-evaluate if it should expand
          const expansionCandidate = await this.evaluateExpansionCandidate(
            theme,
            parentTheme,
            currentDepth
          );

          if (expansionCandidate) {
            logger.info(
              LoggerServices.EXPANSION,
              `Merged theme "${theme.name}" needs expansion after deduplication`
            );
            // Recursively expand the merged theme
            const expanded = await this.expandThemeRecursively(
              theme,
              currentDepth,
              parentTheme
            );
            reEvaluatedThemes.push(expanded);
          } else {
            logger.debug(
              LoggerServices.EXPANSION,
              `Merged theme "${theme.name}" remains atomic despite complexity`
            );
            reEvaluatedThemes.push(theme);
          }
        } else {
          logger.debug(
            LoggerServices.EXPANSION,
            `Merged theme "${theme.name}" within atomic limits -> keeping as-is`
          );
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

    // Check if we have expansion decision with DirectChildAssignment (new system)
    if (expansionCandidate?.expansionDecision?.children) {
      // NEW: Use DirectChildAssignment system
      const childAssignments = expansionCandidate.expansionDecision.children;
      
      const subThemes = this.convertDirectAssignmentToConsolidatedThemes(
        childAssignments,
        theme
      );
      
      logger.info(
        'EXPANSION',
        `Using DirectChildAssignment system: ${subThemes.length} sub-themes with proper code assignment`
      );
      
      return {
        subThemes,
        shouldExpand: true,
        confidence: expansionCandidate.expansionDecision.confidence,
        reasoning: expansionCandidate.expansionDecision.atomicReason || 'AI-driven expansion with direct code assignment',
        businessLogicPatterns: [],
        userFlowPatterns: [],
      };
    }
    
    // Note: Legacy file-based system (suggestedSubThemes) removed
    // All expansion now uses DirectChildAssignment system

    // No sub-themes provided by multi-stage system - should not expand
    logger.info(
      'EXPANSION',
      `No sub-themes provided for ${theme.name} - marking as atomic`
    );
    return {
      subThemes: [],
      shouldExpand: false,
      confidence: 0.9,
      reasoning: 'Multi-stage analysis did not provide sub-themes',
      businessLogicPatterns: [],
      userFlowPatterns: [],
    };
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
    // This method is kept for backward compatibility with old system
    // NEW: Also handle DirectChildAssignment from AI
    
    return suggestedThemes.map((suggested, index) => {
      const relevantFiles = suggested.files || suggested.relevantFiles || [];

      // Validate that AI provided files
      if (relevantFiles.length === 0) {
        logger.error(
          LoggerServices.EXPANSION,
          `AI did not provide files for sub-theme "${suggested.name}"`
        );
        logger.error(
          LoggerServices.EXPANSION,
          `Parent theme "${parentTheme.name}" has files: ${JSON.stringify(parentTheme.affectedFiles)}`
        );
        throw new Error(
          `AI failed to provide files for sub-theme "${suggested.name}". ` +
            `Parent theme has ${parentTheme.affectedFiles.length} files. ` +
            `AI must specify which files each sub-theme affects.`
        );
      }

      const validFiles = relevantFiles.filter((file) =>
        parentTheme.affectedFiles.includes(file)
      );

      // Validate that provided files are valid
      if (validFiles.length === 0) {
        logger.error(
          LoggerServices.EXPANSION,
          `AI provided invalid files for sub-theme "${suggested.name}"`
        );
        logger.error(LoggerServices.EXPANSION, `AI suggested: ${JSON.stringify(relevantFiles)}`);
        logger.error(
          LoggerServices.EXPANSION,
          `Valid parent files: ${JSON.stringify(parentTheme.affectedFiles)}`
        );
        throw new Error(
          `AI provided invalid files for sub-theme "${suggested.name}". ` +
            `Suggested files ${JSON.stringify(relevantFiles)} are not in parent's files: ${JSON.stringify(parentTheme.affectedFiles)}`
        );
      }


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
        affectedFiles: validFiles,
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
   * NEW: Convert DirectChildAssignment to ConsolidatedThemes
   * This is the new system that uses proper AI code assignment
   */
  private convertDirectAssignmentToConsolidatedThemes(
    assignments: any[], // DirectChildAssignment[] - avoiding import for now
    parentTheme: ConsolidatedTheme
  ): ConsolidatedTheme[] {
    return assignments.map((assignment) => {
      // Validate assignment using converter
      if (!this.converter.validateDirectAssignment(assignment)) {
        throw new Error(`Invalid DirectChildAssignment for "${assignment.name}"`);
      }
      
      // Convert using the new converter
      return this.converter.convertDirectAssignmentToTheme(assignment, parentTheme);
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
