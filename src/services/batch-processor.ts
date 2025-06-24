import {
  ThemePair,
  BatchSimilarityResult,
  AISimilarityResult,
} from '../types/similarity-types';
import * as exec from '@actions/exec';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export class BatchProcessor {
  private batchSize = 8; // Process 8 theme pairs per AI batch call
  private batchFailures = 0; // Track consecutive batch failures

  async processBatchSimilarity(
    pairs: ThemePair[]
  ): Promise<BatchSimilarityResult[]> {
    const prompt = this.buildBatchSimilarityPrompt(pairs);

    try {
      const tempFile = path.join(
        os.tmpdir(),
        `claude-batch-similarity-${Date.now()}.txt`
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

      const results = this.parseBatchSimilarityResponse(output, pairs);
      console.log(`[BATCH] Successfully processed ${results.length} pairs`);

      return results;
    } catch (error) {
      console.error('Batch AI similarity failed:', error);
      throw error;
    }
  }

  getAdaptiveBatchSize(): number {
    return Math.max(2, this.batchSize - Math.floor(this.batchFailures / 2));
  }

  incrementFailures(): void {
    this.batchFailures++;
  }

  decrementFailures(): void {
    this.batchFailures = Math.max(0, this.batchFailures - 1);
  }

  getFailureCount(): number {
    return this.batchFailures;
  }

  chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private buildBatchSimilarityPrompt(pairs: ThemePair[]): string {
    const pairDescriptions = pairs
      .map(
        (pair, index) =>
          `Pair ${index + 1}: ID="${pair.id}"
- Theme A: "${pair.theme1.name}" | ${pair.theme1.description}
- Theme B: "${pair.theme2.name}" | ${pair.theme2.description}
- Files A: ${pair.theme1.affectedFiles.join(', ') || 'none'}
- Files B: ${pair.theme2.affectedFiles.join(', ') || 'none'}`
      )
      .join('\n\n');

    return `You are analyzing ${pairs.length} theme pairs for similarity. For each pair, determine if the themes should be merged.

THEME PAIRS:
${pairDescriptions}

RESPOND WITH ONLY A VALID JSON ARRAY - NO OTHER TEXT:
[
${pairs
  .map(
    (pair, index) => `  {
    "pairId": "${pair.id}",
    "nameScore": 0.5,
    "descriptionScore": 0.5,
    "patternScore": 0.5,
    "businessScore": 0.5,
    "semanticScore": 0.5,
    "shouldMerge": false,
    "confidence": 0.5,
    "reasoning": "analysis for pair ${index + 1}"
  }${index < pairs.length - 1 ? ',' : ''}`
  )
  .join('\n')}
]

Replace the scores (0.0-1.0) and shouldMerge (true/false) based on your analysis. Keep the exact JSON structure.`;
  }

  private parseBatchSimilarityResponse(
    output: string,
    pairs: ThemePair[]
  ): BatchSimilarityResult[] {
    console.log(`[BATCH-DEBUG] Raw AI output length: ${output.length}`);
    console.log(`[BATCH-DEBUG] First 500 chars:`, output.substring(0, 500));

    try {
      // Try to find JSON array in the output
      let jsonMatch = output.match(/\[[\s\S]*\]/);

      // If no match, try to extract from code blocks
      if (!jsonMatch) {
        const codeBlockMatch = output.match(
          /```(?:json)?\s*(\[[\s\S]*?\])\s*```/
        );
        if (codeBlockMatch) {
          jsonMatch = [codeBlockMatch[1]];
        }
      }

      // If still no match, try to find any array-like structure
      if (!jsonMatch) {
        const arrayStart = output.indexOf('[');
        const arrayEnd = output.lastIndexOf(']');
        if (arrayStart !== -1 && arrayEnd !== -1 && arrayEnd > arrayStart) {
          jsonMatch = [output.substring(arrayStart, arrayEnd + 1)];
        }
      }

      if (jsonMatch) {
        console.log(
          `[BATCH-DEBUG] Extracted JSON:`,
          jsonMatch[0].substring(0, 300)
        );

        const parsed = JSON.parse(jsonMatch[0]);
        console.log(
          `[BATCH-DEBUG] Parsed array length: ${parsed.length}, expected: ${pairs.length}`
        );

        if (Array.isArray(parsed)) {
          // Handle case where AI returns fewer results than expected
          const results: BatchSimilarityResult[] = [];

          for (let i = 0; i < pairs.length; i++) {
            const item = parsed[i];
            const pair = pairs[i];

            if (item && typeof item === 'object') {
              results.push({
                pairId: item.pairId || pair.id,
                similarity: {
                  nameScore: this.clampScore(item.nameScore),
                  descriptionScore: this.clampScore(item.descriptionScore),
                  patternScore: this.clampScore(item.patternScore),
                  businessScore: this.clampScore(item.businessScore),
                  semanticScore: this.clampScore(item.semanticScore),
                  shouldMerge: Boolean(item.shouldMerge),
                  confidence: this.clampScore(item.confidence),
                  reasoning: String(item.reasoning || 'No reasoning provided'),
                },
              });
            } else {
              // Missing or invalid item - create fallback
              console.warn(
                `[BATCH-DEBUG] Missing/invalid item at index ${i}, using fallback`
              );
              results.push({
                pairId: pair.id,
                similarity: this.createFallbackSimilarity(),
                error: `Missing AI response for pair ${i + 1}`,
              });
            }
          }

          console.log(
            `[BATCH-DEBUG] Successfully parsed ${results.length} results`
          );
          return results;
        }
      }
    } catch (error) {
      console.error('[BATCH-DEBUG] JSON parsing failed:', error);
      console.log(
        '[BATCH-DEBUG] Full output for debugging:',
        output.substring(0, 1000)
      );
    }

    console.warn('[BATCH-DEBUG] Using fallback for all pairs');
    // Fallback: create error results for all pairs
    return pairs.map((pair) => ({
      pairId: pair.id,
      similarity: this.createFallbackSimilarity(),
      error: 'Failed to parse batch AI response',
    }));
  }

  private clampScore(value: unknown): number {
    const num = Number(value);
    return isNaN(num) ? 0.5 : Math.max(0, Math.min(1, num));
  }

  private createFallbackSimilarity(): AISimilarityResult {
    return {
      nameScore: 0.3,
      descriptionScore: 0.3,
      patternScore: 0.3,
      businessScore: 0.3,
      semanticScore: 0.3,
      shouldMerge: false,
      confidence: 0.2,
      reasoning: 'Fallback similarity due to parsing error',
    };
  }
}
