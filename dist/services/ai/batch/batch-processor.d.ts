import { PromptType, PromptResponse } from '../prompt-types';
import { ConsolidatedTheme } from '../../../types/similarity-types';
import { UnifiedBatchResponse, SimilarityResult, BatchProcessingOptions } from '../../../types/batch-types';
interface QueueItem<T> {
    id: string;
    promptType: PromptType;
    variables: Record<string, any>;
    resolve: (value: PromptResponse<T>) => void;
    reject: (error: any) => void;
    timestamp: number;
    priority: number;
}
interface Batch<T> {
    id: string;
    promptType: PromptType;
    items: QueueItem<T>[];
    createdAt: number;
    status: 'pending' | 'processing' | 'completed' | 'failed';
}
/**
 * Advanced batch processor with priority queuing and adaptive sizing
 */
export declare class BatchProcessor {
    private static instance;
    private unifiedService;
    private adaptiveController;
    private queues;
    private processing;
    private batchHistory;
    private circuitBreaker;
    private constructor();
    static getInstance(anthropicApiKey: string): BatchProcessor;
    /**
     * Add item to batch queue
     */
    add<T>(promptType: PromptType, variables: Record<string, any>, priority?: number): Promise<PromptResponse<T>>;
    /**
     * Add multiple items as a group
     */
    addBatch<T>(promptType: PromptType, items: Array<{
        variables: Record<string, any>;
        priority?: number;
    }>): Promise<PromptResponse<T>[]>;
    /**
     * Enqueue item with proper ordering
     */
    private enqueue;
    /**
     * Initialize queues and circuit breakers
     */
    private initializeQueues;
    /**
     * Start background processing loop
     */
    private startProcessingLoop;
    /**
     * Process queue for a specific prompt type
     */
    private processQueue;
    /**
     * Extract items for batch processing
     */
    private extractBatch;
    /**
     * Extract batch with grouping strategy
     */
    private extractBatchWithGrouping;
    /**
     * Process a batch of items
     */
    private processBatch;
    /**
     * Execute batch based on prompt type
     */
    private executeBatch;
    /**
     * Execute similarity checks in batch
     */
    private executeSimilarityBatch;
    /**
     * Execute theme expansions in batch
     */
    private executeExpansionBatch;
    /**
     * Execute domain extractions in batch
     */
    private executeDomainBatch;
    /**
     * Get current system metrics
     */
    private getSystemMetrics;
    /**
     * Get total queue depth across all types
     */
    private getTotalQueueDepth;
    /**
     * Get queue statistics
     */
    getQueueStats(): Record<string, any>;
    /**
     * Flush all queues (for shutdown)
     */
    flush(): Promise<void>;
    /**
     * Get batch history
     */
    getBatchHistory(limit?: number): Batch<any>[];
    /**
     * Process similarity batch using unified format
     */
    processSimilarityBatch(pairs: Array<{
        theme1: ConsolidatedTheme;
        theme2: ConsolidatedTheme;
    }>, options?: BatchProcessingOptions): Promise<UnifiedBatchResponse<SimilarityResult>>;
    /**
     * Build unified similarity prompt
     */
    private buildUnifiedSimilarityPrompt;
    /**
     * Parse unified similarity response
     */
    private parseUnifiedSimilarityResponse;
    /**
     * Estimate token count for a prompt (simplified)
     */
    private estimateTokens;
}
export {};
