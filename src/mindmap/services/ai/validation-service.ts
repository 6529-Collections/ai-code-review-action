import { ConsolidatedTheme } from '../../types/similarity-types';
import { ThemeAnalysis, ValidationResult } from '../../types/multi-stage-types';
import { ClaudeClient } from '../../../shared/utils/claude-client';
import { JsonExtractor } from '../../../shared/utils/json-extractor';
import { logInfo, logError } from '../../../utils/index';

/**
 * Service for validating expansion decisions through self-reflection
 */
export class ValidationService {
  constructor(private claudeClient: ClaudeClient) {}

  /**
   * Validate expansion decision through multi-criteria analysis
   */
  async validateExpansionDecision(
    theme: ConsolidatedTheme,
    analysis: ThemeAnalysis,
    currentDepth: number,
    initialInclination?: { shouldExpand: boolean; confidence: number }
  ): Promise<ValidationResult> {
    const prompt = this.buildValidationPrompt(
      theme,
      analysis,
      currentDepth,
      initialInclination
    );
    
    try {
      const response = await this.claudeClient.callClaude(prompt);
      
      const extractionResult = JsonExtractor.extractAndValidateJson(
        response,
        'object',
        ['shouldExpand', 'confidence', 'reasoning', 'correctedFromInitial', 'validationFindings', 'granularityScore', 'depthAppropriatenessScore', 'businessValueScore', 'testBoundaryScore']
      );
      
      if (!extractionResult.success) {
        throw new Error(extractionResult.error || 'Failed to extract JSON');
      }
      
      const validation = extractionResult.data as ValidationResult;
      if (!this.validateValidationResponse(validation)) {
        throw new Error('Invalid validation response structure');
      }
      
      logInfo(`Validation completed for "${theme.name}" at depth ${currentDepth}: expand=${validation.shouldExpand}, confidence=${validation.confidence}`);
      return validation;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logError(`Validation failed for theme "${theme.name}": ${errorMessage}`);
      return this.getDefaultValidation(analysis, currentDepth);
    }
  }

  /**
   * Build validation prompt with self-reflection
   */
  private buildValidationPrompt(
    theme: ConsolidatedTheme,
    analysis: ThemeAnalysis,
    currentDepth: number,
    initialInclination?: { shouldExpand: boolean; confidence: number }
  ): string {
    return `EXPANSION VALIDATION

You will validate whether a theme should be expanded using multi-criteria analysis.

CONTEXT:
Theme: "${theme.name}"
Current Depth: ${currentDepth}
${initialInclination ? `Initial Inclination: expand=${initialInclination.shouldExpand} (confidence: ${initialInclination.confidence})` : ''}

ANALYSIS RESULTS:
- Purpose: ${analysis.actualPurpose}
- Complexity: ${analysis.codeComplexity}
- Separable Concerns: ${analysis.separableConcerns.length > 0 ? analysis.separableConcerns.join(', ') : 'None identified'}
- Test Scenarios: ${analysis.testScenarios}
- Functions Modified: ${analysis.codeMetrics.functionCount}
- Classes Modified: ${analysis.codeMetrics.classCount}
- Distinct Operations: ${analysis.codeMetrics.distinctOperations}
- Multiple Algorithms: ${analysis.codeMetrics.hasMultipleAlgorithms}
- Natural Boundaries: ${analysis.codeMetrics.hasNaturalBoundaries}

VALIDATION FRAMEWORK:

1. GRANULARITY CHECK (Score 0.0-1.0)
   Evaluate if this theme is at appropriate granularity:
   - 0.0-0.3: Over-granular (single method call, variable assignment, trivial operation)
   - 0.4-0.6: Borderline (simple orchestration, wrapper functions, basic coordination)
   - 0.7-1.0: Appropriate granularity (meaningful business logic, complex algorithms)
   
   Questions:
   - Is this just a single method call or property assignment?
   - Does it contain actual business logic or just coordination?
   - Would splitting this create artificial boundaries?

2. DEPTH APPROPRIATENESS (Score 0.0-1.0)
   Evaluate expansion appropriateness at depth ${currentDepth}:
   - Depths 0-3: High-level themes, expansion often valuable (bias toward 0.7-1.0)
   - Depths 4-8: Feature level, balance needed (evaluate on merit)
   - Depths 9-12: Implementation details, resist expansion (bias toward 0.3-0.6)
   - Depths 13+: Very deep, almost never expand (bias toward 0.0-0.3)
   
   Question: Is this the right depth for this level of granularity?

3. BUSINESS VALUE (Score 0.0-1.0)
   Evaluate if expansion improves understanding:
   - Would sub-themes make the code clearer to understand?
   - Would they help during code review?
   - Or would they just create unnecessary fragmentation?

4. TEST BOUNDARY (Score 0.0-1.0)
   Evaluate testing implications:
   - Would sub-themes naturally have distinct test cases?
   - Or is this logically one unit that should be tested together?
   - Are there natural error paths that suggest separation?

SELF-REFLECTION:
${initialInclination ? `
You initially thought: expand=${initialInclination.shouldExpand} with confidence ${initialInclination.confidence}
- Does your detailed analysis support this initial thought?
- What evidence supports or contradicts your initial inclination?
- Should you correct your initial assessment?
` : ''}

Based on the four validation criteria above, make your final decision.

RESPOND WITH ONLY VALID JSON:
{
  "shouldExpand": <boolean>,
  "confidence": <0.0-1.0>,
  "reasoning": "Explanation based on validation criteria (max 100 words)",
  "correctedFromInitial": <boolean>,
  "validationFindings": ["key", "insights", "from", "validation", "checks"],
  "granularityScore": <0.0-1.0>,
  "depthAppropriatenessScore": <0.0-1.0>,
  "businessValueScore": <0.0-1.0>,
  "testBoundaryScore": <0.0-1.0>
}`;
  }

