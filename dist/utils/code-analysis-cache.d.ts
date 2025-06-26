import { GenericCache } from './generic-cache';
import { CodeChange } from './ai-code-analyzer';
/**
 * Specialized cache for AI-based code analysis results
 * Uses content-based hashing for cache keys to ensure cache hits on identical diffs
 */
export declare class CodeAnalysisCache extends GenericCache {
    constructor(ttlMs?: number);
    /**
     * Generate a cache key based on filename and diff content
     * Uses SHA-256 hash for deterministic, collision-resistant keys
     */
    private generateCacheKey;
    /**
     * Get cached analysis result or execute the processor function
     * Provides transparent caching for AI code analysis
     */
    getOrAnalyze(filename: string, diffContent: string, processor: () => Promise<CodeChange>): Promise<CodeChange>;
    /**
     * Get cache statistics for monitoring
     */
    getStats(): {
        size: number;
        ttlMs: number;
    };
    /**
     * Pre-warm cache with known results (useful for testing)
     */
    preWarm(filename: string, diffContent: string, result: CodeChange): void;
}
