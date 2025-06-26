/**
 * Concurrency management utility for processing items with controlled parallelism,
 * retry logic, and progress tracking.
 */
export interface ConcurrencyOptions<T> {
    /** Maximum number of concurrent operations (default: 5) */
    concurrencyLimit?: number;
    /** Maximum retry attempts for failed operations (default: 3) */
    maxRetries?: number;
    /** Base delay between retries in milliseconds (default: 1000) */
    retryDelay?: number;
    /** Multiplier for exponential backoff (default: 2) */
    retryBackoffMultiplier?: number;
    /** Callback for progress updates */
    onProgress?: (completed: number, total: number) => void;
    /** Callback for retry attempts */
    onError?: (error: Error, item: T, retryCount: number) => void;
    /** Enable debug logging (default: false) */
    enableLogging?: boolean;
}
export interface ConcurrencyResult<T, R> {
    /** Successfully processed result */
    success: true;
    result: R;
    item: T;
}
export interface ConcurrencyError<T> {
    /** Failed processing with error */
    success: false;
    error: Error;
    item: T;
}
export type ConcurrencyOutcome<T, R> = ConcurrencyResult<T, R> | ConcurrencyError<T>;
export declare class ConcurrencyManager {
    /**
     * Process items concurrently with controlled parallelism and retry logic.
     *
     * When an item finishes processing, the next item immediately starts - no waiting for batches.
     * Failed items are retried with exponential backoff up to maxRetries times.
     *
     * @param items Array of items to process
     * @param processor Function that processes each item
     * @param options Configuration options
     * @returns Array of results in the same order as input items
     */
    static processConcurrentlyWithLimit<T, R>(items: T[], processor: (item: T) => Promise<R>, options?: ConcurrencyOptions<T>): Promise<Array<R | {
        error: Error;
        item: T;
    }>>;
    /**
     * Process a single item with retry logic and exponential backoff.
     *
     * @param item Item to process
     * @param processor Processing function
     * @param maxRetries Maximum number of retry attempts
     * @param baseDelay Base delay between retries in milliseconds
     * @param backoffMultiplier Multiplier for exponential backoff
     * @param onError Optional error callback
     * @returns Processed result
     * @throws Error if all retry attempts fail
     */
    static processWithRetry<T, R>(item: T, processor: (item: T) => Promise<R>, maxRetries?: number, baseDelay?: number, backoffMultiplier?: number, onError?: (error: Error, item: T, retryCount: number) => void): Promise<R>;
    /**
     * Calculate exponential backoff delay with jitter and maximum cap.
     *
     * @param attempt Current attempt number (0-based)
     * @param baseDelay Base delay in milliseconds
     * @param multiplier Backoff multiplier
     * @returns Delay in milliseconds
     */
    static calculateBackoffDelay(attempt: number, baseDelay: number, multiplier?: number): number;
    /**
     * Sleep utility function.
     *
     * @param ms Milliseconds to sleep
     * @returns Promise that resolves after the specified time
     */
    static sleep(ms: number): Promise<void>;
    /**
     * Helper to separate successful results from errors.
     *
     * @param results Mixed array of results and errors
     * @returns Object with separate successful and failed arrays
     */
    static separateResults<T, R>(results: Array<R | {
        error: Error;
        item: T;
    }>): {
        successful: R[];
        failed: Array<{
            error: Error;
            item: T;
        }>;
    };
}
