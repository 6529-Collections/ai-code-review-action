import { PromptType } from '../prompt-types';
/**
 * Batch processing strategies for different prompt types
 */
export interface BatchStrategy {
    promptType: PromptType;
    optimalBatchSize: number;
    maxBatchSize: number;
    minBatchSize: number;
    batchTimeout: number;
    priorityWeight: number;
    canBatch: (item: any) => boolean;
    shouldFlush: (batchSize: number, oldestItemAge: number) => boolean;
}
export declare class BatchStrategyFactory {
    private static strategies;
    static getStrategy(promptType: PromptType): BatchStrategy | null;
    static canBatch(promptType: PromptType): boolean;
    static getAllBatchableTypes(): PromptType[];
    /**
     * Dynamically adjust batch size based on performance
     */
    static adjustBatchSize(promptType: PromptType, currentSize: number, successRate: number, avgLatency: number): number;
}
/**
 * Batch formation strategies
 */
export interface BatchFormationStrategy {
    groupBy?: (item: any) => string;
    sortBy?: (item: any) => number;
    filter?: (item: any) => boolean;
}
export declare class BatchFormationStrategies {
    static readonly SIMILARITY_GROUPING: BatchFormationStrategy;
    static readonly FILE_SIZE_GROUPING: BatchFormationStrategy;
    static readonly THEME_COMPLEXITY_GROUPING: BatchFormationStrategy;
    static getStrategy(promptType: PromptType): BatchFormationStrategy | null;
}
