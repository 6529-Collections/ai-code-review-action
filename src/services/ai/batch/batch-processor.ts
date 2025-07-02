import { PromptType, PromptResponse } from '../prompt-types';
import { UnifiedPromptService } from '../unified-prompt-service';
import {
  BatchStrategy,
  BatchStrategyFactory,
  BatchFormationStrategies,
} from './batch-strategies';
import { AdaptiveBatchingController, SystemMetrics } from './adaptive-batching';
import { SecureFileNamer } from '../../../utils/secure-file-namer';
import { JsonExtractor } from '../../../utils/json-extractor';
import { logger } from '../../../utils/logger';
import { ConsolidatedTheme } from '../../../types/similarity-types';
import {
  UnifiedBatchResponse,
  SimilarityResult,
  BatchProcessingOptions,
  isSimilarityResult,
  isUnifiedBatchResponse,
} from '../../../types/batch-types';

interface QueueItem<T> {
  id: string;
  promptType: PromptType;
  variables: Record<string, any>;
  resolve: (value: PromptResponse<T>) => void;
  reject: (error: any) => void;
  timestamp: number;
  priority: number;
}

interface Batch<T> {
  id: string;
  promptType: PromptType;
  items: QueueItem<T>[];
  createdAt: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

/**
 * Advanced batch processor with priority queuing and adaptive sizing
 */
export class BatchProcessor {
  private static instance: BatchProcessor;
  private unifiedService: UnifiedPromptService;
  private adaptiveController: AdaptiveBatchingController;

  // Queues for each prompt type
  private queues: Map<PromptType, QueueItem<any>[]> = new Map();
  private processing: Map<PromptType, boolean> = new Map();
  private batchHistory: Batch<any>[] = [];

  // Circuit breaker
  private circuitBreaker: Map<
    PromptType,
    {
      failures: number;
      lastFailure: number;
      isOpen: boolean;
    }
  > = new Map();

  private constructor(anthropicApiKey: string) {
    this.unifiedService = UnifiedPromptService.getInstance(anthropicApiKey);
    this.adaptiveController = new AdaptiveBatchingController();
    this.initializeQueues();
    this.startProcessingLoop();
  }

  static getInstance(anthropicApiKey: string): BatchProcessor {
    if (!BatchProcessor.instance) {
      BatchProcessor.instance = new BatchProcessor(anthropicApiKey);
    }
    return BatchProcessor.instance;
  }

  /**
   * Add item to batch queue
   */
  async add<T>(
    promptType: PromptType,
    variables: Record<string, any>,
    priority: number = 0
  ): Promise<PromptResponse<T>> {
    // Check circuit breaker
    const breaker = this.circuitBreaker.get(promptType);
    if (breaker?.isOpen) {
      const timeSinceFailure = Date.now() - breaker.lastFailure;
      if (timeSinceFailure < 30000) {
        // 30 second cooldown
        throw new Error(`Circuit breaker open for ${promptType}`);
      } else {
        // Reset circuit breaker
        breaker.isOpen = false;
        breaker.failures = 0;
      }
    }

    // Check if this prompt type supports batching
    if (!BatchStrategyFactory.canBatch(promptType)) {
      // Process immediately if not batchable
      return this.unifiedService.execute<T>(promptType, variables);
    }

    return new Promise((resolve, reject) => {
      const item: QueueItem<T> = {
        id: SecureFileNamer.generateBatchId('queue', promptType),
        promptType,
        variables,
        resolve,
        reject,
        timestamp: Date.now(),
        priority,
      };

      this.enqueue(item);
    });
  }

  /**
   * Add multiple items as a group
   */
  async addBatch<T>(
    promptType: PromptType,
    items: Array<{ variables: Record<string, any>; priority?: number }>
  ): Promise<PromptResponse<T>[]> {
    const promises = items.map((item) =>
      this.add<T>(promptType, item.variables, item.priority || 0)
    );
    return Promise.all(promises);
  }

