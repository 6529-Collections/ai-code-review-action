import { PromptType, PromptResponse, PromptMetrics } from './prompt-types';
import { PromptConfig } from './prompt-config';
/**
 * Unified service for all AI prompt interactions
 * Centralizes prompt execution, caching, error handling, and monitoring
 */
export declare class UnifiedPromptService {
    private static instance;
    private claudeClient;
    private promptTemplates;
    private cache;
    private metrics;
    private useOptimizedPrompts;
    private apiKey;
    private constructor();
    static getInstance(anthropicApiKey: string): UnifiedPromptService;
    /**
     * Execute a prompt with automatic validation, caching, and error handling
     */
    execute<T>(promptType: PromptType, variables: Record<string, any>, config?: Partial<PromptConfig>): Promise<PromptResponse<T>>;
    /**
     * Execute multiple prompts in a batch
     * This now delegates to the advanced batch processor for supported types
     */
    executeBatch<T>(promptType: PromptType, batchVariables: Array<Record<string, any>>, config?: Partial<PromptConfig>): Promise<Array<PromptResponse<T>>>;
    /**
     * Build prompt based on type and variables
     */
    private buildPrompt;
    /**
     * Get prompt template based on type
     */
    private getPromptTemplate;
    /**
     * Execute prompt with retry logic
     */
    private executeWithRetry;
    /**
     * Handle validation failure based on fallback strategy
     */
    private handleValidationFailure;
    /**
     * Handle execution error based on fallback strategy
     */
    private handleExecutionError;
    /**
     * Get prompt configuration
     */
    private getPromptConfig;
    /**
     * Extract confidence from response data
     */
    private extractConfidence;
    /**
     * Estimate token count (rough approximation)
     */
    private estimateTokens;
    /**
     * Get optimal batch size for prompt type
     */
    private getOptimalBatchSize;
    /**
     * Initialize metrics tracking
     */
    private initializeMetrics;
    /**
     * Update metrics for a prompt execution
     */
    private updateMetrics;
    /**
     * Get current metrics
     */
    getMetrics(): Map<PromptType, PromptMetrics>;
    /**
     * Get cache metrics and efficiency report
     */
    getCacheReport(): {
        metrics: any;
        efficiency: string;
        memory: {
            used: number;
            max: number;
            percentage: number;
        };
    };
    /**
     * Clear cache for specific prompt type or all
     */
    clearCache(promptType?: PromptType): void;
    /**
     * Warm cache with predicted inputs
     */
    warmCache(promptType: PromptType, predictedInputs: Array<Record<string, any>>): Promise<void>;
    /**
     * Set maximum cache memory usage
     */
    setCacheMemoryLimit(megabytes: number): void;
    /**
     * Toggle optimized prompts
     */
    setUseOptimizedPrompts(enabled: boolean): void;
    /**
     * Get optimization status
     */
    isUsingOptimizedPrompts(): boolean;
    /**
     * Get batch processor statistics
     */
    getBatchStats(): Promise<Record<string, any>>;
    /**
     * Flush all batch queues
     */
    flushBatches(): Promise<void>;
}
