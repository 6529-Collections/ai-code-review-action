import * as exec from '@actions/exec';
import { SecureFileNamer } from './secure-file-namer';
import { performanceTracker } from './performance-tracker';

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
 * Queue item for rate limiting
 */
interface QueueItem {
  id: string;
  prompt: string;
  context: string;
  operation?: string;
  resolve: (result: string) => void;
  reject: (error: Error) => void;
  timestamp: number;
  retryCount: number;
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
export class ClaudeClient {
  // Static shared rate limiting components
  private static requestQueue: QueueItem[] = [];
  private static activeRequests = 0;
  private static readonly MAX_CONCURRENT_REQUESTS = 5;
  private static readonly MIN_REQUEST_INTERVAL = 200; // ms between requests
  private static isProcessing = false;
  private static lastRequestTime = 0;
  private static processingPromise: Promise<void> | null = null;

  // Static metrics for monitoring
  private static queueMetrics = {
    totalQueued: 0,
    totalProcessed: 0,
    totalFailed: 0,
    totalWaitTime: 0,
    maxQueueLength: 0,
    consecutiveRateLimitErrors: 0,
    circuitBreakerUntil: 0,
  };

  // Instance metrics
  private metrics: {
    totalCalls: number;
    totalTime: number;
    errors: number;
    callsByContext: Map<string, number>;
    timeByContext: Map<string, number>;
    errorsByContext: Map<string, number>;
  };

  constructor(private readonly anthropicApiKey: string) {
    // Set the API key for Claude CLI
    process.env.ANTHROPIC_API_KEY = this.anthropicApiKey;

    // Initialize instance metrics
    this.metrics = {
      totalCalls: 0,
      totalTime: 0,
      errors: 0,
      callsByContext: new Map(),
      timeByContext: new Map(),
      errorsByContext: new Map(),
    };
  }

  async callClaude(
    prompt: string,
    context: string = 'unknown',
    operation?: string
  ): Promise<string> {
    // Use global rate-limited queue instead of direct execution
    return this.enqueueRequest(prompt, context, operation);
  }

