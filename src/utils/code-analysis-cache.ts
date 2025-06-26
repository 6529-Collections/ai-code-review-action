import * as crypto from 'crypto';
import { GenericCache } from './generic-cache';
import { CodeChange } from './ai-code-analyzer';

/**
 * Specialized cache for AI-based code analysis results
 * Uses content-based hashing for cache keys to ensure cache hits on identical diffs
 */
export class CodeAnalysisCache extends GenericCache {
  constructor(ttlMs: number = 86400000) {
    // 24 hour default TTL
    super(ttlMs);
  }

  /**
   * Generate a cache key based on filename and diff content
   * Uses SHA-256 hash for deterministic, collision-resistant keys
   */
  private generateCacheKey(filename: string, diffContent: string): string {
    const content = `${filename}:${diffContent}`;
    return crypto
      .createHash('sha256')
      .update(content)
      .digest('hex')
      .substring(0, 16); // Use first 16 chars for memory efficiency
  }

  /**
   * Get cached analysis result or execute the processor function
   * Provides transparent caching for AI code analysis
   */
  async getOrAnalyze(
    filename: string,
    diffContent: string,
    processor: () => Promise<CodeChange>
  ): Promise<CodeChange> {
    const key = this.generateCacheKey(filename, diffContent);
    const cached = this.get(key) as CodeChange;

    if (cached) {
      console.log(
        `[CODE-ANALYSIS-CACHE] Cache HIT for ${filename} (key: ${key})`
      );
      return cached;
    }

    console.log(
      `[CODE-ANALYSIS-CACHE] Cache MISS for ${filename} (key: ${key}) - analyzing with AI`
    );
    const result = await processor();

    // Store in cache with default TTL
    this.set(key, result);
    console.log(
      `[CODE-ANALYSIS-CACHE] Cached result for ${filename} (key: ${key})`
    );

    return result;
  }

  /**
   * Get cache statistics for monitoring
   */
  getStats(): {
    size: number;
    ttlMs: number;
  } {
    return {
      size: this.size(),
      ttlMs: this['defaultTtlMs'] as number, // Access private property for stats
    };
  }

  /**
   * Pre-warm cache with known results (useful for testing)
   */
  preWarm(filename: string, diffContent: string, result: CodeChange): void {
    const key = this.generateCacheKey(filename, diffContent);
    this.set(key, result);
    console.log(
      `[CODE-ANALYSIS-CACHE] Pre-warmed cache for ${filename} (key: ${key})`
    );
  }
}