  /**
   * Enqueue item with proper ordering
   */
  private enqueue<T>(item: QueueItem<T>): void {
    let queue = this.queues.get(item.promptType);
    if (!queue) {
      queue = [];
      this.queues.set(item.promptType, queue);
    }

    // Insert based on priority (higher priority first)
    const insertIndex = queue.findIndex((q) => q.priority < item.priority);
    if (insertIndex === -1) {
      queue.push(item);
    } else {
      queue.splice(insertIndex, 0, item);
    }

    // Trigger processing
    this.processQueue(item.promptType);
  }

  /**
   * Initialize queues and circuit breakers
   */
  private initializeQueues(): void {
    for (const type of BatchStrategyFactory.getAllBatchableTypes()) {
      this.queues.set(type, []);
      this.processing.set(type, false);
      this.circuitBreaker.set(type, {
        failures: 0,
        lastFailure: 0,
        isOpen: false,
      });
    }
  }

  /**
   * Start background processing loop
   */
  private startProcessingLoop(): void {
    setInterval(() => {
      for (const [promptType] of this.queues) {
        this.processQueue(promptType);
      }
    }, 100); // Check every 100ms
  }

  /**
   * Process queue for a specific prompt type
   */
  private async processQueue(promptType: PromptType): Promise<void> {
    // Skip if already processing
    if (this.processing.get(promptType)) return;

    const queue = this.queues.get(promptType);
    if (!queue || queue.length === 0) return;

    const strategy = BatchStrategyFactory.getStrategy(promptType);
    if (!strategy) return;

    // Check if we should flush the batch
    const oldestItem = queue[0];
    const age = Date.now() - oldestItem.timestamp;

    if (!strategy.shouldFlush(queue.length, age)) {
      return; // Wait for more items or timeout
    }

    // Get optimal batch size
    const systemMetrics = this.getSystemMetrics();
    const batchSize = this.adaptiveController.getOptimalBatchSize(
      promptType,
      systemMetrics
    );

    // Extract batch
    const batch = this.extractBatch(
      promptType,
      Math.min(batchSize, queue.length)
    );
    if (batch.length === 0) return;

    // Mark as processing
    this.processing.set(promptType, true);

    try {
      await this.processBatch(promptType, batch);
    } finally {
      this.processing.set(promptType, false);
    }
  }

  /**
   * Extract items for batch processing
   */
  private extractBatch<T>(
    promptType: PromptType,
    size: number
  ): QueueItem<T>[] {
    const queue = this.queues.get(promptType);
    if (!queue) return [];

    const strategy = BatchStrategyFactory.getStrategy(promptType);
    if (!strategy) return [];

    // Apply formation strategy if available
    const formationStrategy = BatchFormationStrategies.getStrategy(promptType);
    if (formationStrategy?.groupBy) {
      return this.extractBatchWithGrouping(queue, size, formationStrategy);
    }

    // Simple extraction
    return queue.splice(0, size);
  }

  /**
   * Extract batch with grouping strategy
   */
  private extractBatchWithGrouping<T>(
    queue: QueueItem<T>[],
    size: number,
    strategy: any
  ): QueueItem<T>[] {
    const groups = new Map<string, QueueItem<T>[]>();

    // Group items
    for (const item of queue) {
      const key = strategy.groupBy(item.variables);
      const group = groups.get(key) || [];
      group.push(item);
      groups.set(key, group);
    }

    // Find best group to process
    let bestGroup: QueueItem<T>[] = [];
    for (const group of groups.values()) {
      if (group.length >= size || group.length > bestGroup.length) {
        bestGroup = group;
      }
    }

    // Remove selected items from queue
    const batch = bestGroup.slice(0, size);
    for (const item of batch) {
      const index = queue.indexOf(item);
      if (index > -1) {
        queue.splice(index, 1);
      }
    }

    return batch;
  }