  /**
   * Enqueue a request for rate-limited processing
   */
  private async enqueueRequest(
    prompt: string,
    context: string,
    operation?: string
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const queueItem: QueueItem = {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        prompt,
        context,
        operation,
        resolve,
        reject,
        timestamp: Date.now(),
        retryCount: 0,
      };

      // Add to static queue
      ClaudeClient.requestQueue.push(queueItem);
      ClaudeClient.queueMetrics.totalQueued++;
      ClaudeClient.queueMetrics.maxQueueLength = Math.max(
        ClaudeClient.queueMetrics.maxQueueLength,
        ClaudeClient.requestQueue.length
      );

      // Start processing if not already running
      ClaudeClient.startQueueProcessor();

      // Log queue status every 10 requests
      if (ClaudeClient.queueMetrics.totalQueued % 10 === 0) {
        console.log(
          `[CLAUDE-QUEUE] Queue: ${ClaudeClient.requestQueue.length} waiting, ${ClaudeClient.activeRequests} active, ${ClaudeClient.queueMetrics.totalProcessed} completed`
        );
      }
    });
  }

  /**
   * Start the static queue processor if not already running
   */
  private static startQueueProcessor(): void {
    if (!ClaudeClient.isProcessing) {
      ClaudeClient.isProcessing = true;
      ClaudeClient.processingPromise = ClaudeClient.processQueue();
    }
  }

  /**
   * Process the request queue with rate limiting
   */
  private static async processQueue(): Promise<void> {
    while (
      ClaudeClient.requestQueue.length > 0 ||
      ClaudeClient.activeRequests > 0
    ) {
      // Check circuit breaker
      if (Date.now() < ClaudeClient.queueMetrics.circuitBreakerUntil) {
        await ClaudeClient.sleep(1000);
        continue;
      }

      // Check if we can start new request
      if (
        ClaudeClient.requestQueue.length > 0 &&
        ClaudeClient.activeRequests < ClaudeClient.MAX_CONCURRENT_REQUESTS &&
        Date.now() - ClaudeClient.lastRequestTime >=
          ClaudeClient.MIN_REQUEST_INTERVAL
      ) {
        const queueItem = ClaudeClient.requestQueue.shift()!;
        ClaudeClient.activeRequests++;
        ClaudeClient.lastRequestTime = Date.now();

        // Process request asynchronously
        ClaudeClient.processRequest(queueItem);
      } else {
        // Wait briefly before checking again
        await ClaudeClient.sleep(50);
      }
    }

    ClaudeClient.isProcessing = false;
    ClaudeClient.processingPromise = null;
  }

  /**
   * Process a single request with error handling and retry logic
   */
  private static async processRequest(queueItem: QueueItem): Promise<void> {
    const startTime = Date.now();

    try {
      // Create a temporary client instance for execution
      const tempClient = new ClaudeClient(process.env.ANTHROPIC_API_KEY || '');
      const result = await tempClient.executeClaudeCall(queueItem.prompt);

      // Track successful metrics
      const duration = Date.now() - startTime;
      ClaudeClient.queueMetrics.totalProcessed++;
      ClaudeClient.queueMetrics.totalWaitTime +=
        startTime - queueItem.timestamp;
      ClaudeClient.queueMetrics.consecutiveRateLimitErrors = 0;

      // Track instance metrics
      tempClient.metrics.totalCalls++;
      tempClient.metrics.totalTime += duration;
      tempClient.updateContextCounter(
        tempClient.metrics.callsByContext,
        queueItem.context
      );
      tempClient.updateContextCounter(
        tempClient.metrics.timeByContext,
        queueItem.context,
        duration
      );

      // Track with performance tracker
      performanceTracker.trackAICall(
        queueItem.context,
        duration,
        queueItem.operation
      );

      queueItem.resolve(result);
    } catch (error) {
      await ClaudeClient.handleRequestError(queueItem, error);
    } finally {
      ClaudeClient.activeRequests--;
    }
  }

  /**
   * Handle request errors with retry logic
   */
  private static async handleRequestError(
    queueItem: QueueItem,
    error: unknown
  ): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isRateLimitError = ClaudeClient.isRateLimitError(errorMessage);

    if (isRateLimitError) {
      ClaudeClient.queueMetrics.consecutiveRateLimitErrors++;
      console.error(`[CLAUDE-RATE-LIMIT] Rate limit detected: ${errorMessage}`);

      // Circuit breaker: pause processing after 5 consecutive rate limit errors
      if (ClaudeClient.queueMetrics.consecutiveRateLimitErrors >= 5) {
        ClaudeClient.queueMetrics.circuitBreakerUntil = Date.now() + 30000; // 30 seconds
        console.error('[CLAUDE-RATE-LIMIT] Circuit breaker activated for 30s');
      }

      // Retry with exponential backoff
      if (queueItem.retryCount < 3) {
        queueItem.retryCount++;
        const backoffDelay = Math.pow(2, queueItem.retryCount) * 1000; // 2s, 4s, 8s

        console.error(
          `[CLAUDE-RATE-LIMIT] Retrying in ${backoffDelay}ms (attempt ${queueItem.retryCount}/3)`
        );

        setTimeout(() => {
          ClaudeClient.requestQueue.unshift(queueItem); // Add back to front of queue
        }, backoffDelay);

        return;
      }
    }

    // Failed permanently
    ClaudeClient.queueMetrics.totalFailed++;
    console.error(`[CLAUDE-ERROR] Request failed permanently: ${errorMessage}`);
    queueItem.reject(new Error(`Claude API call failed: ${errorMessage}`));
  }

  /**
   * Check if error is rate limit related
   */
  private static isRateLimitError(errorMessage: string): boolean {
    const rateLimitPatterns = [
      'rate_limit_error',
      'rate limit',
      'too many requests',
      'quota exceeded',
      '429',
      'throttled',
    ];

    const lowerError = errorMessage.toLowerCase();
    return rateLimitPatterns.some((pattern) => lowerError.includes(pattern));
  }

  /**
   * Sleep utility
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async executeClaudeCall(prompt: string): Promise<string> {
    let tempFile: string | null = null;

    try {
      // Create secure temporary file for this request
      const { filePath, cleanup } = SecureFileNamer.createSecureTempFile(
        'claude-prompt',
        prompt
      );
      tempFile = filePath;
      performanceTracker.trackTempFile(true);

      let output = '';
      let errorOutput = '';
      let exitCode = 0;

      try {
        exitCode = await exec.exec(
          'bash',
          ['-c', `cat "${tempFile}" | claude --print`],
          {
            silent: true, // Suppress command logging
            listeners: {
              stdout: (data: Buffer) => {
                output += data.toString();
              },
              stderr: (data: Buffer) => {
                errorOutput += data.toString();
              },
            },
            ignoreReturnCode: true,
          }
        );

        if (exitCode !== 0) {
          // Log prompt size and first few lines for debugging
          const promptLines = prompt.split('\n');
          const promptPreview = promptLines.slice(0, 5).join('\n');
          console.error(`[CLAUDE-ERROR] Exit code: ${exitCode}`);
          console.error(
            `[CLAUDE-ERROR] Prompt size: ${prompt.length} chars, ${promptLines.length} lines`
          );
          console.error(`[CLAUDE-ERROR] Prompt preview: ${promptPreview}...`);
          console.error(`[CLAUDE-ERROR] Error output: ${errorOutput}`);

          throw new Error(
            `Claude CLI failed with exit code ${exitCode}. ` +
              `Error: ${errorOutput || 'No error output'}. ` +
              `Prompt was ${prompt.length} chars.`
          );
        }

        if (!output || output.trim().length === 0) {
          throw new Error('Claude returned empty response');
        }

        return output.trim();
      } finally {
        cleanup(); // Use secure cleanup
        performanceTracker.trackTempFile(false);
      }
    } catch (error) {
      throw new Error(`Claude API call failed: ${error}`);
    }
  }

  private updateContextCounter(
    map: Map<string, number>,
    context: string,
    value: number = 1
  ): void {
    const current = map.get(context) || 0;
    map.set(context, current + value);
  }

  /**
   * Get current AI call metrics
   */
  getMetrics(): AICallMetrics {
    return {
      totalCalls: this.metrics.totalCalls,
      totalTime: this.metrics.totalTime,
      averageTime:
        this.metrics.totalCalls > 0
          ? this.metrics.totalTime / this.metrics.totalCalls
          : 0,
      errors: this.metrics.errors,
      callsByContext: new Map(this.metrics.callsByContext),
      timeByContext: new Map(this.metrics.timeByContext),
      errorsByContext: new Map(this.metrics.errorsByContext),
    };
  }

  /**
   * Reset metrics (useful for testing or between runs)
   */
  resetMetrics(): void {
    this.metrics.totalCalls = 0;
    this.metrics.totalTime = 0;
    this.metrics.errors = 0;
    this.metrics.callsByContext.clear();
    this.metrics.timeByContext.clear();
    this.metrics.errorsByContext.clear();
  }

  /**
   * Get current queue status (static method)
   */
  static getQueueStatus(): QueueStatus {
    return {
      queueLength: ClaudeClient.requestQueue.length,
      activeRequests: ClaudeClient.activeRequests,
      totalProcessed: ClaudeClient.queueMetrics.totalProcessed,
      totalFailed: ClaudeClient.queueMetrics.totalFailed,
      averageWaitTime:
        ClaudeClient.queueMetrics.totalProcessed > 0
          ? ClaudeClient.queueMetrics.totalWaitTime /
            ClaudeClient.queueMetrics.totalProcessed
          : 0,
      maxQueueLength: ClaudeClient.queueMetrics.maxQueueLength,
      isProcessing: ClaudeClient.isProcessing,
    };
  }

  /**
   * Clear the global queue (useful for testing)
   */
  static clearQueue(): void {
    // Reject all pending requests
    ClaudeClient.requestQueue.forEach((item) => {
      item.reject(new Error('Queue cleared'));
    });

    ClaudeClient.requestQueue = [];
    ClaudeClient.activeRequests = 0;
    ClaudeClient.isProcessing = false;
    ClaudeClient.processingPromise = null;

    // Reset metrics
    ClaudeClient.queueMetrics = {
      totalQueued: 0,
      totalProcessed: 0,
      totalFailed: 0,
      totalWaitTime: 0,
      maxQueueLength: 0,
      consecutiveRateLimitErrors: 0,
      circuitBreakerUntil: 0,
    };
  }

  /**
   * Set maximum concurrent requests (useful for testing/debugging)
   */
  static setMaxConcurrency(limit: number): void {
    if (limit > 0 && limit <= 20) {
      // Use object property assignment to modify readonly property
      Object.defineProperty(ClaudeClient, 'MAX_CONCURRENT_REQUESTS', {
        value: limit,
        writable: false,
        enumerable: true,
        configurable: true,
      });
      console.log(`[CLAUDE-QUEUE] Max concurrency set to ${limit}`);
    } else {
      console.warn(`[CLAUDE-QUEUE] Invalid concurrency limit: ${limit}`);
    }
  }

  /**
   * Get detailed queue statistics for debugging
   */
  static getDetailedStats(): {
    queue: QueueStatus;
    circuitBreaker: { active: boolean; until: number };
    rateLimiting: { consecutiveErrors: number; lastRequestTime: number };
    processing: { isRunning: boolean; hasPromise: boolean };
  } {
    return {
      queue: ClaudeClient.getQueueStatus(),
      circuitBreaker: {
        active: Date.now() < ClaudeClient.queueMetrics.circuitBreakerUntil,
        until: ClaudeClient.queueMetrics.circuitBreakerUntil,
      },
      rateLimiting: {
        consecutiveErrors: ClaudeClient.queueMetrics.consecutiveRateLimitErrors,
        lastRequestTime: ClaudeClient.lastRequestTime,
      },
      processing: {
        isRunning: ClaudeClient.isProcessing,
        hasPromise: ClaudeClient.processingPromise !== null,
      },
    };
  }
}
