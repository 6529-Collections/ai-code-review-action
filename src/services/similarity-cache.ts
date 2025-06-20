import { Theme } from './theme-service';
import { CachedSimilarity, SimilarityMetrics } from '../types/similarity-types';

export class SimilarityCache {
  private cache: Map<string, CachedSimilarity> = new Map();
  private cacheExpireMinutes = 60; // Cache expires after 1 hour

  getCacheKey(theme1: Theme, theme2: Theme): string {
    // Create deterministic cache key regardless of theme order
    const id1 = theme1.id;
    const id2 = theme2.id;
    return id1 < id2 ? `${id1}-${id2}` : `${id2}-${id1}`;
  }

  getCachedSimilarity(cacheKey: string): CachedSimilarity | null {
    const cached = this.cache.get(cacheKey);
    if (!cached) return null;

    // Check if cache has expired
    const ageMinutes = (Date.now() - cached.timestamp.getTime()) / (1000 * 60);
    if (ageMinutes > this.cacheExpireMinutes) {
      this.cache.delete(cacheKey);
      return null;
    }

    return cached;
  }

  cacheSimilarity(cacheKey: string, similarity: SimilarityMetrics): void {
    this.cache.set(cacheKey, {
      similarity,
      timestamp: new Date(),
    });
  }

  clearCache(): void {
    this.cache.clear();
  }

  getCacheStats(): { size: number; expireMinutes: number } {
    return {
      size: this.cache.size,
      expireMinutes: this.cacheExpireMinutes,
    };
  }
}
