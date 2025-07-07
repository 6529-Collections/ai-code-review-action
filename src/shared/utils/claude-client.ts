import * as exec from '@actions/exec';
import { SecureFileNamer } from '@/mindmap/utils/secure-file-namer';
import { performanceTracker } from './performance-tracker';
import { logger } from '@/shared/logger/logger';
import { LoggerServices } from '@/shared/logger/constants';

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
  private static activeRequestsByContext: Map<string, number> = new Map();
  private static readonly MAX_CONCURRENT_REQUESTS = 10;
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

      // Log enhanced queue status every 10 requests
      if (ClaudeClient.queueMetrics.totalQueued % 10 === 0) {
        ClaudeClient.logEnhancedQueueStatus();
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
      
      // Start periodic diagnostic logging
      ClaudeClient.startPeriodicLogging();
    }
  }

  /**
   * Start periodic diagnostic logging every 10 seconds
   */
  private static startPeriodicLogging(): void {
    const logInterval = setInterval(() => {
      if (ClaudeClient.requestQueue.length > 0 || ClaudeClient.activeRequests > 0) {
        const cbActive = Date.now() < ClaudeClient.queueMetrics.circuitBreakerUntil;
        logger.debug(LoggerServices.CLAUDE_CLIENT, `active: ${ClaudeClient.activeRequests}/${ClaudeClient.MAX_CONCURRENT_REQUESTS}, queue: ${ClaudeClient.requestQueue.length}, processed: ${ClaudeClient.queueMetrics.totalProcessed}/${ClaudeClient.queueMetrics.totalQueued}${cbActive ? ', CB-ACTIVE' : ''}`);
      } else if (ClaudeClient.queueMetrics.totalProcessed > 0) {
        // Stop logging when queue is empty and some work was done
        clearInterval(logInterval);
        logger.debug(LoggerServices.CLAUDE_CLIENT, 'Queue empty, stopping logs');
      }
    }, 10000); // Every 10 seconds
  }

  /**
   * Process the request queue with rate limiting
   */
  private static async processQueue(): Promise<void> {
    let loopIterations = 0;
    let lastDiagnosticLog = Date.now();
    
    while (
      ClaudeClient.requestQueue.length > 0 ||
      ClaudeClient.activeRequests > 0
    ) {
      loopIterations++;
      
      // Early termination check - if truly idle, exit immediately
      if (ClaudeClient.requestQueue.length === 0 && ClaudeClient.activeRequests === 0) {
        break;
      }
      
      // Log diagnostics every 5 seconds while processing
      if (Date.now() - lastDiagnosticLog > 5000) {
        logger.debug(LoggerServices.CLAUDE_CLIENT, `Loop #${loopIterations} | active: ${ClaudeClient.activeRequests}, queue: ${ClaudeClient.requestQueue.length}`);
        lastDiagnosticLog = Date.now();
      }
      
      // Check circuit breaker
      if (Date.now() < ClaudeClient.queueMetrics.circuitBreakerUntil) {
        logger.warn(LoggerServices.CLAUDE_CLIENT, 'Circuit breaker active, sleeping 1000ms');
        await ClaudeClient.sleep(1000);
        continue;
      }

      // Check if we can start new request
      const hasItemsInQueue = ClaudeClient.requestQueue.length > 0;
      const hasCapacity = ClaudeClient.activeRequests < ClaudeClient.MAX_CONCURRENT_REQUESTS;
      const intervalPassed = Date.now() - ClaudeClient.lastRequestTime >= ClaudeClient.MIN_REQUEST_INTERVAL;
      
      if (hasItemsInQueue && hasCapacity && intervalPassed) {
        const queueItem = ClaudeClient.requestQueue.shift()!;
        ClaudeClient.activeRequests++;
        ClaudeClient.lastRequestTime = Date.now();
        
        logger.debug(LoggerServices.CLAUDE_CLIENT, `Starting | active: ${ClaudeClient.activeRequests}, queue: ${ClaudeClient.requestQueue.length}, label: ${queueItem.context}`);

        // Process request asynchronously
        ClaudeClient.processRequest(queueItem);
      } else {
        // Log why we can't start a new request (only if there are items in queue)
        if (hasItemsInQueue && loopIterations % 100 === 0) { // Log every 100 iterations (5 seconds)
          logger.debug(LoggerServices.CLAUDE_CLIENT, `Waiting | active: ${ClaudeClient.activeRequests}, queue: ${ClaudeClient.requestQueue.length}, reason: ${!hasCapacity ? 'capacity' : !intervalPassed ? 'interval' : 'unknown'}`);
        }
        
        // Wait briefly before checking again
        await ClaudeClient.sleep(50);
      }
    }

    logger.info(LoggerServices.CLAUDE_CLIENT, `Complete all | active: ${ClaudeClient.activeRequests}, queue: ${ClaudeClient.requestQueue.length}, iterations: ${loopIterations}`);
    
    ClaudeClient.isProcessing = false;
    ClaudeClient.processingPromise = null;
  }

  /**
   * Process a single request with error handling and retry logic
   */
  private static async processRequest(queueItem: QueueItem): Promise<void> {
    const startTime = Date.now();
    const contextKey = ClaudeClient.getCategoryKey(queueItem.context);
    
    // Track active request by context
    const currentActive = ClaudeClient.activeRequestsByContext.get(contextKey) || 0;
    ClaudeClient.activeRequestsByContext.set(contextKey, currentActive + 1);

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
      
      logger.debug(LoggerServices.CLAUDE_CLIENT, `Complete | active: ${ClaudeClient.activeRequests}, queue: ${ClaudeClient.requestQueue.length}, label: ${queueItem.context}`);
      
      // Remove from active context tracking
      const currentActive = ClaudeClient.activeRequestsByContext.get(contextKey) || 0;
      if (currentActive <= 1) {
        ClaudeClient.activeRequestsByContext.delete(contextKey);
      } else {
        ClaudeClient.activeRequestsByContext.set(contextKey, currentActive - 1);
      }
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
      logger.warn(LoggerServices.CLAUDE_CLIENT, `Rate limit detected: ${errorMessage}`);

      // Circuit breaker: pause processing after 5 consecutive rate limit errors
      if (ClaudeClient.queueMetrics.consecutiveRateLimitErrors >= 5) {
        ClaudeClient.queueMetrics.circuitBreakerUntil = Date.now() + 30000; // 30 seconds
        logger.error(LoggerServices.CLAUDE_CLIENT, 'Circuit breaker activated for 30s');
      }

      // Retry with exponential backoff
      if (queueItem.retryCount < 3) {
        queueItem.retryCount++;
        const backoffDelay = Math.pow(2, queueItem.retryCount) * 1000; // 2s, 4s, 8s

        logger.warn(LoggerServices.CLAUDE_CLIENT, `Retrying in ${backoffDelay}ms (attempt ${queueItem.retryCount}/3)`);

        setTimeout(() => {
          ClaudeClient.requestQueue.unshift(queueItem); // Add back to front of queue
        }, backoffDelay);

        return;
      }
    }

    // Failed permanently
    ClaudeClient.queueMetrics.totalFailed++;
    logger.error(LoggerServices.CLAUDE_CLIENT, `Request failed permanently: ${errorMessage}`);
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
          logger.error(LoggerServices.CLAUDE_CLIENT, `Exit code: ${exitCode}`);
          logger.error(LoggerServices.CLAUDE_CLIENT, `Prompt size: ${prompt.length} chars, ${promptLines.length} lines`);
          logger.error(LoggerServices.CLAUDE_CLIENT, `Prompt preview: ${promptPreview}...`);
          logger.error(LoggerServices.CLAUDE_CLIENT, `Error output: ${errorOutput}`);

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
    ClaudeClient.activeRequestsByContext.clear();
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
      logger.info(LoggerServices.CLAUDE_CLIENT, `Max concurrency set to ${limit}`);
    } else {
      logger.warn(LoggerServices.CLAUDE_CLIENT, `Invalid concurrency limit: ${limit}`);
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

  /**
   * Log enhanced queue status with categorization
   */
  private static logEnhancedQueueStatus(): void {
    const queueStats = ClaudeClient.getQueueCategoryStats();
    const activeStats = ClaudeClient.getActiveCategoryStats();
    
    // Build waiting queue breakdown
    const waitingBreakdown = Object.entries(queueStats)
      .filter(([, count]) => count > 0)
      .map(([context, count]) => `${count}×${context}`)
      .join(', ');
    
    // Build active breakdown
    const activeBreakdown = Object.entries(activeStats)
      .filter(([, count]) => count > 0)
      .map(([context, count]) => `${count}×${context}`)
      .join(', ');
    
    const waitingDesc = waitingBreakdown || '0';
    const activeDesc = activeBreakdown || '0';
    
    logger.info(LoggerServices.CLAUDE_CLIENT, `Queue: ${ClaudeClient.requestQueue.length} waiting (${waitingDesc}), ${ClaudeClient.activeRequests} active (${activeDesc}), ${ClaudeClient.queueMetrics.totalProcessed} completed`);
  }

  /**
   * Get category statistics for waiting queue items
   */
  private static getQueueCategoryStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    
    for (const item of ClaudeClient.requestQueue) {
      const key = ClaudeClient.getCategoryKey(item.context);
      stats[key] = (stats[key] || 0) + 1;
    }
    
    return stats;
  }

  /**
   * Get category statistics for active requests
   */
  private static getActiveCategoryStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    
    for (const [context, count] of ClaudeClient.activeRequestsByContext) {
      stats[context] = count;
    }
    
    return stats;
  }

  /**
   * Simplify context names for display
   */
  private static getCategoryKey(context: string): string {
    // Simplify common context names for readability
    const contextMap: Record<string, string> = {
      'similarity-analysis': 'similarity',
      'batch-similarity': 'batch-sim',
      'domain-classification': 'domain', 
      'multi-domain-analysis': 'multi-domain',
      'theme-expansion': 'expansion',
      'theme-analysis': 'theme',
      'code-analysis': 'code',
      'hierarchical-analysis': 'hierarchy'
    };
    
    return contextMap[context] || context;
  }
}
