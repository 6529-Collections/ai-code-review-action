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
 * Custom error for sub-theme extraction failures
 */
class SubThemeExtractionError extends Error {
  constructor(
    message: string,
    public themeName: string,
    public themeId: string,
    public aiResponse?: string,
    public parseError?: string,
    public expectedFormat?: string
  ) {
    super(message);
    this.name = 'SubThemeExtractionError';
    
    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, SubThemeExtractionError.prototype);
  }
}

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
      
      // Stage 2: AI Validation (no mechanical shortcuts)
      // All themes now go through full AI validation for better decision quality
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
        logInfo(`Extracting sub-themes for "${theme.name}" - ${analysis.separableConcerns.length} concerns identified`);
        decision.suggestedSubThemes = await this.extractSubThemes(theme, analysis, validation);
        logInfo(`Sub-themes extracted: ${decision.suggestedSubThemes?.length || 0} themes generated`);
      } else {
        logInfo(`Skipping sub-theme extraction for "${theme.name}" - shouldExpand=false`);
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
    logInfo(`Building decision from validation: shouldExpand=${validation.shouldExpand}, confidence=${validation.confidence}`);
    logInfo(`Validation scores: granularity=${validation.granularityScore.toFixed(2)}, depth=${validation.depthAppropriatenessScore.toFixed(2)}, business=${validation.businessValueScore.toFixed(2)}, test=${validation.testBoundaryScore.toFixed(2)}`);
    
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

    const expectedFormat = `{
  "subThemes": [
    {
      "name": "string",
      "description": "string", 
      "files": ["string"],
      "rationale": "string"
    }
  ]
}`;

    let response: string;
    try {
      response = await this.claudeClient.callClaude(prompt);
    } catch (error) {
      throw new SubThemeExtractionError(
        `AI call failed for sub-theme extraction`,
        theme.name,
        theme.id,
        undefined,
        error instanceof Error ? error.message : String(error),
        expectedFormat
      );
    }

    // Parse AI response
    const extractionResult = JsonExtractor.extractAndValidateJson(
      response,
      'object',
      ['subThemes']
    );
    
    if (!extractionResult.success) {
      throw new SubThemeExtractionError(
        `Failed to parse sub-themes JSON response`,
        theme.name,
        theme.id,
        response.substring(0, 1000), // Include first 1000 chars of response
        extractionResult.error,
        expectedFormat
      );
    }
    
    const data = extractionResult.data as { subThemes: Array<{
      name: string;
      description: string;
      files: string[];
      rationale: string;
    }> };
    
    // Validate sub-themes structure and files
    const validatedSubThemes = data.subThemes.map((subTheme, index) => {
      // Validate required fields
      if (!subTheme.name || !subTheme.description || !Array.isArray(subTheme.files) || !subTheme.rationale) {
        throw new SubThemeExtractionError(
          `Sub-theme at index ${index} missing required fields`,
          theme.name,
          theme.id,
          JSON.stringify(subTheme),
          'Missing one of: name, description, files[], rationale',
          expectedFormat
        );
      }

      // Validate files are from parent theme
      const invalidFiles = subTheme.files.filter(file => 
        !theme.affectedFiles.includes(file)
      );
      
      if (invalidFiles.length > 0) {
        throw new SubThemeExtractionError(
          `Sub-theme "${subTheme.name}" contains invalid files not in parent theme`,
          theme.name,
          theme.id,
          JSON.stringify({ 
            invalidFiles, 
            parentFiles: theme.affectedFiles,
            subThemeFiles: subTheme.files 
          }),
          `Invalid files: ${invalidFiles.join(', ')}`,
          `Files must be from parent theme: ${theme.affectedFiles.join(', ')}`
        );
      }
      
      if (subTheme.files.length === 0) {
        throw new SubThemeExtractionError(
          `Sub-theme "${subTheme.name}" has no files assigned`,
          theme.name,
          theme.id,
          JSON.stringify(subTheme),
          'Sub-theme must have at least one file from parent theme',
          `Available parent files: ${theme.affectedFiles.join(', ')}`
        );
      }
      
      return subTheme;
    });
    
    if (validatedSubThemes.length === 0) {
      throw new SubThemeExtractionError(
        'AI returned empty sub-themes array',
        theme.name,
        theme.id,
        response.substring(0, 500),
        'No sub-themes generated despite having separable concerns',
        expectedFormat
      );
    }
    
    return validatedSubThemes;
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
