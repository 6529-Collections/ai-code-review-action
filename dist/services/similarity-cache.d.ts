import { Theme } from '@/shared/types/theme-types';
import { CachedSimilarity, SimilarityMetrics } from '../types/similarity-types';
export declare class SimilarityCache {
    private cache;
    private cacheExpireMinutes;
    getCacheKey(theme1: Theme, theme2: Theme): string;
    getCachedSimilarity(cacheKey: string): CachedSimilarity | null;
    cacheSimilarity(cacheKey: string, similarity: SimilarityMetrics): void;
    clearCache(): void;
    getCacheStats(): {
        size: number;
        expireMinutes: number;
    };
}