  /**
   * Validate validation response structure
   */
  private validateValidationResponse(data: any): data is ValidationResult {
    return (
      typeof data === 'object' &&
      typeof data.shouldExpand === 'boolean' &&
      typeof data.confidence === 'number' &&
      data.confidence >= 0 && data.confidence <= 1 &&
      typeof data.reasoning === 'string' &&
      typeof data.correctedFromInitial === 'boolean' &&
      Array.isArray(data.validationFindings) &&
      typeof data.granularityScore === 'number' &&
      data.granularityScore >= 0 && data.granularityScore <= 1 &&
      typeof data.depthAppropriatenessScore === 'number' &&
      data.depthAppropriatenessScore >= 0 && data.depthAppropriatenessScore <= 1 &&
      typeof data.businessValueScore === 'number' &&
      data.businessValueScore >= 0 && data.businessValueScore <= 1 &&
      typeof data.testBoundaryScore === 'number' &&
      data.testBoundaryScore >= 0 && data.testBoundaryScore <= 1
    );
  }

  /**
   * Generate default validation when AI validation fails
   */
  private getDefaultValidation(
    analysis: ThemeAnalysis,
    currentDepth: number
  ): ValidationResult {
    // Conservative defaults based on analysis
    const shouldExpand = analysis.separableConcerns.length > 1 && currentDepth < 10;
    const baseConfidence = analysis.separableConcerns.length > 0 ? 0.6 : 0.4;
    
    // Adjust confidence based on depth
    const depthPenalty = Math.max(0, (currentDepth - 8) * 0.1);
    const confidence = Math.max(0.2, baseConfidence - depthPenalty);

    return {
      shouldExpand,
      confidence,
      reasoning: `Default validation: ${analysis.separableConcerns.length} separable concerns at depth ${currentDepth}`,
      correctedFromInitial: false,
      validationFindings: [
        `${analysis.separableConcerns.length} separable concerns identified`,
        `Code complexity: ${analysis.codeComplexity}`,
        `Current depth: ${currentDepth}`
      ],
      granularityScore: analysis.codeMetrics.distinctOperations > 1 ? 0.6 : 0.3,
      depthAppropriatenessScore: Math.max(0.1, 1.0 - (currentDepth * 0.08)),
      businessValueScore: analysis.separableConcerns.length > 1 ? 0.7 : 0.3,
      testBoundaryScore: analysis.testScenarios > 1 ? 0.7 : 0.4
    };
  }
}