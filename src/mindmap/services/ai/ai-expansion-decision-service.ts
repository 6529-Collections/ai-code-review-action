import { ConsolidatedTheme } from '../../types/similarity-types';
import { ClaudeClient } from '../../../shared/utils/claude-client';
import { JsonExtractor } from '../../../shared/utils/json-extractor';
import { logInfo, logError } from '../../../utils/index';
import { CodeStructureAnalyzer } from '../code-structure-analyzer';
import { UnopinionatedAnalysisService } from './unopinionated-analysis-service';
import { ValidationService } from './validation-service';
import { 
  ThemeAnalysis, 
  ValidationResult, 
  MultiStageDecision, 
  DEFAULT_MULTI_STAGE_CONFIG,
  MultiStageConfig 
} from '../../types/multi-stage-types';

/**
 * Multi-stage AI-driven expansion decision service
 * Uses unopinionated analysis followed by validation for better decisions
 */
export class AIExpansionDecisionService {
  private claudeClient: ClaudeClient;
  private decisionCache: Map<string, ExpansionDecision>;
  private codeAnalyzer: CodeStructureAnalyzer;
  private analysisService: UnopinionatedAnalysisService;
  private validationService: ValidationService;
  private config: MultiStageConfig;

  constructor(anthropicApiKey: string, config: MultiStageConfig = DEFAULT_MULTI_STAGE_CONFIG) {
    this.claudeClient = new ClaudeClient(anthropicApiKey);
    this.decisionCache = new Map();
    this.codeAnalyzer = new CodeStructureAnalyzer();
    this.analysisService = new UnopinionatedAnalysisService(this.claudeClient);
    this.validationService = new ValidationService(this.claudeClient);
    this.config = config;
  }

  /**
   * Main decision point: Should this theme be expanded?
   * Uses multi-stage analysis: unopinionated analysis → validation → final decision
   */
  async shouldExpandTheme(
    theme: ConsolidatedTheme,
    currentDepth: number,
    parentTheme?: ConsolidatedTheme,
    siblingThemes?: ConsolidatedTheme[]
  ): Promise<ExpansionDecision> {
    const startTime = Date.now();
    const decisionTrace: string[] = [];
    
    // Enhanced cache check with analysis hash
    const analysisHash = await this.getAnalysisHash(theme);
    const cacheKey = `${theme.id}_${currentDepth}_${analysisHash}`;
    if (this.decisionCache.has(cacheKey)) {
      const cachedDecision = this.decisionCache.get(cacheKey);
      if (cachedDecision) {
        logInfo(`Using cached decision for theme "${theme.name}" at depth ${currentDepth}`);
        return cachedDecision;
      }
    }

    try {
      // Stage 1: Unopinionated Analysis
      decisionTrace.push(`Starting multi-stage analysis for theme "${theme.name}" at depth ${currentDepth}`);
      const analysis = await this.analysisService.analyzeTheme(theme);
      decisionTrace.push(`Analysis completed: ${analysis.separableConcerns.length} concerns, complexity: ${analysis.codeComplexity}`);
      
      // Stage 2: Quick Decision Check (optimization)
      if (this.config.enableQuickDecisions) {
        const quickDecision = this.makeQuickDecision(analysis, currentDepth, decisionTrace);
        if (quickDecision) {
          decisionTrace.push(`Quick decision applied: ${quickDecision.reasoning}`);
          this.decisionCache.set(cacheKey, quickDecision);
          return quickDecision;
        }
      }
      
      // Stage 3: Validation
      decisionTrace.push('Proceeding to validation stage');
      const validation = await this.validationService.validateExpansionDecision(
        theme,
        analysis,
        currentDepth
      );
      decisionTrace.push(`Validation completed: expand=${validation.shouldExpand}, confidence=${validation.confidence}`);
      
      // Stage 4: Consistency Check (if enabled)
      if (this.config.enableConsistencyCheck && this.needsConsistencyCheck(validation)) {
        decisionTrace.push('Running consistency check due to score variance');
        const adjusted = await this.performConsistencyCheck(theme, analysis, validation, currentDepth);
        if (adjusted) {
          decisionTrace.push('Decision adjusted by consistency check');
          validation.shouldExpand = adjusted.shouldExpand;
          validation.confidence = adjusted.confidence;
          validation.reasoning = `Consistency-adjusted: ${adjusted.reasoning}`;
        }
      }
      
      // Stage 5: Build Final Decision
      const decision = this.buildDecisionFromValidation(validation, decisionTrace);
      
      // Stage 6: Extract Sub-themes if expanding
      if (decision.shouldExpand) {
        decision.suggestedSubThemes = await this.extractSubThemes(theme, analysis, validation);
      }
      
      const processingTime = Date.now() - startTime;
      logInfo(`Multi-stage decision completed for "${theme.name}" in ${processingTime}ms: expand=${decision.shouldExpand}`);
      
      this.decisionCache.set(cacheKey, decision);
      return decision;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      decisionTrace.push(`Error in multi-stage analysis: ${errorMessage}`);
      logError(`Multi-stage decision failed for theme "${theme.name}": ${errorMessage}`);
      const fallbackDecision = this.getDefaultDecision(theme, currentDepth, decisionTrace);
      this.decisionCache.set(cacheKey, fallbackDecision);
      return fallbackDecision;
    }
  }

