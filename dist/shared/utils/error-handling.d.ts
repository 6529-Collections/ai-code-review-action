/**
 * Comprehensive error handling utilities for AI service failures
 */
export interface RetryConfig {
    maxRetries: number;
    baseDelayMs: number;
    maxDelayMs: number;
    backoffFactor: number;
}
export declare const DEFAULT_RETRY_CONFIG: RetryConfig;
export interface ErrorContext {
    operation: string;
    input?: unknown;
    attempt?: number;
    totalAttempts?: number;
    originalError?: Error;
}
export declare class AIServiceError extends Error {
    readonly context: ErrorContext;
    readonly isRetryable: boolean;
    constructor(message: string, context: ErrorContext, isRetryable?: boolean);
}
export declare class ErrorHandler {
    /**
     * Execute function with exponential backoff retry
     */
    static retryWithBackoff<T>(operation: () => Promise<T>, operationName: string, config?: Partial<RetryConfig>, input?: unknown): Promise<T>;
    /**
     * Execute operation with fallback when AI fails
     */
    static executeWithFallback<T>(primaryOperation: () => Promise<T>, fallbackOperation: () => T | Promise<T>, operationName: string, input?: unknown): Promise<T>;
    /**
     * Handle JSON parsing errors with detailed diagnostics
     */
    static handleJsonParsingError(response: string, operation: string, expectedSchema?: string): AIServiceError;
    /**
     * Handle process execution errors
     */
    static handleProcessError(error: Error, operation: string, command?: string): AIServiceError;
    /**
     * Create error for analysis failures with fallback recommendations
     */
    static createAnalysisError(operation: string, input: unknown, error: Error, fallbackAvailable?: boolean): AIServiceError;
    /**
     * Determine if an error is retryable
     */
    private static isRetryableError;
    /**
     * Sleep utility for delays
     */
    private static sleep;
    /**
     * Log detailed error information for debugging
     */
    static logDetailedError(error: unknown, context?: string): void;
}
