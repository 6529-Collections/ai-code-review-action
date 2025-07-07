import { ThemePair, BatchSimilarityResult } from '../types/similarity-types';
export declare class BatchProcessor {
    private batchSize;
    private batchFailures;
    processBatchSimilarity(pairs: ThemePair[]): Promise<BatchSimilarityResult[]>;
    getAdaptiveBatchSize(): number;
    incrementFailures(): void;
    decrementFailures(): void;
    getFailureCount(): number;
    chunkArray<T>(array: T[], chunkSize: number): T[][];
    private buildBatchSimilarityPrompt;
    private parseBatchSimilarityResponse;
    private clampScore;
    private createFallbackSimilarity;
}