  /**
   * Process a batch of items
   */
  private async processBatch<T>(
    promptType: PromptType,
    items: QueueItem<T>[]
  ): Promise<void> {
    const batchId = SecureFileNamer.generateBatchId('batch', promptType);
    const batch: Batch<T> = {
      id: batchId,
      promptType,
      items,
      createdAt: Date.now(),
      status: 'processing',
    };

    this.batchHistory.push(batch);

    try {
      const startTime = Date.now();

      // Process based on prompt type
      const results = await this.executeBatch(promptType, items);

      const latency = Date.now() - startTime;
      const success = results.every((r) => r.success);

      // Update adaptive controller
      this.adaptiveController.updateMetrics(
        promptType,
        items.length,
        success,
        latency
      );

      // Resolve promises
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const result = results[i];

        if (result.success) {
          item.resolve(result);
        } else {
          item.reject(new Error(result.error || 'Batch processing failed'));
        }
      }

      batch.status = 'completed';

      // Reset circuit breaker on success
      const breaker = this.circuitBreaker.get(promptType);
      if (breaker) {
        breaker.failures = 0;
      }
    } catch (error) {
      batch.status = 'failed';

      // Update circuit breaker
      const breaker = this.circuitBreaker.get(promptType);
      if (breaker) {
        breaker.failures++;
        breaker.lastFailure = Date.now();
        if (breaker.failures >= 3) {
          breaker.isOpen = true;
          console.error(`[BATCH] Circuit breaker opened for ${promptType}`);
        }
      }

      // Reject all promises
      for (const item of items) {
        item.reject(error);
      }
    }
  }

  /**
   * Execute batch based on prompt type
   */
  private async executeBatch<T>(
    promptType: PromptType,
    items: QueueItem<T>[]
  ): Promise<PromptResponse<T>[]> {
    switch (promptType) {
      case PromptType.BATCH_SIMILARITY:
        return this.executeSimilarityBatch(items);

      case PromptType.THEME_EXPANSION:
        return this.executeExpansionBatch(items);

      case PromptType.DOMAIN_EXTRACTION:
        return this.executeDomainBatch(items);

      default:
        // Fallback to sequential processing
        return Promise.all(
          items.map((item) =>
            this.unifiedService.execute<T>(promptType, item.variables)
          )
        );
    }
  }

  /**
   * Execute similarity checks in batch
   */
  private async executeSimilarityBatch<T>(
    items: QueueItem<T>[]
  ): Promise<PromptResponse<T>[]> {
    // Format pairs for batch processing
    const pairs = items.map((item, index) => ({
      id: index.toString(),
      theme1: item.variables.theme1,
      theme2: item.variables.theme2,
    }));

    const batchResponse = await this.unifiedService.execute<any>(
      PromptType.BATCH_SIMILARITY,
      { pairs: JSON.stringify(pairs) }
    );

    if (!batchResponse.success || !batchResponse.data?.results) {
      throw new Error('Batch similarity check failed');
    }

    // Map results back to individual responses
    return items.map((item, index) => {
      const result = batchResponse.data.results.find(
        (r: any) => r.pairId === index.toString()
      );

      if (!result) {
        return {
          success: false,
          error: 'Result not found in batch response',
        };
      }

      return {
        success: true,
        data: {
          shouldMerge: result.shouldMerge,
          confidence: result.confidence,
          reasoning: 'Batch processed',
          ...result.scores,
        } as T,
        cached: false,
      };
    });
  }

  /**
   * Execute theme expansions in batch
   */
  private async executeExpansionBatch<T>(
    items: QueueItem<T>[]
  ): Promise<PromptResponse<T>[]> {
    // For theme expansion, we'll process in smaller groups
    const results: PromptResponse<T>[] = [];
    const groupSize = 3;

    for (let i = 0; i < items.length; i += groupSize) {
      const group = items.slice(i, i + groupSize);
      const groupResults = await Promise.all(
        group.map((item) =>
          this.unifiedService.execute<T>(
            PromptType.THEME_EXPANSION,
            item.variables
          )
        )
      );
      results.push(...groupResults);
    }

    return results;
  }

