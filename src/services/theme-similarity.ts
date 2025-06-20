import { Theme } from './theme-service';
import * as exec from '@actions/exec';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface AISimilarityResult {
  nameScore: number;
  descriptionScore: number;
  patternScore: number;
  businessScore: number;
  semanticScore: number;
  shouldMerge: boolean;
  confidence: number;
  reasoning: string;
}

export interface SimilarityMetrics {
  nameScore: number; // 0-1 based on theme name similarity
  descriptionScore: number; // 0-1 based on description similarity
  fileOverlap: number; // 0-1 based on affected files overlap
  patternScore: number; // 0-1 based on code pattern similarity
  businessScore: number; // 0-1 based on business impact similarity
  combinedScore: number; // Weighted combination
}

export interface ConsolidatedTheme {
  id: string;
  name: string;
  description: string;
  level: number; // 0=root, 1=child, 2=grandchild
  parentId?: string;
  childThemes: ConsolidatedTheme[];

  // Consolidated data from child themes
  affectedFiles: string[];
  confidence: number; // Average of child confidences
  businessImpact: string; // Combined business impact
  codeSnippets: string[];
  context: string;
  lastAnalysis: Date;

  // Consolidation metadata
  sourceThemes: string[]; // IDs of original themes
  consolidationMethod: 'merge' | 'hierarchy' | 'single';
}

export interface ConsolidationConfig {
  similarityThreshold: number; // 0.8 - threshold for merging
  maxThemesPerParent: number; // 5 - max child themes
  minThemesForParent: number; // 2 - min themes to create parent
  confidenceWeight: number; // 0.3 - how much confidence affects merging
  businessDomainWeight: number; // 0.4 - importance of business similarity
}

export interface MergeDecision {
  action: 'merge' | 'group_under_parent' | 'keep_separate';
  confidence: number;
  reason: string;
  targetThemeId?: string;
}

export interface CachedSimilarity {
  similarity: SimilarityMetrics;
  timestamp: Date;
}

export interface QuickSimilarityResult {
  shouldSkipAI: boolean;
  similarity?: SimilarityMetrics;
  reason: string;
}

export interface ThemePair {
  theme1: Theme;
  theme2: Theme;
  id: string;
}

export interface BatchSimilarityResult {
  pairId: string;
  similarity: AISimilarityResult;
  error?: string;
}

export class ThemeSimilarityService {
  private config: ConsolidationConfig;
  private anthropicApiKey: string;
  private similarityCache: Map<string, CachedSimilarity> = new Map();
  private cacheExpireMinutes = 60; // Cache expires after 1 hour
  private batchSize = 8; // Process 8 theme pairs per AI batch call
  private batchFailures = 0; // Track consecutive batch failures

  constructor(anthropicApiKey: string, config?: Partial<ConsolidationConfig>) {
    this.anthropicApiKey = anthropicApiKey;
    this.config = {
      similarityThreshold: 0.6, // Lowered from 0.8 to 0.6 for better consolidation
      maxThemesPerParent: 5,
      minThemesForParent: 2,
      confidenceWeight: 0.3,
      businessDomainWeight: 0.4,
      ...config,
    };
    console.log(
      `[CONFIG] Consolidation config: threshold=${this.config.similarityThreshold}, minForParent=${this.config.minThemesForParent}`
    );
  }

  async calculateSimilarity(
    theme1: Theme,
    theme2: Theme
  ): Promise<SimilarityMetrics> {
    // Check cache first
    const cacheKey = this.getCacheKey(theme1, theme2);
    const cached = this.getCachedSimilarity(cacheKey);
    if (cached) {
      console.log(
        `[CACHE] Using cached similarity for "${theme1.name}" vs "${theme2.name}"`
      );
      return cached.similarity;
    }

    // Check if we can skip AI with quick heuristics
    const quickCheck = this.quickSimilarityCheck(theme1, theme2);
    if (quickCheck.shouldSkipAI && quickCheck.similarity) {
      console.log(
        `[QUICK] ${quickCheck.reason} for "${theme1.name}" vs "${theme2.name}"`
      );
      this.cacheSimilarity(cacheKey, quickCheck.similarity);
      return quickCheck.similarity;
    }

    // Use AI for semantic similarity
    const aiSimilarity = await this.calculateAISimilarity(theme1, theme2);

    // Still calculate file overlap (factual)
    const fileOverlap = this.calculateFileOverlap(
      theme1.affectedFiles,
      theme2.affectedFiles
    );

    // Combined score: 80% AI semantic understanding + 20% file overlap
    const combinedScore = aiSimilarity.semanticScore * 0.8 + fileOverlap * 0.2;

    const result = {
      nameScore: aiSimilarity.nameScore,
      descriptionScore: aiSimilarity.descriptionScore,
      fileOverlap,
      patternScore: aiSimilarity.patternScore,
      businessScore: aiSimilarity.businessScore,
      combinedScore,
    };

    // Cache the result
    this.cacheSimilarity(cacheKey, result);
    return result;
  }

