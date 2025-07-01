import { Theme } from './theme-service';
import { AISimilarityResult } from '../types/similarity-types';
export declare class AISimilarityService {
    private readonly anthropicApiKey;
    private similarityCalculator;
    constructor(anthropicApiKey: string);
    calculateAISimilarity(theme1: Theme, theme2: Theme): Promise<AISimilarityResult>;
    private buildSimilarityPrompt;
    private buildThemeDetails;
    private parseAISimilarityResponse;
    private createFallbackSimilarity;
    /**
     * Calculate similarity for multiple theme pairs in a single AI call
     * This is the key performance optimization method
     */
    calculateBatchSimilarity(batchPrompt: string, expectedResults: number): Promise<{
        results: unknown[];
    }>;
}
