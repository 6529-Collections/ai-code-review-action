/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { ConsolidatedTheme } from '../types/similarity-types';
import { ClaudeClient } from '../utils/claude-client';
import { JsonExtractor } from '../utils/json-extractor';
import { logger } from '../utils/logger';
import { EnhancedCodeStructureAnalyzer } from './enhanced-code-structure-analyzer';
import { ExpansionCircuitBreaker } from './expansion-circuit-breaker';
import { GitDiffAnalyzer } from './git-diff-analyzer';

/**
 * Enhanced AI expansion decision service with circuit breaker and accurate metrics
 */
export class EnhancedAIExpansionDecisionService {
  private claudeClient: ClaudeClient;
  private circuitBreaker: ExpansionCircuitBreaker;
  private codeAnalyzer: EnhancedCodeStructureAnalyzer;
  private gitDiffAnalyzer: GitDiffAnalyzer;
  private decisionCache: Map<string, ExpansionDecision>;

  constructor(anthropicApiKey: string) {
    this.claudeClient = new ClaudeClient(anthropicApiKey);
    this.circuitBreaker = new ExpansionCircuitBreaker();
    this.codeAnalyzer = new EnhancedCodeStructureAnalyzer();
    this.gitDiffAnalyzer = new GitDiffAnalyzer();
    this.decisionCache = new Map();
  }

  /**
   * Decide if theme should expand with circuit breaker protection
   */
  async shouldExpandTheme(
    theme: ConsolidatedTheme,
    currentDepth: number,
    diffContent?: string,
    parentTheme?: ConsolidatedTheme,
    siblingThemes?: ConsolidatedTheme[]
  ): Promise<ExpansionDecision> {
    const context = logger.startOperation('Enhanced Expansion Decision', {
      theme: theme.name,
      depth: currentDepth,
    });

    try {
      // Step 1: Analyze actual code changes
      const codeAnalysis = await this.codeAnalyzer.analyzeThemeStructure(
        theme,
        diffContent
      );

      const metrics = {
        totalLines:
          codeAnalysis.actualLinesAdded + codeAnalysis.actualLinesRemoved,
        fileCount: codeAnalysis.actualFilesChanged,
        methodCount: codeAnalysis.actualMethods.length,
        complexityScore: this.calculateComplexityScore(codeAnalysis),
      };

      // Step 2: Check circuit breaker
      const circuitCheck = this.circuitBreaker.shouldAllowExpansion(
        theme,
        currentDepth,
        metrics
      );

      if (!circuitCheck.allowed) {
        logger.endOperation(context, true, {
          decision: 'blocked by circuit breaker',
          reason: circuitCheck.reason,
        });

        return {
          shouldExpand: false,
          isAtomic: true,
          reasoning: circuitCheck.reason,
          confidence: circuitCheck.confidence,
          businessContext: 'Change is sufficiently focused',
          technicalContext: `${metrics.totalLines} lines, ${metrics.fileCount} files`,
          testabilityAssessment: 'Can be tested as a unit',
          suggestedSubThemes: null,
        };
      }

      // Step 3: Check cache
      const cacheKey = this.getCacheKey(theme, currentDepth, codeAnalysis);
      const cached = this.decisionCache.get(cacheKey);
      if (cached) {
        logger.endOperation(context, true, { decision: 'cached' });
        return cached;
      }

      // Step 4: Build enhanced prompt with actual metrics
      const prompt = this.buildEnhancedPrompt(
        theme,
        currentDepth,
        codeAnalysis,
        parentTheme,
        siblingThemes
      );

      // Step 5: Get AI decision
      const decision = await this.getAIDecision(prompt, theme, codeAnalysis);

      // Step 6: Override AI if it conflicts with hard rules
      const finalDecision = this.applyHardRules(
        decision,
        codeAnalysis,
        currentDepth
      );

      // Cache and return
      this.decisionCache.set(cacheKey, finalDecision);

      logger.endOperation(context, true, {
        decision: finalDecision.shouldExpand ? 'expand' : 'atomic',
        confidence: finalDecision.confidence,
      });

      return finalDecision;
    } catch (error) {
      logger.endOperation(context, false);

      // Fallback decision based on metrics
      return this.createFallbackDecision(theme, currentDepth);
    }
  }

