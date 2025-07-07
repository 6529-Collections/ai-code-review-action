import { Theme } from '@/shared/types/theme-types';
import { AISimilarityResult } from '../../types/similarity-types';
import { SimilarityCalculator } from '@/shared/utils/similarity-calculator';
import { JsonExtractor } from '@/shared/utils/json-extractor';
import { ClaudeClient } from '@/shared/utils/claude-client';
import { logger } from '@/shared/logger/logger';

export class AISimilarityService {
  private similarityCalculator: SimilarityCalculator;
  private claudeClient: ClaudeClient;

  constructor(private readonly anthropicApiKey: string) {
    this.similarityCalculator = new SimilarityCalculator();
    this.claudeClient = new ClaudeClient(anthropicApiKey);
  }

  async calculateAISimilarity(
    theme1: Theme,
    theme2: Theme
  ): Promise<AISimilarityResult> {
    const prompt = this.buildSimilarityPrompt(theme1, theme2);

    try {
      const output = await this.claudeClient.callClaude(
        prompt,
        'similarity-analysis',
        `${theme1.name} vs ${theme2.name}`
      );
      const result = this.parseAISimilarityResponse(output);


      return result;
    } catch (error) {
      // Fallback to basic string matching
      return this.createFallbackSimilarity(theme1, theme2);
    }
  }

  /**
   * Get Claude client for external metrics access
   */
  getClaudeClient(): ClaudeClient {
    return this.claudeClient;
  }

  private buildSimilarityPrompt(theme1: Theme, theme2: Theme): string {
    // Include rich details if available
    const theme1Details = this.buildThemeDetails(theme1);
    const theme2Details = this.buildThemeDetails(theme2);

    return `Analyze these code changes to determine if they should be grouped together.

**Theme 1: "${theme1.name}"**
${theme1Details}

**Theme 2: "${theme2.name}"**
${theme2Details}

IMPORTANT CONTEXT:
- Look at the actual code changes, not just descriptions
- Consider if these are truly part of the same change or just happen to be similar
- Think about how a developer would organize these changes in their mind
- Consider file relationships and dependencies

Questions to answer:
1. Are these solving the same problem or different problems?
2. Would combining them make the theme clearer or more confusing?
3. Are they in the same domain (e.g., both CI/CD, both UI, both data model)?
4. Do they have logical dependencies on each other?

Be STRICT about merging. Only merge if they are truly the same change or tightly coupled.
It's better to have more specific themes than overly broad ones.

CRITICAL: Respond with ONLY valid JSON.

{
  "shouldMerge": true,
  "confidence": 0.85,
  "reasoning": "Both themes implement the same email validation improvement for user data integrity"
}`;
  }

  private buildThemeDetails(theme: Theme): string {
    let details = `Description: ${theme.description}`;

    // Add detailed description if available
    if (theme.detailedDescription) {
      details += `\nDetailed: ${theme.detailedDescription}`;
    }

    // Add technical summary if available
    if (theme.technicalSummary) {
      details += `\nTechnical: ${theme.technicalSummary}`;
    }

    // Add key changes if available
    if (theme.keyChanges && theme.keyChanges.length > 0) {
      details += `\nKey Changes:\n${theme.keyChanges.map((c) => `  - ${c}`).join('\n')}`;
    }

    // Add files
    details += `\nFiles: ${theme.affectedFiles.join(', ')}`;

    // Add code metrics if available
    if (theme.codeMetrics) {
      const { filesChanged } = theme.codeMetrics;
      details += `\nCode Metrics: ${filesChanged} files changed`;
    }

    // Add main functions/classes if available
    if (theme.mainFunctionsChanged && theme.mainFunctionsChanged.length > 0) {
      details += `\nFunctions Changed: ${theme.mainFunctionsChanged.join(', ')}`;
    }

    if (theme.mainClassesChanged && theme.mainClassesChanged.length > 0) {
      details += `\nClasses Changed: ${theme.mainClassesChanged.join(', ')}`;
    }

    // Add all code snippets - modern context windows can handle it
    const snippets = theme.codeSnippets.join('\n\n');
    if (snippets) {
      details += `\n\nActual Code Changes:\n${snippets}`;
    }

    return details;
  }

  private parseAISimilarityResponse(output: string): AISimilarityResult {
    const extractionResult = JsonExtractor.extractAndValidateJson(
      output,
      'object',
      ['shouldMerge', 'confidence', 'reasoning']
    );

    if (extractionResult.success) {
      const parsed = extractionResult.data as {
        shouldMerge?: boolean;
        confidence?: number;
        reasoning?: string;
      };

      // Map the simple response to the full AISimilarityResult interface
      const shouldMerge = parsed.shouldMerge || false;
      const confidence = parsed.confidence || 0;

      return {
        shouldMerge,
        confidence,
        reasoning: parsed.reasoning || 'No reasoning provided',
        // Derive a semantic score from the decision and confidence
        semanticScore: shouldMerge ? confidence : 1 - confidence,
        // Legacy scores - set to 0 as they're not used anymore
        nameScore: 0,
        descriptionScore: 0,
        patternScore: 0,
        businessScore: 0,
      };
    }

    if (extractionResult.originalResponse) {
    }

    return {
      nameScore: 0,
      descriptionScore: 0,
      patternScore: 0,
      businessScore: 0,
      semanticScore: 0,
      shouldMerge: false,
      confidence: 0,
      reasoning: `Failed to parse AI response: ${extractionResult.error}`,
    };
  }

  private createFallbackSimilarity(
    theme1: Theme,
    theme2: Theme
  ): AISimilarityResult {
    // Fallback when AI fails - conservative approach
    const nameScore = this.similarityCalculator.calculateNameSimilarity(
      theme1.name,
      theme2.name
    );

    // Only merge if names are extremely similar (fallback is conservative)
    const shouldMerge = nameScore > 0.9;

    return {
      shouldMerge,
      confidence: 0.3, // Low confidence for fallback
      reasoning:
        'AI analysis failed - conservative fallback based on name similarity only',
      semanticScore: shouldMerge ? 0.6 : 0.2,
      // Legacy scores - not used
      nameScore: 0,
      descriptionScore: 0,
      patternScore: 0,
      businessScore: 0,
    };
  }

  /**
   * Calculate similarity for multiple theme pairs in a single AI call
   * This is the key performance optimization method
   */
  async calculateBatchSimilarity(
    batchPrompt: string,
    expectedResults: number
  ): Promise<{ results: unknown[] }> {
    try {
      const response = await this.claudeClient.callClaude(
        batchPrompt,
        'batch-similarity',
        `batch of ${expectedResults} pairs`
      );


      // Extract and validate JSON response
      const jsonResult = JsonExtractor.extractAndValidateJson(
        response,
        'object',
        ['results']
      );

      if (!jsonResult.success) {
        throw new Error(`JSON extraction failed: ${jsonResult.error}`);
      }

      const batchData = jsonResult.data as { results: unknown[] };

      // Validate we got the expected number of results
      if (!batchData.results || !Array.isArray(batchData.results)) {
        throw new Error('Invalid batch response: missing results array');
      }

      if (batchData.results.length !== expectedResults) {
      }


      return batchData;
    } catch (error) {
      throw error;
    }
  }
}
