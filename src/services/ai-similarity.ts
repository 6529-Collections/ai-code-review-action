import { Theme } from './theme-service';
import { AISimilarityResult } from '../types/similarity-types';
import { SimilarityCalculator } from '../utils/similarity-calculator';
import * as exec from '@actions/exec';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

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
      const tempFile = path.join(
        os.tmpdir(),
        `claude-similarity-${Date.now()}.txt`
      );
      fs.writeFileSync(tempFile, prompt);

      let output = '';
      await exec.exec('bash', ['-c', `cat "${tempFile}" | claude --print`], {
        listeners: {
          stdout: (data: Buffer) => {
            output += data.toString();
          },
        },
      });

      fs.unlinkSync(tempFile);

      const result = this.parseAISimilarityResponse(output);
      console.log(
        `[AI-SIMILARITY] "${theme1.name}" vs "${theme2.name}": ${result.shouldMerge ? 'MERGE' : 'SEPARATE'} (confidence: ${result.confidence})`
      );
      console.log(`[AI-SIMILARITY] Reasoning: ${result.reasoning}`);

      return result;
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
    return `You are a product manager reviewing code changes to determine if they represent the SAME business value or user improvement.

**Theme 1: "${theme1.name}"**
Description: ${theme1.description}
Files: ${theme1.affectedFiles.join(', ')}
Actual Code Changes:
${theme1.codeSnippets.join('\n\n')}

**Theme 2: "${theme2.name}"**
Description: ${theme2.description}
Files: ${theme2.affectedFiles.join(', ')}
Actual Code Changes:
${theme2.codeSnippets.join('\n\n')}

Question: Do these two themes represent the SAME business improvement or user value?

Consider:
- Are they solving the SAME user problem?
- Are they part of the SAME feature or workflow?
- Would you present these as ONE improvement to stakeholders?
- Do the code changes show they serve the SAME business purpose?

Focus on BUSINESS VALUE and USER IMPACT, not technical implementation details.

Respond in JSON:
{
  "shouldMerge": true,
  "confidence": 0.85,
  "reasoning": "Both themes implement the same email validation improvement for user data integrity"
}`;
  }

  private parseAISimilarityResponse(output: string): AISimilarityResult {
    try {
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

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
    } catch (error) {
      console.warn('Failed to parse AI similarity response:', error);
    }

    return {
      nameScore: 0,
      descriptionScore: 0,
      patternScore: 0,
      businessScore: 0,
      semanticScore: 0,
      shouldMerge: false,
      confidence: 0,
      reasoning: 'Failed to parse AI response',
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
}
