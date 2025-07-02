import { ConsolidatedTheme } from '../types/similarity-types';
import { logger } from '../utils/logger';

/**
 * Configuration for expansion control
 */
export interface ExpansionControlConfig {
  maxDepth: number; // PRD: Hard limit per scalability (default 10)
  sameThemeExpansionLimit: number; // Stop if same theme expands N times
  atomicThresholds: {
    singleFile: { maxLines: number }; // PRD: 5-15 lines
    singleMethod: { autoAtomic: boolean };
    singleLineChange: { autoAtomic: boolean };
  };
  complexityDepthRatio: number; // Stop if depth > complexity * ratio
}

/**
 * Circuit breaker to prevent infinite expansion loops
 */
export class ExpansionCircuitBreaker {
  private config: ExpansionControlConfig;
  private expansionHistory: Map<string, number> = new Map();
  private atomicDecisions: Map<string, boolean> = new Map();

  constructor(config?: Partial<ExpansionControlConfig>) {
    this.config = {
      maxDepth: 10, // PRD scalability requirement
      sameThemeExpansionLimit: 2,
      atomicThresholds: {
        singleFile: { maxLines: 15 }, // PRD: 5-15 lines for atomic
        singleMethod: { autoAtomic: true },
        singleLineChange: { autoAtomic: true },
      },
      complexityDepthRatio: 2,
      ...config,
    };
  }

  /**
   * Check if expansion should be allowed for a theme
   */
  shouldAllowExpansion(
    theme: ConsolidatedTheme,
    currentDepth: number,
    metrics?: {
      totalLines?: number;
      fileCount?: number;
      methodCount?: number;
      complexityScore?: number;
    }
  ): {
    allowed: boolean;
    reason: string;
    confidence: number;
  } {
    const themeId = theme.id;

    // Check 1: Hard depth limit
    if (currentDepth >= this.config.maxDepth) {
      logger.logProcess(
        `[CIRCUIT-BREAKER] Max depth reached for "${theme.name}"`,
        {
          currentDepth,
          maxDepth: this.config.maxDepth,
        }
      );

      return {
        allowed: false,
        reason: `Maximum depth ${this.config.maxDepth} reached`,
        confidence: 1.0,
      };
    }

    // Check 2: Same theme expansion limit
    const previousExpansions = this.expansionHistory.get(themeId) || 0;
    if (previousExpansions >= this.config.sameThemeExpansionLimit) {
      logger.logProcess(
        `[CIRCUIT-BREAKER] Theme "${theme.name}" already expanded ${previousExpansions} times`,
        {
          themeId,
          limit: this.config.sameThemeExpansionLimit,
        }
      );

      return {
        allowed: false,
        reason: `Theme already expanded ${previousExpansions} times`,
        confidence: 0.95,
      };
    }

    // Check 3: Atomic thresholds
    const atomicCheck = this.checkAtomicThresholds(theme, metrics);
    if (atomicCheck.isAtomic) {
      logger.logProcess(`[CIRCUIT-BREAKER] Theme "${theme.name}" is atomic`, {
        reason: atomicCheck.reason,
        confidence: atomicCheck.confidence,
      });

      this.atomicDecisions.set(themeId, true);

      return {
        allowed: false,
        reason: atomicCheck.reason,
        confidence: atomicCheck.confidence,
      };
    }

    // Check 4: Complexity vs depth ratio
    if (metrics?.complexityScore) {
      const maxDepthForComplexity = Math.ceil(
        metrics.complexityScore * this.config.complexityDepthRatio
      );
      if (currentDepth >= maxDepthForComplexity) {
        logger.logProcess(
          `[CIRCUIT-BREAKER] Depth exceeds complexity for "${theme.name}"`,
          {
            currentDepth,
            complexityScore: metrics.complexityScore,
            maxAllowed: maxDepthForComplexity,
          }
        );

        return {
          allowed: false,
          reason: `Depth ${currentDepth} exceeds complexity ratio (max ${maxDepthForComplexity})`,
          confidence: 0.8,
        };
      }
    }

    // Check 5: Previously marked atomic
    if (this.atomicDecisions.get(themeId)) {
      return {
        allowed: false,
        reason: 'Previously determined to be atomic',
        confidence: 0.9,
      };
    }

    // Record this expansion attempt
    this.expansionHistory.set(themeId, previousExpansions + 1);

    return {
      allowed: true,
      reason: 'Expansion allowed',
      confidence: 0.7,
    };
  }

