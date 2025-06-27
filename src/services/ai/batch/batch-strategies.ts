import { PromptType } from '../prompt-types';

/**
 * Batch processing strategies for different prompt types
 */
export interface BatchStrategy {
  promptType: PromptType;
  optimalBatchSize: number;
  maxBatchSize: number;
  minBatchSize: number;
  batchTimeout: number; // milliseconds to wait for batch to fill
  priorityWeight: number; // Higher number = higher priority
  canBatch: (item: any) => boolean;
  shouldFlush: (batchSize: number, oldestItemAge: number) => boolean;
}

export class BatchStrategyFactory {
  private static strategies: Map<PromptType, BatchStrategy> = new Map([
    [
      PromptType.SIMILARITY_CHECK,
      {
        promptType: PromptType.SIMILARITY_CHECK,
        optimalBatchSize: 10,
        maxBatchSize: 15,
        minBatchSize: 3,
        batchTimeout: 500,
        priorityWeight: 0.8,
        canBatch: () => true,
        shouldFlush: (size, age) => size >= 10 || age > 500,
      },
    ],

    [
      PromptType.THEME_EXPANSION,
      {
        promptType: PromptType.THEME_EXPANSION,
        optimalBatchSize: 5,
        maxBatchSize: 8,
        minBatchSize: 2,
        batchTimeout: 1000,
        priorityWeight: 0.6,
        canBatch: (theme) => theme.affectedFiles?.length < 50,
        shouldFlush: (size, age) => size >= 5 || age > 1000,
      },
    ],

    [
      PromptType.DOMAIN_EXTRACTION,
      {
        promptType: PromptType.DOMAIN_EXTRACTION,
        optimalBatchSize: 20,
        maxBatchSize: 30,
        minBatchSize: 5,
        batchTimeout: 2000,
        priorityWeight: 0.4,
        canBatch: () => true,
        shouldFlush: (size, age) => size >= 15 || age > 2000,
      },
    ],

    [
      PromptType.CROSS_LEVEL_SIMILARITY,
      {
        promptType: PromptType.CROSS_LEVEL_SIMILARITY,
        optimalBatchSize: 8,
        maxBatchSize: 12,
        minBatchSize: 3,
        batchTimeout: 800,
        priorityWeight: 0.7,
        canBatch: () => true,
        shouldFlush: (size, age) => size >= 8 || age > 800,
      },
    ],

    [
      PromptType.CODE_ANALYSIS,
      {
        promptType: PromptType.CODE_ANALYSIS,
        optimalBatchSize: 3,
        maxBatchSize: 5,
        minBatchSize: 1,
        batchTimeout: 300,
        priorityWeight: 0.9,
        canBatch: (file) => file.diffContent?.length < 5000,
        shouldFlush: (size, age) => size >= 3 || age > 300,
      },
    ],
  ]);

  static getStrategy(promptType: PromptType): BatchStrategy | null {
    return this.strategies.get(promptType) || null;
  }

  static canBatch(promptType: PromptType): boolean {
    const strategy = this.strategies.get(promptType);
    return strategy !== null && strategy !== undefined;
  }

  static getAllBatchableTypes(): PromptType[] {
    return Array.from(this.strategies.keys());
  }

  /**
   * Dynamically adjust batch size based on performance
   */
  static adjustBatchSize(
    promptType: PromptType,
    currentSize: number,
    successRate: number,
    avgLatency: number
  ): number {
    const strategy = this.strategies.get(promptType);
    if (!strategy) return currentSize;

    // Increase batch size if performance is good
    if (successRate > 0.95 && avgLatency < 2000) {
      return Math.min(currentSize + 1, strategy.maxBatchSize);
    }

    // Decrease batch size if performance is poor
    if (successRate < 0.8 || avgLatency > 5000) {
      return Math.max(currentSize - 1, strategy.minBatchSize);
    }

    return currentSize;
  }
}

/**
 * Batch formation strategies
 */
export interface BatchFormationStrategy {
  groupBy?: (item: any) => string;
  sortBy?: (item: any) => number;
  filter?: (item: any) => boolean;
}

export class BatchFormationStrategies {
  static readonly SIMILARITY_GROUPING: BatchFormationStrategy = {
    groupBy: (pair) => {
      // Group similar theme pairs by their domains
      const domains = [pair.theme1.domain, pair.theme2.domain].sort();
      return domains.join('-');
    },
    sortBy: (pair) => pair.priority || 0,
  };

  static readonly FILE_SIZE_GROUPING: BatchFormationStrategy = {
    groupBy: (file) => {
      // Group by file size categories
      const size = file.diffContent?.length || 0;
      if (size < 1000) return 'small';
      if (size < 5000) return 'medium';
      return 'large';
    },
    sortBy: (file) => file.diffContent?.length || 0,
  };

  static readonly THEME_COMPLEXITY_GROUPING: BatchFormationStrategy = {
    groupBy: (theme) => {
      // Group by complexity
      const fileCount = theme.affectedFiles?.length || 0;
      if (fileCount < 5) return 'simple';
      if (fileCount < 20) return 'moderate';
      return 'complex';
    },
    sortBy: (theme) => theme.affectedFiles?.length || 0,
  };

  static getStrategy(promptType: PromptType): BatchFormationStrategy | null {
    const strategies: Record<PromptType, BatchFormationStrategy> = {
      [PromptType.SIMILARITY_CHECK]: this.SIMILARITY_GROUPING,
      [PromptType.CODE_ANALYSIS]: this.FILE_SIZE_GROUPING,
      [PromptType.THEME_EXPANSION]: this.THEME_COMPLEXITY_GROUPING,
      [PromptType.DOMAIN_EXTRACTION]: {},
      [PromptType.CROSS_LEVEL_SIMILARITY]: {},
      [PromptType.THEME_EXTRACTION]: {},
      [PromptType.THEME_NAMING]: {},
      [PromptType.BATCH_SIMILARITY]: {},
    };

    return strategies[promptType] || null;
  }
}
