import { PromptType } from '../prompt-types';
/**
 * Adaptive batching configuration based on system performance
 */
export interface AdaptiveConfig {
    currentBatchSize: number;
    successRate: number;
    avgLatency: number;
    errorRate: number;
    throughput: number;
    lastAdjustment: Date;
}
export interface SystemMetrics {
    cpuUsage: number;
    memoryUsage: number;
    apiResponseTime: number;
    queueDepth: number;
    timeOfDay: number;
}
/**
 * Adaptive batching controller that adjusts batch sizes based on performance
 */
export declare class AdaptiveBatchingController {
    private configs;
    private performanceWindow;
    private adjustmentCooldown;
    constructor();
    /**
     * Initialize adaptive configs for all batchable prompt types
     */
    private initializeConfigs;
    /**
     * Get optimal batch size for a prompt type
     */
    getOptimalBatchSize(promptType: PromptType, systemMetrics?: SystemMetrics): number;
    /**
     * Update performance metrics and adjust batch size if needed
     */
    updateMetrics(promptType: PromptType, batchSize: number, success: boolean, latency: number): void;
    /**
     * Adjust batch size based on performance metrics
     */
    private adjustBatchSize;
    /**
     * Adjust batch size based on system load
     */
    private adjustForSystemLoad;
    /**
     * Get batch size constraints for a prompt type
     */
    private getBatchConstraints;
    /**
     * Get performance report
     */
    getPerformanceReport(): Record<string, any>;
    /**
     * Reset adaptive configurations
     */
    reset(): void;
    /**
     * Get current configuration for a prompt type
     */
    getConfig(promptType: PromptType): AdaptiveConfig | undefined;
    /**
     * Manually set batch size (for testing/overrides)
     */
    setBatchSize(promptType: PromptType, size: number): void;
}
