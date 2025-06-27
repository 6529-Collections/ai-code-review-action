/**
 * Concurrency management utility for processing items with controlled parallelism,
 * retry logic, and progress tracking with dynamic resource-based optimization.
 */

import * as os from 'os';

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

export type ConcurrencyOutcome<T, R> =
  | ConcurrencyResult<T, R>
  | ConcurrencyError<T>;

const DEFAULT_OPTIONS = {
  concurrencyLimit: 0, // Will be calculated dynamically
  dynamicConcurrency: true,
  maxRetries: 3,
  retryDelay: 1000,
  retryBackoffMultiplier: 2,
  enableJitter: true,
  context: 'general' as const,
  enableLogging: false,
};

export class ConcurrencyManager {
  /**
   * Get current system metrics for dynamic concurrency calculation
   */
  static getSystemMetrics(): SystemMetrics {
    const memUsage = process.memoryUsage();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const heapUsedMB = memUsage.heapUsed / (1024 * 1024);
    const memoryUsagePercent = (totalMemory - freeMemory) / totalMemory;

    return {
      cpuCount: os.cpus().length,
      availableMemory: freeMemory,
      currentHeapUsed: memUsage.heapUsed,
      isUnderMemoryPressure: memoryUsagePercent > 0.85 || heapUsedMB > 512,
    };
  }

  /**
   * Calculate optimal concurrency limit based on system resources
   */
  static calculateOptimalConcurrency(
    metrics: SystemMetrics,
    context: string = 'general'
  ): number {
    // Base concurrency from CPU count
    let baseConcurrency = Math.max(3, Math.ceil(metrics.cpuCount * 0.8));

    // Adjust for memory pressure
    if (metrics.isUnderMemoryPressure) {
      baseConcurrency = Math.max(2, Math.floor(baseConcurrency * 0.6));
    }

    // Context-specific adjustments
    switch (context) {
      case 'theme_processing':
        // Theme processing is memory intensive
        baseConcurrency = Math.min(baseConcurrency, 8);
        break;
      case 'ai_batch':
        // AI batch processing has API limits
        baseConcurrency = Math.min(baseConcurrency, 10);
        break;
      default:
        baseConcurrency = Math.min(baseConcurrency, 12);
    }

    return Math.max(2, baseConcurrency); // Minimum of 2
  }

