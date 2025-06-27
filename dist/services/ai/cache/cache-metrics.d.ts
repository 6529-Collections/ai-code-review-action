import { PromptType } from '../prompt-types';
/**
 * Cache performance metrics
 */
export interface CacheMetrics {
    hits: number;
    misses: number;
    evictions: number;
    totalRequests: number;
    hitRate: number;
    averageHitAge: number;
    memoryUsage: number;
}
export interface CacheMetricsByType {
    [key: string]: CacheMetrics;
}
/**
 * Cache metrics collector
 */
export declare class CacheMetricsCollector {
    private metrics;
    private hitAges;
    constructor();
    private initializeMetrics;
    recordHit(promptType: PromptType, ageMs: number): void;
    recordMiss(promptType: PromptType): void;
    recordEviction(promptType: PromptType): void;
    updateMemoryUsage(promptType: PromptType, bytes: number): void;
    getMetrics(promptType?: PromptType): CacheMetrics | CacheMetricsByType;
    getOverallMetrics(): CacheMetrics;
    reset(): void;
    private createEmptyMetrics;
    /**
     * Get cache efficiency report
     */
    getEfficiencyReport(): string;
}
