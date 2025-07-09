/**
 * Semantic Cache Service for AI Analysis Results
 *
 * Implements PRD requirements:
 * - "Pattern caching: Cache identified business patterns for reuse within same PR"
 * - "Analysis caching: Store AI results with 1-hour TTL to avoid redundant API calls"
 * - "Smart invalidation: Clear cache selectively based on file modifications"
 */
export declare class SemanticCacheService {
    private cache;
    private semanticSimilarityThreshold;
    constructor();
    /**
     * Get cached result if semantically similar input exists
     * PRD: "Similarity detection: AI-driven identification of semantic duplicates"
     */
    getCachedResult<T>(input: unknown, cacheKey: string, contextType: string): Promise<T | null>;
    /**
     * Store result with semantic indexing
     * PRD: "Cache intermediate analysis results"
     */
    setCachedResult<T>(input: unknown, result: T, cacheKey: string, contextType: string, customTTL?: number): void;
    /**
     * Find semantically similar cached result
     */
    private findSemanticMatch;
    /**
     * Generate semantic key for input similarity matching
     * Extracts key semantic tokens from input
     */
    private generateSemanticKey;
    /**
     * Extract semantic tokens from text
     */
    private extractSemanticTokens;
    /**
     * Extract meaningful tokens from file paths
     */
    private extractFileTokens;
    /**
     * Check if word is a stop word (common words that don't add semantic meaning)
     */
    private isStopWord;
    /**
     * Calculate semantic similarity between two semantic keys
     * Uses Jaccard similarity on token sets
     */
    private calculateSemanticSimilarity;
    /**
     * Get TTL based on context type and complexity
     * PRD: "Context-aware TTL (simple = 2hr, complex = 30min)"
     */
    private getContextTTL;
    /**
     * Sanitize input for storage (remove sensitive data, limit size)
     */
    private sanitizeInputForStorage;
    /**
     * Warm cache with common patterns
     * PRD: "Cache warming for predictable patterns"
     */
    warmCacheWithPatterns(commonPatterns: Array<{
        input: unknown;
        result: unknown;
        contextType: string;
    }>): void;
    /**
     * Clear cache selectively based on file modifications
     * PRD: "Smart invalidation: Clear cache selectively based on file modifications"
     */
    invalidateByFiles(modifiedFiles: string[]): void;
    /**
     * Generate cache key from input
     */
    private generateCacheKey;
    /**
     * Get cache statistics
     */
    getCacheStats(): {
        totalEntries: number;
        hitRate: number;
        contextBreakdown: Record<string, number>;
    };
    /**
     * Clear all cache entries
     */
    clear(): void;
}
export declare const semanticCache: SemanticCacheService;
