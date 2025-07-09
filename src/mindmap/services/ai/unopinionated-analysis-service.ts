import { ConsolidatedTheme } from '../../types/similarity-types';
import { ThemeAnalysis } from '../../types/multi-stage-types';
import { ClaudeClient } from '../../../shared/utils/claude-client';
import { JsonExtractor } from '../../../shared/utils/json-extractor';
import { logInfo, logError } from '../../../utils/index';

/**
 * Service for performing unopinionated analysis of themes
 * Analyzes code structure and content without depth-based bias
 */
export class UnopinionatedAnalysisService {
  constructor(private claudeClient: ClaudeClient) {}

  /**
   * Analyze a theme based purely on its code content and structure
   */
  async analyzeTheme(theme: ConsolidatedTheme): Promise<ThemeAnalysis> {
    const prompt = this.buildAnalysisPrompt(theme);
    
    try {
      const response = await this.claudeClient.callClaude(prompt);
      
      const extractionResult = JsonExtractor.extractAndValidateJson(
        response,
        'object',
        ['actualPurpose', 'codeComplexity', 'separableConcerns', 'testScenarios', 'reviewerPerspective', 'codeMetrics']
      );
      
      if (!extractionResult.success) {
        throw new Error(extractionResult.error || 'Failed to extract JSON');
      }
      
      const analysis = extractionResult.data as ThemeAnalysis;
      if (!this.validateAnalysisResponse(analysis)) {
        throw new Error('Invalid analysis response structure');
      }
      
      logInfo(`Theme analysis completed for "${theme.name}": ${analysis.separableConcerns.length} concerns identified`);
      return analysis;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logError(`Analysis failed for theme "${theme.name}": ${errorMessage}`);
      return this.getDefaultAnalysis(theme);
    }
  }

  /**
   * Build unopinionated analysis prompt
   */
  private buildAnalysisPrompt(theme: ConsolidatedTheme): string {
    return `THEME ANALYSIS - UNOPINIONATED

Analyze this code theme based purely on its content and structure. 
Do not consider theme names or descriptions if they don't match the actual code.
Focus only on what the code actually does.

THEME INFORMATION:
Name: "${theme.name}"
Description: ${theme.description}
Files: ${theme.affectedFiles.join(', ')}

CODE CHANGES:
${this.formatCodeSnippets(theme.codeSnippets)}

ANALYSIS FRAMEWORK:

1. ACTUAL PURPOSE
   - What does this code actually accomplish?
   - Ignore theme name/description if they contradict the code
   - Focus on concrete changes and their effects

2. CODE STRUCTURE ANALYSIS
   - Count distinct functions/methods being modified
   - Count distinct classes/interfaces being modified  
   - Identify distinct algorithms or logical processes
   - Note natural boundaries in the code

3. SEPARABILITY ANALYSIS
   - List each distinct responsibility or concern
   - Could these responsibilities be tested independently?
   - Do they share state or are they logically isolated?
   - Are there clear interfaces between different parts?

4. REVIEWER PERSPECTIVE
   - Would a code reviewer see this as one cohesive change?
   - Or would they naturally comment on different aspects?
   - What would be the natural review points?

5. TESTING IMPLICATIONS
   - How many distinct test scenarios would this require?
   - Could one comprehensive test cover everything?
   - Would multiple focused tests provide better coverage?
   - Are there error paths that need separate testing?

RESPOND WITH ONLY VALID JSON:
{
  "actualPurpose": "What this theme really accomplishes (1-2 sentences)",
  "codeComplexity": "low|medium|high",
  "separableConcerns": ["list", "of", "distinct", "responsibilities"],
  "testScenarios": <number_of_test_scenarios>,
  "reviewerPerspective": "How a reviewer would naturally see this change",
  "codeMetrics": {
    "functionCount": <number_of_functions_modified>,
    "classCount": <number_of_classes_modified>,
    "distinctOperations": <number_of_distinct_logical_operations>,
    "hasMultipleAlgorithms": <boolean>,
    "hasNaturalBoundaries": <boolean>
  }
}`;
  }

  /**
   * Format code snippets for analysis
   */
  private formatCodeSnippets(codeSnippets: string[]): string {
    if (codeSnippets.length === 0) {
      return 'No code snippets provided';
    }

    return codeSnippets
      .map((snippet, index) => `--- Code Snippet ${index + 1} ---\n${snippet}`)
      .join('\n\n');
  }

  /**
   * Validate analysis response structure
   */
  private validateAnalysisResponse(data: any): data is ThemeAnalysis {
    return (
      typeof data === 'object' &&
      typeof data.actualPurpose === 'string' &&
      ['low', 'medium', 'high'].includes(data.codeComplexity) &&
      Array.isArray(data.separableConcerns) &&
      typeof data.testScenarios === 'number' &&
      typeof data.reviewerPerspective === 'string' &&
      typeof data.codeMetrics === 'object' &&
      typeof data.codeMetrics.functionCount === 'number' &&
      typeof data.codeMetrics.classCount === 'number' &&
      typeof data.codeMetrics.distinctOperations === 'number' &&
      typeof data.codeMetrics.hasMultipleAlgorithms === 'boolean' &&
      typeof data.codeMetrics.hasNaturalBoundaries === 'boolean'
    );
  }

  /**
   * Generate default analysis when AI analysis fails
   */
  private getDefaultAnalysis(theme: ConsolidatedTheme): ThemeAnalysis {
    const fileCount = theme.affectedFiles.length;
    const codeLength = theme.codeSnippets.join('').length;
    
    return {
      actualPurpose: `Modifies ${fileCount} file(s) with changes to existing functionality`,
      codeComplexity: codeLength > 1000 ? 'medium' : 'low',
      separableConcerns: [],
      testScenarios: 1,
      reviewerPerspective: 'Single cohesive change requiring one review pass',
      codeMetrics: {
        functionCount: Math.min(fileCount, 2), // Conservative estimate
        classCount: Math.min(fileCount, 1),
        distinctOperations: 1,
        hasMultipleAlgorithms: false,
        hasNaturalBoundaries: fileCount > 1
      }
    };
  }
}