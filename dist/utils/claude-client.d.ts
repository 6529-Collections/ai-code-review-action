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
 * Enhanced Claude client with performance tracking
 */
export declare class ClaudeClient {
    private readonly anthropicApiKey;
    private metrics;
    constructor(anthropicApiKey: string);
    callClaude(prompt: string, context?: string, operation?: string): Promise<string>;
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
}
