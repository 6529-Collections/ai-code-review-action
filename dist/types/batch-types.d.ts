/**
 * Unified types for batch processing operations
 */
export interface UnifiedBatchResponse<T> {
    success: boolean;
    results: T[];
    metadata: {
        processedCount: number;
        failedCount: number;
        processingTimeMs: number;
    };
}
export interface SimilarityResult {
    pairId: string;
    shouldMerge: boolean;
    confidence: number;
    reasoning: string;
    scores: {
        name: number;
        description: number;
        pattern: number;
        business: number;
        semantic: number;
    };
}
export interface BatchProcessingOptions {
    maxBatchSize?: number;
    retryAttempts?: number;
    timeoutMs?: number;
    priority?: 'low' | 'normal' | 'high';
}
export interface BatchProcessingError extends Error {
    context: {
        batchSize: number;
        promptType: string;
        tokenCount?: number;
        responseReceived: boolean;
        jsonExtracted: boolean;
        validationPassed: boolean;
    };
}
export interface BatchMetrics {
    totalProcessed: number;
    successfulBatches: number;
    failedBatches: number;
    averageProcessingTime: number;
    averageBatchSize: number;
    tokenEfficiency: number;
}
export declare function isObject(value: unknown): value is Record<string, unknown>;
export declare function isScoresObject(value: unknown): value is SimilarityResult['scores'];
export declare function isSimilarityResult(item: unknown): item is SimilarityResult;
export declare function isUnifiedBatchResponse<T>(value: unknown, itemValidator: (item: unknown) => item is T): value is UnifiedBatchResponse<T>;
