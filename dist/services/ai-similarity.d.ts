import { Theme } from './theme-service';
import { AISimilarityResult } from '../types/similarity-types';
import { ClaudeClient } from '../utils/claude-client';
export declare class AISimilarityService {
    private readonly anthropicApiKey;
    private similarityCalculator;
    private claudeClient;
    constructor(anthropicApiKey: string);
    calculateAISimilarity(theme1: Theme, theme2: Theme): Promise<AISimilarityResult>;
    /**
     * Get Claude client for external metrics access
     */
    getClaudeClient(): ClaudeClient;
    private buildSimilarityPrompt;
    private buildThemeDetails;
    private parseAISimilarityResponse;
    private createFallbackSimilarity;
}
