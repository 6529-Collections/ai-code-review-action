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

// Type guards
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isScoresObject(
  value: unknown
): value is SimilarityResult['scores'] {
  if (!isObject(value)) return false;

  const scores = ['name', 'description', 'pattern', 'business', 'semantic'];
  return scores.every(
    (key) => typeof (value as Record<string, unknown>)[key] === 'number'
  );
}

export function isSimilarityResult(item: unknown): item is SimilarityResult {
  if (!isObject(item)) return false;

  const obj = item as Record<string, unknown>;

  return (
    typeof obj.pairId === 'string' &&
    typeof obj.shouldMerge === 'boolean' &&
    typeof obj.confidence === 'number' &&
    obj.confidence >= 0 &&
    obj.confidence <= 1 &&
    typeof obj.reasoning === 'string' &&
    isScoresObject(obj.scores)
  );
}

export function isUnifiedBatchResponse<T>(
  value: unknown,
  itemValidator: (item: unknown) => item is T
): value is UnifiedBatchResponse<T> {
  if (!isObject(value)) return false;

  const obj = value as Record<string, unknown>;

  return (
    typeof obj.success === 'boolean' &&
    Array.isArray(obj.results) &&
    obj.results.every(itemValidator) &&
    isObject(obj.metadata) &&
    typeof (obj.metadata as Record<string, unknown>).processedCount ===
      'number' &&
    typeof (obj.metadata as Record<string, unknown>).failedCount === 'number' &&
    typeof (obj.metadata as Record<string, unknown>).processingTimeMs ===
      'number'
  );
}
