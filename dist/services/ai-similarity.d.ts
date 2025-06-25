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
}