  /**
   * Generate a simple hash for theme analysis caching
   */
  private async getAnalysisHash(theme: ConsolidatedTheme): Promise<string> {
    const content = `${theme.id}_${theme.affectedFiles.join(',')}_${theme.codeSnippets.join('')}`;
    // Simple hash - in production you might want a proper hash function
    return Buffer.from(content).toString('base64').slice(0, 16);
  }


  /**
   * Make quick decision for obvious cases to avoid unnecessary AI calls
   */
  private makeQuickDecision(
    analysis: ThemeAnalysis,
    currentDepth: number,
    decisionTrace: string[]
  ): ExpansionDecision | null {
    // Ultra-high confidence atomic detection
    if (
      currentDepth >= this.config.quickDecisionDepthThreshold ||
      (analysis.codeMetrics.distinctOperations === 1 && 
       analysis.separableConcerns.length === 0 &&
       analysis.codeComplexity === 'low')
    ) {
      return {
        shouldExpand: false,
        isAtomic: true,
        reasoning: `Quick decision: Obviously atomic (depth ${currentDepth}, single operation, no separable concerns)`,
        businessContext: analysis.actualPurpose,
        technicalContext: 'Atomic operation',
        testabilityAssessment: 'Single test case sufficient',
        suggestedSubThemes: null
      };
    }
    
    // Ultra-high confidence expansion
    if (
      currentDepth <= 2 &&
      analysis.separableConcerns.length >= 3 &&
      analysis.codeMetrics.hasMultipleAlgorithms &&
      analysis.codeComplexity === 'high'
    ) {
      return {
        shouldExpand: true,
        isAtomic: false,
        reasoning: `Quick decision: Obviously needs expansion (shallow depth, ${analysis.separableConcerns.length} concerns, multiple algorithms)`,
        businessContext: analysis.actualPurpose,
        technicalContext: 'Multiple complex algorithms',
        testabilityAssessment: 'Multiple test suites required',
        suggestedSubThemes: null // Will be populated later
      };
    }
    
    return null; // Needs full validation
  }