  /**
   * Execute domain extractions in batch
   */
  private async executeDomainBatch<T>(
    items: QueueItem<T>[]
  ): Promise<PromptResponse<T>[]> {
    // Combine all themes for batch domain extraction
    const allThemes: any[] = [];
    const itemThemeMap = new Map<number, number[]>();

    let themeIndex = 0;
    items.forEach((item, itemIndex) => {
      const themes = item.variables.themes || [];
      const indices: number[] = [];

      themes.forEach((theme: any) => {
        allThemes.push(theme);
        indices.push(themeIndex++);
      });

      itemThemeMap.set(itemIndex, indices);
    });

    // Execute batch domain extraction
    const batchResponse = await this.unifiedService.execute<any>(
      PromptType.DOMAIN_EXTRACTION,
      {
        themes: JSON.stringify(allThemes),
        availableDomains: items[0].variables.availableDomains,
      }
    );

    if (!batchResponse.success || !batchResponse.data?.domains) {
      throw new Error('Batch domain extraction failed');
    }

    // Map results back to individual items
    return items.map((item, index) => {
      const themeIndices = itemThemeMap.get(index) || [];
      const relevantDomains = batchResponse.data.domains.filter((domain: any) =>
        domain.themes.some((t: any) =>
          themeIndices.includes(allThemes.findIndex((at) => at.name === t))
        )
      );

      return {
        success: true,
        data: { domains: relevantDomains } as T,
        cached: false,
      };
    });
  }

  /**
   * Get current system metrics
   */
  private getSystemMetrics(): SystemMetrics {
    // Simplified metrics - in production, get real system stats
    const now = new Date();
    return {
      cpuUsage: 50, // Mock value
      memoryUsage: 60, // Mock value
      apiResponseTime: 1000, // Mock value
      queueDepth: this.getTotalQueueDepth(),
      timeOfDay: now.getHours(),
    };
  }

  /**
   * Get total queue depth across all types
   */
  private getTotalQueueDepth(): number {
    let total = 0;
    for (const queue of this.queues.values()) {
      total += queue.length;
    }
    return total;
  }

  /**
   * Get queue statistics
   */
  getQueueStats(): Record<string, any> {
    const stats: Record<string, any> = {
      totalQueued: this.getTotalQueueDepth(),
      queues: {},
      processing: {},
      circuitBreakers: {},
      adaptiveConfig: this.adaptiveController.getPerformanceReport(),
    };

    for (const [type, queue] of this.queues.entries()) {
      stats.queues[type] = {
        depth: queue.length,
        oldestItem: queue[0]?.timestamp
          ? new Date(queue[0].timestamp).toISOString()
          : null,
      };
      stats.processing[type] = this.processing.get(type) || false;

      const breaker = this.circuitBreaker.get(type);
      if (breaker) {
        stats.circuitBreakers[type] = {
          isOpen: breaker.isOpen,
          failures: breaker.failures,
          lastFailure: breaker.lastFailure
            ? new Date(breaker.lastFailure).toISOString()
            : null,
        };
      }
    }

    return stats;
  }

  /**
   * Flush all queues (for shutdown)
   */
  async flush(): Promise<void> {
    const promises: Promise<any>[] = [];

    for (const [promptType, queue] of this.queues.entries()) {
      if (queue.length > 0) {
        // Process remaining items
        const batch = [...queue];
        queue.length = 0;
        promises.push(this.processBatch(promptType, batch));
      }
    }

    await Promise.all(promises);
  }

  /**
   * Get batch history
   */
  getBatchHistory(limit: number = 10): Batch<any>[] {
    return this.batchHistory.slice(-limit);
  }