  private getCacheKey(theme1: Theme, theme2: Theme): string {
    // Create deterministic cache key regardless of theme order
    const id1 = theme1.id;
    const id2 = theme2.id;
    return id1 < id2 ? `${id1}-${id2}` : `${id2}-${id1}`;
  }

  private getCachedSimilarity(cacheKey: string): CachedSimilarity | null {
    const cached = this.similarityCache.get(cacheKey);
    if (!cached) return null;

    // Check if cache has expired
    const ageMinutes = (Date.now() - cached.timestamp.getTime()) / (1000 * 60);
    if (ageMinutes > this.cacheExpireMinutes) {
      this.similarityCache.delete(cacheKey);
      return null;
    }

    return cached;
  }

  private cacheSimilarity(
    cacheKey: string,
    similarity: SimilarityMetrics
  ): void {
    this.similarityCache.set(cacheKey, {
      similarity,
      timestamp: new Date(),
    });
  }

  private quickSimilarityCheck(
    theme1: Theme,
    theme2: Theme
  ): QuickSimilarityResult {
    // Quick name similarity check
    const nameScore = this.calculateNameSimilarity(theme1.name, theme2.name);

    // Exact or near-exact name match - very likely to merge
    if (nameScore >= 0.95) {
      return {
        shouldSkipAI: true,
        similarity: {
          nameScore,
          descriptionScore: 0.9, // Assume high description similarity
          fileOverlap: this.calculateFileOverlap(
            theme1.affectedFiles,
            theme2.affectedFiles
          ),
          patternScore: 0.8,
          businessScore: 0.9,
          combinedScore: 0.92,
        },
        reason: 'Near-identical names detected, skipping AI',
      };
    }

    // No file overlap and completely different file types - very unlikely to merge
    const fileOverlap = this.calculateFileOverlap(
      theme1.affectedFiles,
      theme2.affectedFiles
    );
    if (fileOverlap === 0 && this.hasDifferentFileTypes(theme1, theme2)) {
      return {
        shouldSkipAI: true,
        similarity: {
          nameScore,
          descriptionScore: 0.2,
          fileOverlap: 0,
          patternScore: 0.1,
          businessScore: 0.2,
          combinedScore: 0.15,
        },
        reason: 'No file overlap and different file types, skipping AI',
      };
    }

    // Very different names and no file overlap - unlikely to merge
    if (nameScore < 0.1 && fileOverlap === 0) {
      return {
        shouldSkipAI: true,
        similarity: {
          nameScore,
          descriptionScore: 0.2,
          fileOverlap: 0,
          patternScore: 0.2,
          businessScore: 0.2,
          combinedScore: 0.18,
        },
        reason: 'Very different names and no file overlap, skipping AI',
      };
    }

    // Need AI analysis for uncertain cases
    return {
      shouldSkipAI: false,
      reason: 'Uncertain case, using AI analysis',
    };
  }

  private hasDifferentFileTypes(theme1: Theme, theme2: Theme): boolean {
    const getFileTypes = (files: string[]): Set<string> =>
      new Set(files.map((f) => f.split('.').pop()?.toLowerCase() || 'unknown'));

    const types1 = getFileTypes(theme1.affectedFiles);
    const types2 = getFileTypes(theme2.affectedFiles);

    // Check if they have any common file types
    const commonTypes = new Set([...types1].filter((type) => types2.has(type)));
    return commonTypes.size === 0;
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private async processBatchSimilarity(
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
      await exec.exec('bash', ['-c', `cat "${tempFile}" | claude`], {
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
                similarity: this.createFallbackSimilarity(
                  pair.theme1,
                  pair.theme2
                ),
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
      similarity: this.createFallbackSimilarity(pair.theme1, pair.theme2),
      error: 'Failed to parse batch AI response',
    }));
  }