  /**
   * Build enhanced prompt with actual code metrics
   */
  private buildEnhancedPrompt(
    theme: ConsolidatedTheme,
    currentDepth: number,
    analysis: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    parentTheme?: ConsolidatedTheme,
    siblingThemes?: ConsolidatedTheme[]
  ): string {
    const prompt = `Analyze if this theme needs sub-themes based on PRD principles.

Current theme: "${theme.name}"
Description: ${theme.description}
Current depth: ${currentDepth}

ACTUAL METRICS:
- Files: ${analysis.actualFilesChanged}
- Lines: +${analysis.actualLinesAdded}/-${analysis.actualLinesRemoved} (total: ${analysis.actualLinesAdded + analysis.actualLinesRemoved})
- Methods: ${analysis.actualMethods.length} (${analysis.actualMethods.join(', ')})
- Classes: ${analysis.actualClasses.length} (${analysis.actualClasses.join(', ')})
- Complexity: ${analysis.complexity}
- Already atomic: ${analysis.isAtomic}

SPECIFIC CHANGES:
${analysis.fileChanges.map((fc: any) => `- ${fc.file}: ${fc.changes.map((c: any) => `${c.type} ${c.methods.join(',')} (+${c.linesAdded}/-${c.linesRemoved})`).join(', ')}`).join('\n')}

${analysis.expansionHints.length > 0 ? `HINTS:\n${analysis.expansionHints.join('\n')}\n` : ''}

EXPANSION CRITERIA (from PRD):
1. Multiple distinct functional areas in the changes
2. Changes aren't independently testable at current level
3. Single change too complex to understand atomically
4. Different audiences need separation (tech vs business)

ATOMIC CRITERIA (from PRD):
1. Code change is unit-testable as-is (5-15 lines ideal)
2. Node does exactly one thing
3. Further breakdown adds no value
4. Reached indivisible code unit

${parentTheme ? `Parent theme: "${parentTheme.name}"` : ''}
${siblingThemes && siblingThemes.length > 0 ? `Siblings: ${siblingThemes.map((s) => s.name).join(', ')}` : ''}

RESPOND WITH JSON ONLY:
{
  "shouldExpand": boolean,
  "confidence": 0.0-1.0,
  "reasoning": "specific reason based on actual code (max 20 words)",
  "suggestedSubThemes": null or [{"name": "specific action", "files": ["file1"], "rationale": "why separate"}]
}`;

    return prompt;
  }

  /**
   * Get AI decision with structured response
   */
  private async getAIDecision(
    prompt: string,
    theme: ConsolidatedTheme,
    analysis: any // eslint-disable-line @typescript-eslint/no-explicit-any
  ): Promise<ExpansionDecision> {
    try {
      const response = await this.claudeClient.callClaude(prompt);
      const result = JsonExtractor.extractAndValidateJson(response, 'object', [
        'shouldExpand',
        'confidence',
        'reasoning',
      ]);

      if (result.success && result.data) {
        const data = result.data as any; // eslint-disable-line @typescript-eslint/no-explicit-any
        return {
          shouldExpand: Boolean(data.shouldExpand),
          isAtomic: !data.shouldExpand,
          reasoning: data.reasoning || 'AI analysis complete',
          confidence: Number(data.confidence) || 0.7,
          businessContext: theme.businessImpact || 'Business impact',
          technicalContext: `${analysis.actualMethods.length} methods, ${analysis.actualFilesChanged} files`,
          testabilityAssessment: data.shouldExpand
            ? 'Requires separation for testing'
            : 'Testable as unit',
          suggestedSubThemes: data.suggestedSubThemes || null,
        };
      }
    } catch (error) {
      logger.logError('AI expansion decision failed', error as Error);
    }

    // Fallback to metrics-based decision
    return this.createMetricsBasedDecision(theme, analysis);
  }