  /**
   * Check if theme meets atomic thresholds
   */
  private checkAtomicThresholds(
    theme: ConsolidatedTheme,
    metrics?: {
      totalLines?: number;
      fileCount?: number;
      methodCount?: number;
    }
  ): {
    isAtomic: boolean;
    reason: string;
    confidence: number;
  } {
    // Single line change is always atomic
    if (metrics?.totalLines === 1) {
      return {
        isAtomic: true,
        reason: 'Single line change is atomic',
        confidence: 1.0,
      };
    }

    // Single file with limited lines (PRD: 5-15 lines)
    if (metrics?.fileCount === 1 && metrics.totalLines) {
      if (
        metrics.totalLines <= this.config.atomicThresholds.singleFile.maxLines
      ) {
        if (metrics.methodCount === 1) {
          return {
            isAtomic: true,
            reason: `Single method change (${metrics.totalLines} lines)`,
            confidence: 0.95,
          };
        }

        return {
          isAtomic: true,
          reason: `Small single-file change (${metrics.totalLines} lines)`,
          confidence: 0.9,
        };
      }
    }

    // Check theme description for atomic indicators
    const description = theme.description.toLowerCase();
    const atomicKeywords = [
      'single line',
      'one line',
      'typo',
      'rename',
      'fix spelling',
      'update version',
      'change value',
      'modify constant',
    ];

    const hasAtomicKeyword = atomicKeywords.some((keyword) =>
      description.includes(keyword)
    );
    if (hasAtomicKeyword) {
      return {
        isAtomic: true,
        reason: 'Description indicates atomic change',
        confidence: 0.85,
      };
    }

    // Check if theme name suggests atomic change
    const name = theme.name.toLowerCase();
    const atomicNamePatterns = [
      /^(add|remove|update|fix|change) \w+ (constant|variable|value|parameter)$/,
      /^(fix|correct) (typo|spelling)/,
      /^rename \w+$/,
      /^update \w+ to \w+$/,
    ];

    const hasAtomicName = atomicNamePatterns.some((pattern) =>
      pattern.test(name)
    );
    if (hasAtomicName) {
      return {
        isAtomic: true,
        reason: 'Theme name indicates atomic change',
        confidence: 0.8,
      };
    }

    return {
      isAtomic: false,
      reason: 'Not atomic',
      confidence: 0.7,
    };
  }

  /**
   * Reset circuit breaker state
   */
  reset(): void {
    this.expansionHistory.clear();
    this.atomicDecisions.clear();
  }

  /**
   * Get expansion statistics
   */
  getStats(): {
    totalThemes: number;
    averageExpansions: number;
    atomicThemes: number;
    maxExpansions: number;
  } {
    const expansions = Array.from(this.expansionHistory.values());
    const totalThemes = this.expansionHistory.size;
    const atomicThemes = this.atomicDecisions.size;

    return {
      totalThemes,
      averageExpansions:
        expansions.length > 0
          ? expansions.reduce((a, b) => a + b, 0) / expansions.length
          : 0,
      atomicThemes,
      maxExpansions: expansions.length > 0 ? Math.max(...expansions) : 0,
    };
  }

  /**
   * Mark a theme as atomic (override)
   */
  markAsAtomic(themeId: string): void {
    this.atomicDecisions.set(themeId, true);
  }

  /**
   * Check if theme was previously marked atomic
   */
  isMarkedAtomic(themeId: string): boolean {
    return this.atomicDecisions.get(themeId) || false;
  }
}
