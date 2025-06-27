import { PromptType, PromptResponse } from '../prompt-types';
/**
 * LRU (Least Recently Used) cache implementation for AI responses
 */
export declare class AIResponseCache {
    private static instance;
    private caches;
    private metricsCollector;
    private totalMemoryUsage;
    private maxMemoryUsage;
    private constructor();
    static getInstance(): AIResponseCache;
    /**
     * Get cached response if available
     */
    get<T>(promptType: PromptType, inputs: any): PromptResponse<T> | null;
    /**
     * Store response in cache
     */
    set<T>(promptType: PromptType, inputs: any, response: PromptResponse<T>): void;
    /**
     * Clear cache for specific prompt type or all
     */
    clear(promptType?: PromptType): void;
    /**
     * Get cache metrics
     */
    getMetrics(): import("./cache-metrics").CacheMetrics | import("./cache-metrics").CacheMetricsByType;
    /**
     * Get cache efficiency report
     */
    getEfficiencyReport(): string;
    /**
     * Warm cache with predicted entries
     */
    warmCache(promptType: PromptType, predictedInputs: Array<any>, executor: (inputs: any) => Promise<PromptResponse<any>>): Promise<void>;
    /**
     * Initialize cache maps
     */
    private initializeCaches;
    /**
     * Start periodic cleanup of expired entries
     */
    private startCleanupInterval;
    /**
     * Remove expired entries
     */
    private cleanupExpiredEntries;
    /**
     * Evict least recently used entry from a specific cache
     */
    private evictLRU;
    /**
     * Evict entries to free up space
     */
    private evictEntries;
    /**
     * Estimate size of a response in bytes
     */
    private estimateSize;
    /**
     * Get total size of a cache
     */
    private getCacheSize;
    /**
     * Update memory usage tracking
     */
    private updateMemoryUsage;
    /**
     * Get current memory usage
     */
    getMemoryUsage(): {
        used: number;
        max: number;
        percentage: number;
    };
    /**
     * Set maximum memory usage
     */
    setMaxMemoryUsage(bytes: number): void;
}