  /**
   * Process similarity batch using unified format
   */
  async processSimilarityBatch(
    pairs: Array<{ theme1: ConsolidatedTheme; theme2: ConsolidatedTheme }>,
    options?: BatchProcessingOptions
  ): Promise<UnifiedBatchResponse<SimilarityResult>> {
    const startTime = Date.now();
    const batchContext = logger.startOperation('Batch Similarity Processing', {
      pairCount: pairs.length,
      maxBatchSize: options?.maxBatchSize || 8,
    });

    try {
      // Create formatted pairs for template
      const formattedPairs = this.buildUnifiedSimilarityPrompt(pairs);
      
      logger.logProcess(`Executing batch similarity for ${pairs.length} pairs`, {
        formattedPairsLength: formattedPairs.length,
        estimatedTokens: this.estimateTokens(formattedPairs),
      });
      
      // Execute via unified service with proper template variables
      const response = await this.unifiedService.execute<any>(
        PromptType.BATCH_SIMILARITY,
        { 
          pairs: formattedPairs,
          pairCount: pairs.length
        }
      );

      logger.logProcess('Received response from UnifiedPromptService', {
        responseSuccess: response.success,
        responseError: response.error,
        responseDataExists: !!response.data,
        responseLength: response.data?.response?.length || 0,
        responseStart: response.data?.response?.substring(0, 100) || '',
      });

      if (!response.success) {
        throw new Error(`Batch processing failed: ${response.error}`);
      }

      const rawResponse = response.data?.response || '';
      if (!rawResponse || rawResponse.length === 0) {
        throw new Error(`Empty response received from UnifiedPromptService. Response data: ${JSON.stringify(response.data)}`);
      }

      // Parse and validate response
      const batchResult = this.parseUnifiedSimilarityResponse(
        rawResponse,
        pairs.length
      );

      const processingTime = Date.now() - startTime;
      
      logger.endOperation(batchContext, true, {
        processedCount: batchResult.results.length,
        failedCount: batchResult.metadata.failedCount,
        processingTime,
      });

      return {
        ...batchResult,
        metadata: {
          ...batchResult.metadata,
          processingTimeMs: processingTime,
        },
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      logger.logError('Batch similarity processing failed', error as Error, {
        pairCount: pairs.length,
        processingTime,
        batchSize: options?.maxBatchSize,
      });
      
      logger.endOperation(batchContext, false);
      throw error;
    }
  }

  /**
   * Build unified similarity prompt
   */
  private buildUnifiedSimilarityPrompt(
    pairs: Array<{ theme1: ConsolidatedTheme; theme2: ConsolidatedTheme }>
  ): string {
    const formattedPairs = pairs.map((pair, index) => {
      const pairId = `pair-${index}`;
      return `
**${pairId}:**
Theme 1: "${pair.theme1.name}"
- Description: ${pair.theme1.description}
- Files: ${pair.theme1.affectedFiles.join(', ')}
- Code: ${pair.theme1.codeSnippets.slice(0, 2).join('\n').substring(0, 200)}...

Theme 2: "${pair.theme2.name}"
- Description: ${pair.theme2.description}
- Files: ${pair.theme2.affectedFiles.join(', ')}
- Code: ${pair.theme2.codeSnippets.slice(0, 2).join('\n').substring(0, 200)}...
`;
    });

    return formattedPairs.join('\n');
  }

  /**
   * Parse unified similarity response
   */
  private parseUnifiedSimilarityResponse(
    response: string,
    expectedCount: number
  ): UnifiedBatchResponse<SimilarityResult> {
    try {
      // Extract JSON using robust JsonExtractor
      const extractionResult = JsonExtractor.extractAndValidateJson(
        response,
        'object',
        ['success', 'results'] // Required fields
      );

      if (!extractionResult.success) {
        throw new Error(`JSON extraction failed: ${extractionResult.error}`);
      }

      // Validate response structure
      const data = extractionResult.data as unknown;
      if (!isUnifiedBatchResponse(data, isSimilarityResult)) {
        throw new Error('Response structure validation failed');
      }

      const validatedResponse = data as UnifiedBatchResponse<SimilarityResult>;

      // Verify we got results for all pairs
      if (validatedResponse.results.length !== expectedCount) {
        logger.logError('Batch response count mismatch', 
          `Expected ${expectedCount} results, got ${validatedResponse.results.length}`, {
          expectedCount,
          actualCount: validatedResponse.results.length,
          response: response.substring(0, 500),
        });
      }

      return validatedResponse;
    } catch (error) {
      logger.logError('Failed to parse batch similarity response', error as Error, {
        responseLength: response.length,
        responseStart: response.substring(0, 200),
        expectedCount,
      });
      
      // Create fallback response
      return {
        success: false,
        results: [],
        metadata: {
          processedCount: 0,
          failedCount: expectedCount,
          processingTimeMs: 0,
        },
      };
    }
  }

  /**
   * Estimate token count for a prompt (simplified)
   */
  private estimateTokens(text: string): number {
    // Rough estimate: 4 characters per token
    return Math.ceil(text.length / 4);
  }
}
