/**
 * Performance tracking for AI calls
 */
export interface AICallMetrics {
    totalCalls: number;
    totalTime: number;
    averageTime: number;
    errors: number;
    callsByContext: Map<string, number>;
    timeByContext: Map<string, number>;
    errorsByContext: Map<string, number>;
}
export interface AICallResult {
    response: string;
    duration: number;
    success: boolean;
}
/**
 * Queue status for monitoring
 */
export interface QueueStatus {
    queueLength: number;
    activeRequests: number;
    totalProcessed: number;
    totalFailed: number;
    averageWaitTime: number;
    maxQueueLength: number;
    isProcessing: boolean;
}
/**
 * Enhanced Claude client with performance tracking and global rate limiting
 */
export declare class ClaudeClient {
    private readonly anthropicApiKey;
    private static requestQueue;
    private static activeRequests;
    private static activeRequestsByContext;
    private static readonly MAX_CONCURRENT_REQUESTS;
    private static readonly MIN_REQUEST_INTERVAL;
    private static isProcessing;
    private static lastRequestTime;
    private static processingPromise;
    private static queueMetrics;
    private metrics;
    constructor(anthropicApiKey: string);
    callClaude(prompt: string, context?: string, operation?: string): Promise<string>;
    /**
     * Enqueue a request for rate-limited processing
     */
    private enqueueRequest;
    /**
     * Start the static queue processor if not already running
     */
    private static startQueueProcessor;
    /**
     * Process the request queue with rate limiting
     */
    private static processQueue;
    /**
     * Process a single request with error handling and retry logic
     */
    private static processRequest;
    /**
     * Handle request errors with retry logic
     */
    private static handleRequestError;
    /**
     * Check if error is rate limit related
     */
    private static isRateLimitError;
    /**
     * Sleep utility
     */
    private static sleep;
    private executeClaudeCall;
    private updateContextCounter;
    /**
     * Get current AI call metrics
     */
    getMetrics(): AICallMetrics;
    /**
     * Reset metrics (useful for testing or between runs)
     */
    resetMetrics(): void;
    /**
     * Get current queue status (static method)
     */
    static getQueueStatus(): QueueStatus;
    /**
     * Clear the global queue (useful for testing)
     */
    static clearQueue(): void;
    /**
     * Set maximum concurrent requests (useful for testing/debugging)
     */
    static setMaxConcurrency(limit: number): void;
    /**
     * Get detailed queue statistics for debugging
     */
    static getDetailedStats(): {
        queue: QueueStatus;
        circuitBreaker: {
            active: boolean;
            until: number;
        };
        rateLimiting: {
            consecutiveErrors: number;
            lastRequestTime: number;
        };
        processing: {
            isRunning: boolean;
            hasPromise: boolean;
        };
    };
    /**
     * Log enhanced queue status with categorization
     */
    private static logEnhancedQueueStatus;
    /**
     * Get category statistics for waiting queue items
     */
    private static getQueueCategoryStats;
    /**
     * Get category statistics for active requests
     */
    private static getActiveCategoryStats;
    /**
     * Simplify context names for display
     */
    private static getCategoryKey;
}