  /**
   * Get context-aware retry configuration
   */
  static getRetryConfig(
    context: string,
    error?: Error
  ): {
    maxRetries: number;
    baseDelay: number;
    multiplier: number;
  } {
    const isRateLimit =
      error?.message?.includes('rate limit') || error?.message?.includes('429');

    switch (context) {
      case 'theme_processing':
        return {
          maxRetries: isRateLimit ? 5 : 3,
          baseDelay: isRateLimit ? 2000 : 1000,
          multiplier: 1.8,
        };
      case 'ai_batch':
        return {
          maxRetries: isRateLimit ? 6 : 2,
          baseDelay: isRateLimit ? 3000 : 800,
          multiplier: 2.2,
        };
      default:
        return {
          maxRetries: isRateLimit ? 4 : 3,
          baseDelay: 1000,
          multiplier: 2.0,
        };
    }
  }
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
  static async processConcurrentlyWithLimit<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    options?: ConcurrencyOptions<T>
  ): Promise<Array<R | { error: Error; item: T }>> {
    const config = { ...DEFAULT_OPTIONS, ...options };

    // Calculate dynamic concurrency if enabled and not explicitly set
    if (config.dynamicConcurrency && config.concurrencyLimit === 0) {
      const metrics = ConcurrencyManager.getSystemMetrics();
      config.concurrencyLimit = ConcurrencyManager.calculateOptimalConcurrency(
        metrics,
        config.context || 'general'
      );

      if (config.enableLogging) {
        console.log(
          `[CONCURRENCY-MANAGER] Dynamic concurrency: ${config.concurrencyLimit} (CPUs: ${metrics.cpuCount}, Memory pressure: ${metrics.isUnderMemoryPressure})`
        );
      }
    } else if (config.concurrencyLimit <= 0) {
      // Fallback to safe default
      config.concurrencyLimit = 5;
    }
    const results: Array<R | { error: Error; item: T }> = new Array(
      items.length
    );
    const active = new Set<Promise<void>>();
    let completed = 0;
    let index = 0;

    const log = (message: string): void => {
      if (config.enableLogging) {
        console.log(`[CONCURRENCY-MANAGER] ${message}`);
      }
    };

    const processItem = async (item: T, itemIndex: number): Promise<void> => {
      log(`Processing item ${itemIndex + 1}/${items.length}: starting`);

      try {
        const result = await ConcurrencyManager.processWithRetry(
          item,
          processor,
          config.maxRetries,
          config.retryDelay,
          config.retryBackoffMultiplier,
          config.onError,
          config.enableJitter,
          config.context
        );

        log(`Processing item ${itemIndex + 1}/${items.length}: success`);
        results[itemIndex] = result;
      } catch (error) {
        log(
          `Processing item ${itemIndex + 1}/${items.length}: error - ${error}`
        );
        results[itemIndex] = { error: error as Error, item };
      } finally {
        completed++;
        log(
          `Processing item ${itemIndex + 1}/${items.length}: completed (${completed}/${items.length})`
        );

        if (config.onProgress) {
          config.onProgress(completed, items.length);
        }
      }
    };

    return new Promise((resolve) => {
      // Handle empty array case
      if (items.length === 0) {
        log('Empty items array, resolving immediately');
        resolve(results);
        return;
      }

      log(
        `Starting processing of ${items.length} items with limit ${config.concurrencyLimit}`
      );

      const startNext = (): void => {
        // Start new items while under concurrency limit and items remain
        while (active.size < config.concurrencyLimit && index < items.length) {
          const currentIndex = index++;
          log(
            `Starting item ${currentIndex + 1}/${items.length}, active: ${active.size}`
          );

          const promise = processItem(items[currentIndex], currentIndex);
          active.add(promise);

          promise.finally(() => {
            active.delete(promise);
            log(
              `Completed item, total completed: ${completed}/${items.length}, active: ${active.size}`
            );

            if (completed === items.length) {
              log('All items completed, resolving');
              resolve(results);
            } else {
              startNext(); // Try to start next item immediately
            }
          });
        }

        // Log waiting status if all items started but some still processing
        if (index >= items.length && active.size > 0) {
          log(
            `No more items to start, waiting for ${active.size} active promises`
          );
        }
      };

      startNext();
    });
  }

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
  static async processWithRetry<T, R>(
    item: T,
    processor: (item: T) => Promise<R>,
    maxRetries: number = 3,
    baseDelay: number = 1000,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _backoffMultiplier: number = 2, // Legacy parameter, now unused
    onError?: (error: Error, item: T, retryCount: number) => void,
    enableJitter: boolean = true,
    context: string = 'general'
  ): Promise<R> {
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await processor(item);
      } catch (error) {
        lastError = error as Error;

        if (attempt < maxRetries) {
          // Get context-aware retry config
          const retryConfig = ConcurrencyManager.getRetryConfig(
            context,
            lastError
          );

          // Use context-specific settings or fall back to provided values
          const effectiveMaxRetries = Math.max(
            maxRetries,
            retryConfig.maxRetries
          );
          const effectiveBaseDelay = Math.max(baseDelay, retryConfig.baseDelay);
          const effectiveMultiplier = retryConfig.multiplier;

          if (attempt < effectiveMaxRetries) {
            const delay = ConcurrencyManager.calculateBackoffDelay(
              attempt,
              effectiveBaseDelay,
              effectiveMultiplier,
              enableJitter
            );

            if (onError) {
              onError(lastError, item, attempt + 1);
            }

            console.log(
              `[CONCURRENCY-MANAGER] Retry ${attempt + 1}/${effectiveMaxRetries} after ${delay}ms delay (context: ${context})`
            );
            await ConcurrencyManager.sleep(delay);
          } else {
            break; // Exceeded max retries for this context
          }
        }
      }
    }

    throw lastError!;
  }

  /**
   * Calculate exponential backoff delay with jitter and maximum cap.
   *
   * @param attempt Current attempt number (0-based)
   * @param baseDelay Base delay in milliseconds
   * @param multiplier Backoff multiplier
   * @returns Delay in milliseconds
   */
  static calculateBackoffDelay(
    attempt: number,
    baseDelay: number,
    multiplier: number = 2,
    enableJitter: boolean = true
  ): number {
    const exponentialDelay = baseDelay * Math.pow(multiplier, attempt);

    let finalDelay = exponentialDelay;
    if (enableJitter) {
      // Add jitter: 10% random variation
      const jitterRange = exponentialDelay * 0.1;
      const jitter = (Math.random() - 0.5) * 2 * jitterRange;
      finalDelay = exponentialDelay + jitter;
    }

    // Cap at 30 seconds maximum, minimum 100ms
    return Math.max(100, Math.min(finalDelay, 30000));
  }

  /**
   * Sleep utility function.
   *
   * @param ms Milliseconds to sleep
   * @returns Promise that resolves after the specified time
   */
  static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Helper to separate successful results from errors.
   *
   * @param results Mixed array of results and errors
   * @returns Object with separate successful and failed arrays
   */
  static separateResults<T, R>(
    results: Array<R | { error: Error; item: T }>
  ): {
    successful: R[];
    failed: Array<{ error: Error; item: T }>;
  } {
    const successful: R[] = [];
    const failed: Array<{ error: Error; item: T }> = [];

    for (const result of results) {
      if (result && typeof result === 'object' && 'error' in result) {
        failed.push(result);
      } else {
        successful.push(result as R);
      }
    }

    return { successful, failed };
  }
}
