import { Theme } from './theme-service';
import { AISimilarityResult } from '../types/similarity-types';
import { SimilarityCalculator } from '../utils/similarity-calculator';
import { JsonExtractor } from '../utils/json-extractor';
import * as exec from '@actions/exec';
import { SecureFileNamer } from '../utils/secure-file-namer';

export class AISimilarityService {
  private similarityCalculator: SimilarityCalculator;

  constructor(private readonly anthropicApiKey: string) {
    this.similarityCalculator = new SimilarityCalculator();
  }

  async calculateAISimilarity(
    theme1: Theme,
    theme2: Theme
  ): Promise<AISimilarityResult> {
    const prompt = this.buildSimilarityPrompt(theme1, theme2);

    try {
      const { filePath: tempFile, cleanup } =
        SecureFileNamer.createSecureTempFile('claude-similarity', prompt);

      let output = '';
      try {
        await exec.exec('bash', ['-c', `cat "${tempFile}" | claude --print`], {
          listeners: {
            stdout: (data: Buffer) => {
              output += data.toString();
            },
          },
        });

        const result = this.parseAISimilarityResponse(output);
        console.log(
          `[AI-SIMILARITY] "${theme1.name}" vs "${theme2.name}": ${result.shouldMerge ? 'MERGE' : 'SEPARATE'} (confidence: ${result.confidence})`
        );
        console.log(`[AI-SIMILARITY] Reasoning: ${result.reasoning}`);

        return result;
      } finally {
        cleanup(); // Ensure file is cleaned up even if execution fails
      }
    } catch (error) {
      console.warn(
        `AI similarity failed for "${theme1.name}" vs "${theme2.name}":`,
        error
      );
      // Fallback to basic string matching
      return this.createFallbackSimilarity(theme1, theme2);
    }
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
      const { linesAdded, linesRemoved, filesChanged } = theme.codeMetrics;
      details += `\nCode Metrics: +${linesAdded}/-${linesRemoved} lines in ${filesChanged} files`;
    }

    // Add main functions/classes if available
    if (theme.mainFunctionsChanged && theme.mainFunctionsChanged.length > 0) {
      details += `\nFunctions Changed: ${theme.mainFunctionsChanged.join(', ')}`;
    }

    if (theme.mainClassesChanged && theme.mainClassesChanged.length > 0) {
      details += `\nClasses Changed: ${theme.mainClassesChanged.join(', ')}`;
    }

    // Add code snippets (limit to avoid token overflow)
    const snippets = theme.codeSnippets.slice(0, 2).join('\n\n');
    if (snippets) {
      details += `\n\nActual Code Changes:\n${snippets}`;
      if (theme.codeSnippets.length > 2) {
        details += `\n... (${theme.codeSnippets.length - 2} more code snippets)`;
      }
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

    // Log the extraction failure for debugging
    console.warn(
      '[AI-SIMILARITY] JSON extraction failed:',
      extractionResult.error
    );
    if (extractionResult.originalResponse) {
      console.debug(
        '[AI-SIMILARITY] Original response:',
        extractionResult.originalResponse?.substring(0, 200) + '...'
      );
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
    const { filePath: tempFile, cleanup } =
      SecureFileNamer.createSecureTempFile(
        'claude-batch-similarity',
        batchPrompt
      );

    let output = '';
    try {
      await exec.exec('bash', ['-c', `cat "${tempFile}" | claude --print`], {
        listeners: {
          stdout: (data: Buffer) => {
            output += data.toString();
          },
          stderr: (data: Buffer) => {
            console.warn(`[AI-BATCH-SIMILARITY] stderr: ${data.toString()}`);
          },
        },
      });

      console.log(
        `[AI-BATCH-SIMILARITY] Raw response length: ${output.length}`
      );

      // Extract and validate JSON response
      const jsonResult = JsonExtractor.extractAndValidateJson(
        output,
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
        console.warn(
          `[AI-BATCH-SIMILARITY] Expected ${expectedResults} results, got ${batchData.results.length}`
        );
      }

      console.log(
        `[AI-BATCH-SIMILARITY] Successfully processed batch with ${batchData.results.length} results`
      );

      return batchData;
    } catch (error) {
      console.error(`[AI-BATCH-SIMILARITY] Processing failed: ${error}`);
      console.log(
        `[AI-BATCH-SIMILARITY] Raw output: ${output.substring(0, 500)}...`
      );
      throw error;
    } finally {
      cleanup();
    }
  }
}
