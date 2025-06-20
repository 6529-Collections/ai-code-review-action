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
      await exec.exec('bash', ['-c', `cat "${tempFile}" | claude`], {
        listeners: {
          stdout: (data: Buffer) => {
            output += data.toString();
          },
        },
      });

      fs.unlinkSync(tempFile);

      const result = this.parseAISimilarityResponse(output);
      console.log(
        `[AI-SIMILARITY] "${theme1.name}" vs "${theme2.name}": ${result.semanticScore.toFixed(2)} (${result.shouldMerge ? 'MERGE' : 'SEPARATE'})`
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
    return `You are an expert code reviewer analyzing theme similarity for consolidation.

Compare these two code change themes and determine if they should be merged:

**Theme 1:**
Name: "${theme1.name}"
Description: "${theme1.description}"
Files: ${theme1.affectedFiles.join(', ')}
Confidence: ${theme1.confidence}

**Theme 2:**
Name: "${theme2.name}"  
Description: "${theme2.description}"
Files: ${theme2.affectedFiles.join(', ')}
Confidence: ${theme2.confidence}

Analyze semantic similarity considering:
- Are they the same logical change/feature?
- Do they serve the same business purpose?
- Are they part of the same refactoring effort?
- Would a developer naturally group them together?

Respond in this exact JSON format (no other text):
{
  "nameScore": 0.85,
  "descriptionScore": 0.72,
  "patternScore": 0.68,
  "businessScore": 0.91,
  "semanticScore": 0.79,
  "shouldMerge": true,
  "confidence": 0.88,
  "reasoning": "Both themes relate to removing authentication scaffolding - semantically identical despite different wording"
}`;
  }

  private parseAISimilarityResponse(output: string): AISimilarityResult {
    try {
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          nameScore: parsed.nameScore || 0,
          descriptionScore: parsed.descriptionScore || 0,
          patternScore: parsed.patternScore || 0,
          businessScore: parsed.businessScore || 0,
          semanticScore: parsed.semanticScore || 0,
          shouldMerge: parsed.shouldMerge || false,
          confidence: parsed.confidence || 0,
          reasoning: parsed.reasoning || 'No reasoning provided',
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
    // Fallback to basic string matching when AI fails
    const nameScore = this.similarityCalculator.calculateNameSimilarity(
      theme1.name,
      theme2.name
    );
    const descScore = this.similarityCalculator.calculateDescriptionSimilarity(
      theme1.description,
      theme2.description
    );

    return {
      nameScore,
      descriptionScore: descScore,
      patternScore: 0.3,
      businessScore: 0.3,
      semanticScore: (nameScore + descScore) / 2,
      shouldMerge: nameScore > 0.7,
      confidence: 0.4,
      reasoning: 'AI analysis failed, used basic string matching fallback',
    };
  }
}