  /**
   * Check if validation scores are inconsistent and need consistency check
   */
  private needsConsistencyCheck(validation: ValidationResult): boolean {
    const scores = [
      validation.granularityScore,
      validation.depthAppropriatenessScore,
      validation.businessValueScore,
      validation.testBoundaryScore
    ];
    
    const avg = scores.reduce((a, b) => a + b) / scores.length;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - avg, 2), 0) / scores.length;
    
    // High variance suggests inconsistent reasoning
    return variance > this.config.consistencyVarianceThreshold;
  }

  /**
   * Perform consistency check when validation scores are contradictory
   */
  private async performConsistencyCheck(
    theme: ConsolidatedTheme,
    analysis: ThemeAnalysis,
    validation: ValidationResult,
    currentDepth: number
  ): Promise<{ shouldExpand: boolean; confidence: number; reasoning: string } | null> {
    const prompt = `CONSISTENCY CHECK

Theme: "${theme.name}" at depth ${currentDepth}

ANALYSIS: ${analysis.actualPurpose}
Separable concerns: ${analysis.separableConcerns.length}
Complexity: ${analysis.codeComplexity}

VALIDATION SCORES (showing inconsistency):
- Granularity: ${validation.granularityScore}
- Depth Appropriateness: ${validation.depthAppropriatenessScore}  
- Business Value: ${validation.businessValueScore}
- Test Boundary: ${validation.testBoundaryScore}

CURRENT DECISION: expand=${validation.shouldExpand}, confidence=${validation.confidence}

The validation scores show high variance, suggesting inconsistent reasoning.
Re-evaluate the decision with focus on consistency.

Should the decision be adjusted? Respond with JSON:
{
  "needsAdjustment": boolean,
  "adjustedShouldExpand": boolean,
  "adjustedConfidence": number,
  "reasoning": "explanation for adjustment"
}`;

    try {
      const response = await this.claudeClient.callClaude(prompt);
      const result = JsonExtractor.extractAndValidateJson(response, 'object', ['needsAdjustment']);
      
      if (result.success && (result.data as any).needsAdjustment) {
        const data = result.data as any;
        return {
          shouldExpand: data.adjustedShouldExpand,
          confidence: data.adjustedConfidence,
          reasoning: data.reasoning
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logError(`Consistency check failed: ${errorMessage}`);
    }
    
    return null; // No adjustment needed or failed
  }

  /**
   * Build final expansion decision from validation result
   */
  private buildDecisionFromValidation(
    validation: ValidationResult,
    decisionTrace: string[]
  ): ExpansionDecision {
    return {
      shouldExpand: validation.shouldExpand,
      isAtomic: !validation.shouldExpand,
      reasoning: validation.reasoning,
      businessContext: `Business value score: ${validation.businessValueScore.toFixed(2)}`,
      technicalContext: `Granularity score: ${validation.granularityScore.toFixed(2)}`,
      testabilityAssessment: `Test boundary score: ${validation.testBoundaryScore.toFixed(2)}`,
      suggestedSubThemes: null // Will be populated if expanding
    };
  }

  /**
   * Extract sub-themes when expansion is decided
   */
  private async extractSubThemes(
    theme: ConsolidatedTheme,
    analysis: ThemeAnalysis,
    validation: ValidationResult
  ): Promise<Array<{ name: string; description: string; files: string[]; rationale: string }> | null> {
    if (analysis.separableConcerns.length === 0) {
      return null;
    }

    // Build prompt for intelligent sub-theme extraction
    const prompt = `Based on the analysis, create specific sub-themes for this theme.

THEME: "${theme.name}"
Files: ${theme.affectedFiles.join(', ')}

ANALYSIS RESULTS:
- Purpose: ${analysis.actualPurpose}
- Separable Concerns: ${analysis.separableConcerns.join(', ')}
- Complexity: ${analysis.codeComplexity}
- Test Scenarios: ${analysis.testScenarios}

CODE CONTEXT:
${theme.codeSnippets.slice(0, 3).map((snippet, i) => `Snippet ${i + 1}:\n${snippet.substring(0, 500)}...`).join('\n\n')}

Create sub-themes for each separable concern. Each sub-theme should:
1. Have a clear, specific name (not just the concern name)
2. Include only the files it actually modifies
3. Be independently testable and reviewable

CRITICAL: Each sub-theme MUST specify which files from the parent's list it affects.
If parent has only 1 file, all sub-themes must use that file.
Otherwise, distribute files logically based on the concern.

Respond with JSON:
{
  "subThemes": [
    {
      "name": "Clear action-oriented name (max 8 words)",
      "description": "What this sub-theme specifically does (1-2 sentences)",
      "files": ["list only the relevant files from parent theme"],
      "rationale": "Why this is a separate concern (1 sentence)"
    }
  ]
}`;

    try {
      const response = await this.claudeClient.callClaude(prompt);
      const extractionResult = JsonExtractor.extractAndValidateJson(
        response,
        'object',
        ['subThemes']
      );
      
      if (!extractionResult.success) {
        logError(`Failed to extract sub-themes: ${extractionResult.error}`);
        // Fallback to simple mapping
        return this.getFallbackSubThemes(theme, analysis);
      }
      
      const data = extractionResult.data as { subThemes: Array<{
        name: string;
        description: string;
        files: string[];
        rationale: string;
      }> };
      
      // Validate that all files are from parent theme
      const validatedSubThemes = data.subThemes.map(subTheme => {
        const validFiles = subTheme.files.filter(file => 
          theme.affectedFiles.includes(file)
        );
        
        if (validFiles.length === 0) {
          logError(`Sub-theme "${subTheme.name}" has no valid files, using all parent files`);
          validFiles.push(...theme.affectedFiles);
        }
        
        return {
          ...subTheme,
          files: validFiles
        };
      });
      
      return validatedSubThemes.length > 0 ? validatedSubThemes : null;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logError(`Sub-theme extraction failed: ${errorMessage}`);
      return this.getFallbackSubThemes(theme, analysis);
    }
  }

  /**
   * Fallback sub-theme generation when AI extraction fails
   */
  private getFallbackSubThemes(
    theme: ConsolidatedTheme,
    analysis: ThemeAnalysis
  ): Array<{ name: string; description: string; files: string[]; rationale: string }> | null {
    if (analysis.separableConcerns.length === 0) {
      return null;
    }

    // Simple mapping as fallback
    const subThemes = analysis.separableConcerns.map((concern, index) => ({
      name: concern,
      description: `Handles ${concern.toLowerCase()} functionality`,
      files: theme.affectedFiles, // All sub-themes inherit parent files for now
      rationale: `Separated as distinct concern identified in analysis`
    }));

    return subThemes.length > 0 ? subThemes : null;
  }

  /**
   * Generate default decision when all stages fail
   */
  private getDefaultDecision(
    theme: ConsolidatedTheme,
    currentDepth: number,
    decisionTrace: string[]
  ): ExpansionDecision {
    const shouldExpand = currentDepth < 8 && theme.affectedFiles.length > 1;
    
    return {
      shouldExpand,
      isAtomic: !shouldExpand,
      reasoning: `Fallback decision: depth ${currentDepth}, ${theme.affectedFiles.length} files. Trace: ${decisionTrace.join(' → ')}`,
      businessContext: 'Unable to analyze business context',
      technicalContext: 'Unable to analyze technical context',
      testabilityAssessment: 'Unable to assess testability',
      suggestedSubThemes: null
    };
  }


  /**
   * Clear the decision cache
   */
  clearCache(): void {
    this.decisionCache.clear();
  }
}

/**
 * Simplified expansion decision structure
 */
export interface ExpansionDecision {
  shouldExpand: boolean;
  isAtomic: boolean;
  reasoning: string;
  businessContext: string;
  technicalContext: string;
  testabilityAssessment: string;
  suggestedSubThemes: Array<{
    name: string;
    description: string;
    files: string[];
    rationale: string;
  }> | null;
}
