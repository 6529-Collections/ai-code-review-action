/**
 * Concurrency management utility for processing items with controlled parallelism,
 * retry logic, and progress tracking with dynamic resource-based optimization.
 */
export interface SystemMetrics {
    cpuCount: number;
    availableMemory: number;
    currentHeapUsed: number;
    isUnderMemoryPressure: boolean;
}
export interface ConcurrencyOptions<T> {
    /** Maximum number of concurrent operations (default: dynamic based on system) */
    concurrencyLimit?: number;
    /** Enable dynamic concurrency adjustment (default: true) */
    dynamicConcurrency?: boolean;
    /** Maximum retry attempts for failed operations (default: 3) */
    maxRetries?: number;
    /** Base delay between retries in milliseconds (default: 1000) */
    retryDelay?: number;
    /** Multiplier for exponential backoff (default: 2) */
    retryBackoffMultiplier?: number;
    /** Enable jitter in retry delays (default: true) */
    enableJitter?: boolean;
    /** Context for smart retry strategies */
    context?: 'theme_processing' | 'ai_batch' | 'general';
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
     * Get current system metrics for dynamic concurrency calculation
     */
    static getSystemMetrics(): SystemMetrics;
    /**
     * Calculate optimal concurrency limit based on system resources
     */
    static calculateOptimalConcurrency(metrics: SystemMetrics, context?: string): number;
    /**
     * Get context-aware retry configuration
     */
    static getRetryConfig(context: string, error?: Error): {
        maxRetries: number;
        baseDelay: number;
        multiplier: number;
    };
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
     * @param onError Optional error callback
     * @returns Processed result
     * @throws Error if all retry attempts fail
     */
    static processWithRetry<T, R>(item: T, processor: (item: T) => Promise<R>, maxRetries?: number, baseDelay?: number, onError?: (error: Error, item: T, retryCount: number) => void, enableJitter?: boolean, context?: string): Promise<R>;
    /**
     * Calculate exponential backoff delay with jitter and maximum cap.
     *
     * @param attempt Current attempt number (0-based)
     * @param baseDelay Base delay in milliseconds
     * @param multiplier Backoff multiplier
     * @returns Delay in milliseconds
     */
    static calculateBackoffDelay(attempt: number, baseDelay: number, multiplier?: number, enableJitter?: boolean): number;
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
    /**
     * Enhanced processing with dynamic concurrency adjustment based on API performance
     * PRD: "Adaptive concurrency: Start with 5 concurrent operations, adjust based on API response times"
     */
    static processConcurrentlyWithAdaptiveLimit<T, R>(items: T[], processor: (item: T) => Promise<R>, options?: ConcurrencyOptions<T> & {
        /** Initial concurrency limit (default: 5 as per PRD) */
        initialConcurrency?: number;
        /** Target response time in ms (default: 2000ms) */
        targetResponseTime?: number;
        /** How often to adjust concurrency (default: every 10 operations) */
        adjustmentInterval?: number;
    }): Promise<Array<R | {
        error: Error;
        item: T;
    }>>;
    /**
     * Calculate adjusted concurrency based on performance metrics
     * PRD: "Increase by 1 if avg response < 500ms, Decrease by 2 if error rate > 5%"
     */
    private static calculateAdjustedConcurrency;
    /**
     * Calculate average response time from array of times
     */
    private static calculateAverageResponseTime;
    /**
     * Enhanced processing with circuit breaker pattern
     * PRD: "Never fail completely: Always provide meaningful output"
     */
    static processConcurrentlyWithCircuitBreaker<T, R>(items: T[], processor: (item: T) => Promise<R>, options?: ConcurrencyOptions<T> & {
        /** Circuit breaker failure threshold (default: 0.5 = 50% failures) */
        failureThreshold?: number;
        /** Circuit breaker timeout before retry (default: 30s) */
        circuitBreakerTimeout?: number;
        /** Fallback processor for when circuit is open */
        fallbackProcessor?: (item: T) => Promise<R>;
    }): Promise<Array<R | {
        error: Error;
        item: T;
    }>>;
}