  /**
   * Apply hard rules that override AI decisions
   */
  private applyHardRules(
    aiDecision: ExpansionDecision,
    analysis: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    currentDepth: number
  ): ExpansionDecision {
    // Rule 1: Single line is always atomic
    if (analysis.actualLinesAdded + analysis.actualLinesRemoved <= 1) {
      return {
        ...aiDecision,
        shouldExpand: false,
        isAtomic: true,
        reasoning: 'Single line change is atomic',
        confidence: 1.0,
      };
    }

    // Rule 2: Depth 10+ should not expand (PRD limit)
    if (currentDepth >= 10 && aiDecision.shouldExpand) {
      return {
        ...aiDecision,
        shouldExpand: false,
        isAtomic: true,
        reasoning: 'Maximum depth reached',
        confidence: 0.95,
      };
    }

    // Rule 3: Already marked atomic by analyzer
    if (analysis.isAtomic && aiDecision.shouldExpand) {
      return {
        ...aiDecision,
        shouldExpand: false,
        isAtomic: true,
        reasoning: 'Analyzer determined atomic',
        confidence: 0.9,
      };
    }

    return aiDecision;
  }

  /**
   * Create decision based on metrics when AI unavailable
   */
  private createMetricsBasedDecision(
    theme: ConsolidatedTheme,
    analysis: any // eslint-disable-line @typescript-eslint/no-explicit-any
  ): ExpansionDecision {
    const shouldExpand =
      analysis.actualFilesChanged > 1 ||
      analysis.actualMethods.length > 1 ||
      analysis.actualLinesAdded + analysis.actualLinesRemoved > 15;

    return {
      shouldExpand,
      isAtomic: !shouldExpand,
      reasoning: shouldExpand
        ? `${analysis.actualMethods.length} methods across ${analysis.actualFilesChanged} files`
        : 'Small focused change',
      confidence: 0.7,
      businessContext: theme.businessImpact || 'Business context',
      technicalContext: `${analysis.complexity} complexity`,
      testabilityAssessment: shouldExpand
        ? 'Needs separation'
        : 'Testable as-is',
      suggestedSubThemes: null,
    };
  }

  /**
   * Create fallback decision when analysis fails
   */
  private createFallbackDecision(
    theme: ConsolidatedTheme,
    _currentDepth: number // eslint-disable-line @typescript-eslint/no-unused-vars
  ): ExpansionDecision {
    // Conservative: don't expand on error
    return {
      shouldExpand: false,
      isAtomic: true,
      reasoning: 'Analysis failed - treating as atomic',
      confidence: 0.5,
      businessContext: theme.businessImpact || 'Unknown',
      technicalContext: 'Analysis unavailable',
      testabilityAssessment: 'Treat as single unit',
      suggestedSubThemes: null,
    };
  }

  /**
   * Calculate complexity score for circuit breaker
   */
  private calculateComplexityScore(analysis: any): number {
    // eslint-disable-line @typescript-eslint/no-explicit-any
    return (
      analysis.actualFilesChanged * 2 +
      analysis.actualMethods.length * 3 +
      analysis.actualClasses.length * 3 +
      (analysis.actualLinesAdded + analysis.actualLinesRemoved) / 10
    );
  }

  /**
   * Generate cache key
   */
  private getCacheKey(
    theme: ConsolidatedTheme,
    depth: number,
    analysis: any // eslint-disable-line @typescript-eslint/no-explicit-any
  ): string {
    return `${theme.id}_${depth}_${analysis.actualFilesChanged}_${analysis.actualMethods.length}`;
  }
}

/**
 * Expansion decision result
 */
export interface ExpansionDecision {
  shouldExpand: boolean;
  isAtomic: boolean;
  reasoning: string;
  confidence: number;
  businessContext: string;
  technicalContext: string;
  testabilityAssessment: string;
  suggestedSubThemes: Array<{
    name: string;
    files: string[];
    rationale: string;
  }> | null;
}