  private clampScore(value: unknown): number {
    const num = Number(value);
    return isNaN(num) ? 0.5 : Math.max(0, Math.min(1, num));
  }

  private aiSimilarityToMetrics(
    aiSimilarity: AISimilarityResult,
    theme1: Theme,
    theme2: Theme
  ): SimilarityMetrics {
    const fileOverlap = this.calculateFileOverlap(
      theme1.affectedFiles,
      theme2.affectedFiles
    );

    // Combined score: 80% AI semantic understanding + 20% file overlap
    const combinedScore = aiSimilarity.semanticScore * 0.8 + fileOverlap * 0.2;

    return {
      nameScore: aiSimilarity.nameScore,
      descriptionScore: aiSimilarity.descriptionScore,
      fileOverlap,
      patternScore: aiSimilarity.patternScore,
      businessScore: aiSimilarity.businessScore,
      combinedScore,
    };
  }

  private async calculateAISimilarity(
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
    const nameScore = this.calculateNameSimilarity(theme1.name, theme2.name);
    const descScore = this.calculateDescriptionSimilarity(
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

  shouldMerge(similarity: SimilarityMetrics): MergeDecision {
    // Exact or near-exact name matches should always merge
    if (similarity.nameScore >= 0.9) {
      return {
        action: 'merge',
        confidence: similarity.nameScore,
        reason: `Near-identical names: ${similarity.nameScore.toFixed(2)}`,
      };
    }

    // High overall similarity themes
    if (similarity.combinedScore >= this.config.similarityThreshold) {
      return {
        action: 'merge',
        confidence: similarity.combinedScore,
        reason: `High similarity score: ${similarity.combinedScore.toFixed(2)}`,
      };
    }

    // Strong business domain similarity (even with different files)
    if (similarity.businessScore >= 0.7 && similarity.nameScore >= 0.4) {
      return {
        action: 'merge',
        confidence: (similarity.businessScore + similarity.nameScore) / 2,
        reason: `Strong business domain similarity: business=${similarity.businessScore.toFixed(2)}, name=${similarity.nameScore.toFixed(2)}`,
      };
    }

    // Similar names with some business relation
    if (similarity.nameScore >= 0.6 && similarity.businessScore >= 0.5) {
      return {
        action: 'merge',
        confidence: (similarity.nameScore + similarity.businessScore) / 2,
        reason: `Related themes: name=${similarity.nameScore.toFixed(2)}, business=${similarity.businessScore.toFixed(2)}`,
      };
    }

    return {
      action: 'keep_separate',
      confidence: similarity.combinedScore,
      reason: `Insufficient similarity: combined=${similarity.combinedScore.toFixed(2)}, name=${similarity.nameScore.toFixed(2)}, business=${similarity.businessScore.toFixed(2)}`,
    };
  }

  async consolidateThemes(themes: Theme[]): Promise<ConsolidatedTheme[]> {
    console.log(`[CONSOLIDATION] Starting with ${themes.length} themes`);
    if (themes.length === 0) return [];

    // Step 1: Find merge candidates
    console.log(`[CONSOLIDATION] Step 1: Finding merge candidates`);
    const mergeGroups = await this.findMergeGroups(themes);
    console.log(`[CONSOLIDATION] Found ${mergeGroups.size} merge groups`);

    // Step 2: Create consolidated themes
    console.log(`[CONSOLIDATION] Step 2: Creating consolidated themes`);
    const consolidated = await this.createConsolidatedThemes(
      mergeGroups,
      themes
    );
    console.log(
      `[CONSOLIDATION] Created ${consolidated.length} consolidated themes`
    );

    // Step 3: Build hierarchies
    console.log(`[CONSOLIDATION] Step 3: Building hierarchies`);
    const hierarchical = await this.buildHierarchies(consolidated);
    console.log(
      `[CONSOLIDATION] Final result: ${hierarchical.length} themes (${(((themes.length - hierarchical.length) / themes.length) * 100).toFixed(1)}% reduction)`
    );

    return hierarchical;
  }

  private async findMergeGroups(
    themes: Theme[]
  ): Promise<Map<string, string[]>> {
    console.log(
      `[OPTIMIZATION] Using batch processing for ${themes.length} themes`
    );

    // Step 1: Collect all theme pairs that need comparison
    const allPairs: ThemePair[] = [];
    for (let i = 0; i < themes.length; i++) {
      for (let j = i + 1; j < themes.length; j++) {
        allPairs.push({
          theme1: themes[i],
          theme2: themes[j],
          id: `${themes[i].id}-${themes[j].id}`,
        });
      }
    }

    console.log(`[OPTIMIZATION] Total pairs to analyze: ${allPairs.length}`);

    // Step 2: Calculate similarities using batch processing and early termination
    const similarities = await this.calculateBatchSimilarities(allPairs);

    // Step 3: Build merge groups based on calculated similarities
    return this.buildMergeGroupsFromSimilarities(themes, similarities);
  }

  private async calculateBatchSimilarities(
    pairs: ThemePair[]
  ): Promise<Map<string, SimilarityMetrics>> {
    const similarities = new Map<string, SimilarityMetrics>();
    let aiCallsSkipped = 0;
    let aiCallsMade = 0;

    // First pass: Process pairs that can be resolved with quick checks or cache
    const needsAI: ThemePair[] = [];

    for (const pair of pairs) {
      const cacheKey = this.getCacheKey(pair.theme1, pair.theme2);
      const cached = this.getCachedSimilarity(cacheKey);

      if (cached) {
        similarities.set(pair.id, cached.similarity);
        continue;
      }

      const quickCheck = this.quickSimilarityCheck(pair.theme1, pair.theme2);
      if (quickCheck.shouldSkipAI && quickCheck.similarity) {
        similarities.set(pair.id, quickCheck.similarity);
        this.cacheSimilarity(cacheKey, quickCheck.similarity);
        aiCallsSkipped++;
      } else {
        needsAI.push(pair);
      }
    }

    console.log(
      `[OPTIMIZATION] Quick resolution: ${similarities.size} pairs, AI needed: ${needsAI.length}, Skipped: ${aiCallsSkipped}`
    );

    // Second pass: Process remaining pairs with AI in batches
    if (needsAI.length > 0) {
      // Adapt batch size based on previous failures
      const adaptiveBatchSize = Math.max(
        2,
        this.batchSize - Math.floor(this.batchFailures / 2)
      );
      console.log(
        `[BATCH] Using adaptive batch size: ${adaptiveBatchSize} (failures: ${this.batchFailures})`
      );

      const batches = this.chunkArray(needsAI, adaptiveBatchSize);

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log(
          `[BATCH] Processing batch ${i + 1}/${batches.length} with ${batch.length} pairs`
        );

        try {
          const batchResults = await this.processBatchSimilarity(batch);
          aiCallsMade++;

          // Check if we got valid results
          const validResults = batchResults.filter((r) => !r.error);
          if (validResults.length === 0) {
            throw new Error('No valid results in batch response');
          }

          // Reset failure counter on success
          this.batchFailures = Math.max(0, this.batchFailures - 1);

          for (const result of batchResults) {
            if (result.error) {
              console.warn(
                `[BATCH] Error for pair ${result.pairId}: ${result.error}`
              );
              // Use fallback similarity for errored pairs
              const pair = batch.find((p) => p.id === result.pairId);
              if (pair) {
                const fallback = this.createFallbackSimilarity(
                  pair.theme1,
                  pair.theme2
                );
                similarities.set(
                  result.pairId,
                  this.aiSimilarityToMetrics(fallback, pair.theme1, pair.theme2)
                );
              }
            } else {
              const pair = batch.find((p) => p.id === result.pairId);
              if (pair) {
                const metrics = this.aiSimilarityToMetrics(
                  result.similarity,
                  pair.theme1,
                  pair.theme2
                );
                similarities.set(result.pairId, metrics);

                // Cache the result
                const cacheKey = this.getCacheKey(pair.theme1, pair.theme2);
                this.cacheSimilarity(cacheKey, metrics);
              }
            }
          }
        } catch (error) {
          this.batchFailures++;
          console.error(
            `[BATCH] Batch processing failed (failures: ${this.batchFailures}):`,
            error
          );

          // If too many failures, fall back to individual processing
          if (this.batchFailures >= 3) {
            console.warn(
              `[BATCH] Too many failures, switching to individual processing for remaining batches`
            );

            // Process remaining pairs individually
            for (const pair of batch) {
              try {
                const similarity = await this.calculateSimilarity(
                  pair.theme1,
                  pair.theme2
                );
                similarities.set(pair.id, similarity);
              } catch (individualError) {
                console.error(
                  `[FALLBACK] Individual processing failed for ${pair.id}:`,
                  individualError
                );
                const fallback = this.createFallbackSimilarity(
                  pair.theme1,
                  pair.theme2
                );
                similarities.set(
                  pair.id,
                  this.aiSimilarityToMetrics(fallback, pair.theme1, pair.theme2)
                );
              }
            }
          } else {
            // Retry with smaller batch size
            console.log(
              `[BATCH] Retrying with individual processing for this batch`
            );
            for (const pair of batch) {
              try {
                const similarity = await this.calculateSimilarity(
                  pair.theme1,
                  pair.theme2
                );
                similarities.set(pair.id, similarity);
              } catch (individualError) {
                console.error(
                  `[FALLBACK] Individual processing failed for ${pair.id}:`,
                  individualError
                );
                const fallback = this.createFallbackSimilarity(
                  pair.theme1,
                  pair.theme2
                );
                similarities.set(
                  pair.id,
                  this.aiSimilarityToMetrics(fallback, pair.theme1, pair.theme2)
                );
              }
            }
          }
        }
      }
    }

    console.log(
      `[OPTIMIZATION] Performance summary: ${aiCallsSkipped} skipped, ${aiCallsMade} AI batch calls made, ${similarities.size} total similarities calculated`
    );
    return similarities;
  }

  private buildMergeGroupsFromSimilarities(
    themes: Theme[],
    similarities: Map<string, SimilarityMetrics>
  ): Map<string, string[]> {
    const mergeGroups = new Map<string, string[]>();
    const processed = new Set<string>();

    for (let i = 0; i < themes.length; i++) {
      const theme1 = themes[i];
      if (processed.has(theme1.id)) continue;

      const group = [theme1.id];
      processed.add(theme1.id);

      for (let j = i + 1; j < themes.length; j++) {
        const theme2 = themes[j];
        if (processed.has(theme2.id)) continue;

        const pairId = `${theme1.id}-${theme2.id}`;
        const similarity = similarities.get(pairId);

        if (similarity) {
          const decision = this.shouldMerge(similarity);

          console.log(`[MERGE] Comparing "${theme1.name}" vs "${theme2.name}"`);
          console.log(
            `[MERGE] Similarity: name=${similarity.nameScore.toFixed(2)}, desc=${similarity.descriptionScore.toFixed(2)}, files=${similarity.fileOverlap.toFixed(2)}, combined=${similarity.combinedScore.toFixed(2)}`
          );
          console.log(
            `[MERGE] Decision: ${decision.action} (${decision.reason})`
          );

          if (decision.action === 'merge') {
            group.push(theme2.id);
            processed.add(theme2.id);
            console.log(
              `[MERGE] ✅ MERGED: Added "${theme2.name}" to group with "${theme1.name}"`
            );
          }
        }
      }

      mergeGroups.set(theme1.id, group);
    }

    return mergeGroups;
  }

  private async createConsolidatedThemes(
    mergeGroups: Map<string, string[]>,
    themes: Theme[]
  ): Promise<ConsolidatedTheme[]> {
    const themeMap = new Map<string, Theme>();
    themes.forEach((theme) => themeMap.set(theme.id, theme));

    const consolidated: ConsolidatedTheme[] = [];

    for (const [, groupIds] of mergeGroups) {
      const groupThemes = groupIds.map((id) => themeMap.get(id)!);

      if (groupThemes.length === 1) {
        // Single theme - convert to consolidated format
        const theme = groupThemes[0];
        consolidated.push(this.themeToConsolidated(theme));
      } else {
        // Multiple themes - merge them
        const mergedTheme = await this.mergeThemes(groupThemes);
        consolidated.push(mergedTheme);
      }
    }

    return consolidated;
  }

  private async buildHierarchies(
    themes: ConsolidatedTheme[]
  ): Promise<ConsolidatedTheme[]> {
    // Group themes by business domain
    const domainGroups = await this.groupByBusinessDomain(themes);
    const result: ConsolidatedTheme[] = [];

    console.log(`[HIERARCHY] Found ${domainGroups.size} business domains:`);
    for (const [domain, domainThemes] of domainGroups) {
      console.log(
        `[HIERARCHY] Domain "${domain}": ${domainThemes.length} themes (min required: ${this.config.minThemesForParent})`
      );

      if (domainThemes.length >= this.config.minThemesForParent) {
        // Create parent theme
        console.log(`[HIERARCHY] ✅ Creating parent theme for "${domain}"`);
        const parentTheme = this.createParentTheme(domain, domainThemes);

        // Set children
        domainThemes.forEach((child) => {
          child.level = 1;
          child.parentId = parentTheme.id;
        });

        parentTheme.childThemes = domainThemes;
        result.push(parentTheme);
      } else {
        // Keep as root themes
        console.log(
          `[HIERARCHY] ⚠️ Keeping "${domain}" themes as individual (below threshold)`
        );
        result.push(...domainThemes);
      }
    }

    return result;
  }

  private async groupByBusinessDomain(
    themes: ConsolidatedTheme[]
  ): Promise<Map<string, ConsolidatedTheme[]>> {
    const domains = new Map<string, ConsolidatedTheme[]>();

    for (const theme of themes) {
      const domain = await this.extractBusinessDomain(
        theme.name,
        theme.description
      );
      console.log(`[DOMAIN] Theme "${theme.name}" → Domain "${domain}"`);

      if (!domains.has(domain)) {
        domains.set(domain, []);
      }
      domains.get(domain)!.push(theme);
    }

    return domains;
  }

  private async extractBusinessDomain(
    name: string,
    description: string
  ): Promise<string> {
    const prompt = this.buildDomainExtractionPrompt(name, description);

    try {
      const tempFile = path.join(
        os.tmpdir(),
        `claude-domain-${Date.now()}.txt`
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

      const domain = this.parseDomainExtractionResponse(output);
      console.log(`[AI-DOMAIN] Generated domain for "${name}": "${domain}"`);

      // Validate the generated domain
      if (this.isValidDomainName(domain)) {
        return domain;
      } else {
        console.warn(
          `[AI-DOMAIN] Generated domain invalid, using fallback: "${domain}"`
        );
        return this.extractBusinessDomainFallback(name, description);
      }
    } catch (error) {
      console.warn('AI domain extraction failed:', error);
      return this.extractBusinessDomainFallback(name, description);
    }
  }

  private buildDomainExtractionPrompt(
    name: string,
    description: string
  ): string {
    return `You are an expert code reviewer analyzing code changes to determine their business domain category.

Theme Name: "${name}"
Description: "${description}"

Based on this theme, determine what high-level business domain or functional area this change belongs to. Consider:
- What business functionality is being affected?
- What system or component is being modified?
- What is the primary purpose of this change?

Choose from these common domains or create a similar concise category:
- Authentication & Security
- User Interface
- Data Management
- API & Services
- Testing & Validation
- Configuration & Setup
- Infrastructure
- Documentation
- Bug Fixes
- Performance
- Integration
- Workflow & Automation

Respond with just the domain name (2-4 words, no extra text):`;
  }

  private parseDomainExtractionResponse(output: string): string {
    // Clean up the response - take first line, trim whitespace, remove quotes
    const lines = output.trim().split('\n');
    const domain = lines[0].trim().replace(/^["']|["']$/g, '');

    return domain || 'General Changes';
  }

  private isValidDomainName(domain: string): boolean {
    return (
      domain.length >= 3 &&
      domain.length <= 30 &&
      !domain.toLowerCase().includes('error') &&
      !domain.toLowerCase().includes('failed') &&
      domain.trim() === domain
    );
  }

  private extractBusinessDomainFallback(
    name: string,
    description: string
  ): string {
    const text = (name + ' ' + description).toLowerCase();

    // Business domain keywords (fallback)
    if (text.includes('greeting') || text.includes('demo')) {
      return 'Demo & Examples';
    }
    if (text.includes('service') || text.includes('architecture')) {
      return 'Service Architecture';
    }
    if (text.includes('git') || text.includes('repository')) {
      return 'Git Integration';
    }
    if (text.includes('theme') || text.includes('analysis')) {
      return 'Analysis & Processing';
    }
    if (text.includes('test') || text.includes('validation')) {
      return 'Testing & Validation';
    }
    if (text.includes('interface') || text.includes('type')) {
      return 'Interface Changes';
    }
    if (text.includes('workflow') || text.includes('action')) {
      return 'Workflow & Automation';
    }
    if (text.includes('auth') || text.includes('security')) {
      return 'Authentication & Security';
    }

    return 'General Changes';
  }

  private createParentTheme(
    domain: string,
    children: ConsolidatedTheme[]
  ): ConsolidatedTheme {
    const allFiles = new Set<string>();
    const allSnippets: string[] = [];
    let totalConfidence = 0;
    const sourceThemes: string[] = [];

    children.forEach((child) => {
      child.affectedFiles.forEach((file) => allFiles.add(file));
      allSnippets.push(...child.codeSnippets);
      totalConfidence += child.confidence;
      sourceThemes.push(...child.sourceThemes);
    });

    return {
      id: `parent-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      name: domain,
      description: `Consolidated theme for ${children.length} related changes: ${children.map((c) => c.name).join(', ')}`,
      level: 0,
      childThemes: [],
      affectedFiles: Array.from(allFiles),
      confidence: totalConfidence / children.length,
      businessImpact: `Umbrella theme covering ${children.length} related changes in ${domain.toLowerCase()}`,
      codeSnippets: allSnippets.slice(0, 10), // Limit snippets
      context: children.map((c) => c.context).join('\n'),
      lastAnalysis: new Date(),
      sourceThemes,
      consolidationMethod: 'hierarchy',
    };
  }

  private async generateMergedThemeNameAndDescription(
    themes: Theme[]
  ): Promise<{ name: string; description: string }> {
    const prompt = this.buildMergedThemeNamingPrompt(themes);

    try {
      const tempFile = path.join(
        os.tmpdir(),
        `claude-naming-${Date.now()}.txt`
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

      const result = this.parseMergedThemeNamingResponse(output);
      console.log(`[AI-NAMING] Generated merged theme: "${result.name}"`);

      // Validate the generated name
      if (this.isValidThemeName(result.name)) {
        return result;
      } else {
        console.warn(
          `[AI-NAMING] Generated name invalid, using fallback: "${result.name}"`
        );
        return this.createFallbackMergedThemeName(themes);
      }
    } catch (error) {
      console.warn('AI theme naming failed:', error);
      return this.createFallbackMergedThemeName(themes);
    }
  }

  private buildMergedThemeNamingPrompt(themes: Theme[]): string {
    const themeDetails = themes
      .map(
        (theme) =>
          `"${theme.name}": ${theme.description} (confidence: ${theme.confidence}, files: ${theme.affectedFiles.join(', ')})`
      )
      .join('\n');

    return `You are an expert code reviewer analyzing related code changes that should be merged into a single theme.

These ${themes.length} themes have been identified as similar and will be consolidated:

${themeDetails}

Please create a unified theme name and description that best represents what these changes collectively accomplish. The name should be:
- Concise (2-5 words)
- Descriptive of the actual change being made
- Not just a list of the individual themes
- Focused on the business purpose rather than implementation details

Respond in this exact JSON format (no other text):
{
  "name": "Remove Authentication Scaffolding",
  "description": "Removes demo authentication components and related scaffolding code that are no longer needed"
}`;
  }

  private parseMergedThemeNamingResponse(output: string): {
    name: string;
    description: string;
  } {
    try {
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          name: parsed.name || 'Merged Changes',
          description: parsed.description || 'Consolidated related changes',
        };
      }
    } catch (error) {
      console.warn('Failed to parse AI naming response:', error);
    }

    return {
      name: 'Merged Changes',
      description: 'Consolidated related changes',
    };
  }

  private isValidThemeName(name: string): boolean {
    return (
      name.length >= 3 &&
      name.length <= 50 &&
      !name.toLowerCase().includes('error') &&
      !name.toLowerCase().includes('failed') &&
      name.trim() === name
    );
  }

  private createFallbackMergedThemeName(themes: Theme[]): {
    name: string;
    description: string;
  } {
    const leadTheme = themes[0];
    return {
      name: leadTheme.name,
      description: `Consolidated: ${themes.map((t) => t.name).join(', ')}`,
    };
  }

  private themeToConsolidated(theme: Theme): ConsolidatedTheme {
    return {
      id: theme.id,
      name: theme.name,
      description: theme.description,
      level: 0,
      childThemes: [],
      affectedFiles: theme.affectedFiles,
      confidence: theme.confidence,
      businessImpact: theme.description,
      codeSnippets: theme.codeSnippets,
      context: theme.context,
      lastAnalysis: theme.lastAnalysis,
      sourceThemes: [theme.id],
      consolidationMethod: 'single',
    };
  }

  private async mergeThemes(themes: Theme[]): Promise<ConsolidatedTheme> {
    const allFiles = new Set<string>();
    const allSnippets: string[] = [];
    let totalConfidence = 0;

    themes.forEach((theme) => {
      theme.affectedFiles.forEach((file) => allFiles.add(file));
      allSnippets.push(...theme.codeSnippets);
      totalConfidence += theme.confidence;
    });

    // Generate AI-powered name and description for merged themes
    const { name, description } =
      await this.generateMergedThemeNameAndDescription(themes);

    return {
      id: `merged-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      name,
      description,
      level: 0,
      childThemes: [],
      affectedFiles: Array.from(allFiles),
      confidence: totalConfidence / themes.length,
      businessImpact: themes.map((t) => t.description).join('; '),
      codeSnippets: allSnippets,
      context: themes.map((t) => t.context).join('\n'),
      lastAnalysis: new Date(),
      sourceThemes: themes.map((t) => t.id),
      consolidationMethod: 'merge',
    };
  }

  private calculateNameSimilarity(name1: string, name2: string): number {
    const words1 = name1.toLowerCase().split(/\s+/);
    const words2 = name2.toLowerCase().split(/\s+/);

    const intersection = words1.filter((word) => words2.includes(word));
    const union = new Set([...words1, ...words2]);

    return intersection.length / union.size;
  }

  private calculateDescriptionSimilarity(desc1: string, desc2: string): number {
    const words1 = desc1.toLowerCase().split(/\s+/);
    const words2 = desc2.toLowerCase().split(/\s+/);

    const intersection = words1.filter((word) => words2.includes(word));
    const union = new Set([...words1, ...words2]);

    return intersection.length / union.size;
  }

  private calculateFileOverlap(files1: string[], files2: string[]): number {
    const set1 = new Set(files1);
    const set2 = new Set(files2);

    const intersection = new Set([...set1].filter((file) => set2.has(file)));
    const union = new Set([...set1, ...set2]);

    return union.size === 0 ? 0 : intersection.size / union.size;
  }

  private calculatePatternSimilarity(theme1: Theme, theme2: Theme): number {
    // Extract patterns from context
    const patterns1 = this.extractPatterns(theme1.context);
    const patterns2 = this.extractPatterns(theme2.context);

    const intersection = patterns1.filter((p) => patterns2.includes(p));
    const union = new Set([...patterns1, ...patterns2]);

    return union.size === 0 ? 0 : intersection.length / union.size;
  }

  private calculateBusinessSimilarity(theme1: Theme, theme2: Theme): number {
    const business1 = this.extractBusinessKeywords(theme1.description);
    const business2 = this.extractBusinessKeywords(theme2.description);

    const intersection = business1.filter((k) => business2.includes(k));
    const union = new Set([...business1, ...business2]);

    return union.size === 0 ? 0 : intersection.length / union.size;
  }

  private extractPatterns(context: string): string[] {
    const patterns: string[] = [];
    const text = context.toLowerCase();

    if (text.includes('add') || text.includes('implement'))
      patterns.push('addition');
    if (text.includes('remove') || text.includes('delete'))
      patterns.push('removal');
    if (text.includes('update') || text.includes('modify'))
      patterns.push('modification');
    if (text.includes('refactor')) patterns.push('refactoring');
    if (text.includes('interface') || text.includes('type'))
      patterns.push('type_definition');
    if (text.includes('service') || text.includes('class'))
      patterns.push('service_implementation');
    if (text.includes('test')) patterns.push('testing');
    if (text.includes('configuration') || text.includes('config'))
      patterns.push('configuration');

    return patterns;
  }

  private extractBusinessKeywords(description: string): string[] {
    const keywords: string[] = [];
    const text = description.toLowerCase();

    if (text.includes('greeting')) keywords.push('greeting');
    if (text.includes('authentication') || text.includes('auth'))
      keywords.push('authentication');
    if (text.includes('user') || text.includes('customer'))
      keywords.push('user_experience');
    if (text.includes('api') || text.includes('service'))
      keywords.push('api_service');
    if (text.includes('data') || text.includes('storage'))
      keywords.push('data_management');
    if (text.includes('security')) keywords.push('security');
    if (text.includes('performance')) keywords.push('performance');
    if (text.includes('integration')) keywords.push('integration');
    if (text.includes('workflow') || text.includes('process'))
      keywords.push('workflow');

    return keywords;
  }
}
