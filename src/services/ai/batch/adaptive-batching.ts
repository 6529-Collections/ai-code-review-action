import { PromptType } from '../prompt-types';

/**
 * Adaptive batching configuration based on system performance
 */
export interface AdaptiveConfig {
  currentBatchSize: number;
  successRate: number;
  avgLatency: number;
  errorRate: number;
  throughput: number;
  lastAdjustment: Date;
}

export interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: number;
  apiResponseTime: number;
  queueDepth: number;
  timeOfDay: number; // 0-23
}

/**
 * Adaptive batching controller that adjusts batch sizes based on performance
 */
export class AdaptiveBatchingController {
  private configs: Map<PromptType, AdaptiveConfig> = new Map();
  private performanceWindow: number = 5 * 60 * 1000; // 5 minutes
  private adjustmentCooldown: number = 60 * 1000; // 1 minute

  constructor() {
    this.initializeConfigs();
  }

  /**
   * Initialize adaptive configs for all batchable prompt types
   */
  private initializeConfigs(): void {
    const batchableTypes: PromptType[] = [
      PromptType.SIMILARITY_CHECK,
      PromptType.THEME_EXPANSION,
      PromptType.DOMAIN_EXTRACTION,
      PromptType.CROSS_LEVEL_SIMILARITY,
      PromptType.CODE_ANALYSIS,
    ];

    for (const type of batchableTypes) {
      this.configs.set(type, {
        currentBatchSize: 5, // Start conservative
        successRate: 1.0,
        avgLatency: 0,
        errorRate: 0,
        throughput: 0,
        lastAdjustment: new Date(),
      });
    }
  }

  /**
   * Get optimal batch size for a prompt type
   */
  getOptimalBatchSize(
    promptType: PromptType,
    systemMetrics?: SystemMetrics
  ): number {
    const config = this.configs.get(promptType);
    if (!config) return 5; // Default

    // Consider system metrics if available
    if (systemMetrics) {
      return this.adjustForSystemLoad(config.currentBatchSize, systemMetrics);
    }

    return config.currentBatchSize;
  }

  /**
   * Update performance metrics and adjust batch size if needed
   */
  updateMetrics(
    promptType: PromptType,
    batchSize: number,
    success: boolean,
    latency: number
  ): void {
    const config = this.configs.get(promptType);
    if (!config) return;

    // Update metrics with exponential moving average
    const alpha = 0.2; // Smoothing factor
    config.avgLatency = config.avgLatency * (1 - alpha) + latency * alpha;
    config.successRate =
      config.successRate * (1 - alpha) + (success ? 1 : 0) * alpha;
    config.errorRate =
      config.errorRate * (1 - alpha) + (success ? 0 : 1) * alpha;

    // Calculate throughput (items per second)
    const itemsPerSecond = batchSize / (latency / 1000);
    config.throughput =
      config.throughput * (1 - alpha) + itemsPerSecond * alpha;

    // Check if we should adjust batch size
    const now = new Date();
    const timeSinceLastAdjustment =
      now.getTime() - config.lastAdjustment.getTime();

    if (timeSinceLastAdjustment > this.adjustmentCooldown) {
      this.adjustBatchSize(promptType, config);
    }
  }

  /**
   * Adjust batch size based on performance metrics
   */
  private adjustBatchSize(
    promptType: PromptType,
    config: AdaptiveConfig
  ): void {
    let newSize = config.currentBatchSize;

    // Performance thresholds
    const targetSuccessRate = 0.95;
    const targetLatency = 3000; // 3 seconds
    const maxLatency = 10000; // 10 seconds

    // Adjust based on success rate
    if (config.successRate < targetSuccessRate) {
      // Reduce batch size if failing too often
      newSize = Math.max(1, Math.floor(config.currentBatchSize * 0.8));
    } else if (config.avgLatency > maxLatency) {
      // Reduce if too slow
      newSize = Math.max(1, Math.floor(config.currentBatchSize * 0.7));
    } else if (
      config.successRate > targetSuccessRate &&
      config.avgLatency < targetLatency
    ) {
      // Increase if performing well
      newSize = Math.ceil(config.currentBatchSize * 1.2);
    }

    // Apply constraints based on prompt type
    const constraints = this.getBatchConstraints(promptType);
    newSize = Math.max(constraints.min, Math.min(constraints.max, newSize));

    if (newSize !== config.currentBatchSize) {
      console.log(
        `[ADAPTIVE-BATCHING] Adjusting ${promptType} batch size: ${config.currentBatchSize} → ${newSize} ` +
          `(success: ${(config.successRate * 100).toFixed(1)}%, latency: ${config.avgLatency.toFixed(0)}ms)`
      );

      config.currentBatchSize = newSize;
      config.lastAdjustment = new Date();
    }
  }

  /**
   * Adjust batch size based on system load
   */
  private adjustForSystemLoad(
    baseSize: number,
    metrics: SystemMetrics
  ): number {
    let adjustmentFactor = 1.0;

    // Reduce during high CPU/memory usage
    if (metrics.cpuUsage > 80 || metrics.memoryUsage > 85) {
      adjustmentFactor *= 0.7;
    } else if (metrics.cpuUsage > 60 || metrics.memoryUsage > 70) {
      adjustmentFactor *= 0.85;
    }

    // Reduce during API slowness
    if (metrics.apiResponseTime > 5000) {
      adjustmentFactor *= 0.8;
    }

    // Reduce if queue is backing up
    if (metrics.queueDepth > 100) {
      adjustmentFactor *= 0.75;
    }

    // Time of day adjustments (business hours vs off-hours)
    if (metrics.timeOfDay >= 9 && metrics.timeOfDay <= 17) {
      // Business hours - be more conservative
      adjustmentFactor *= 0.9;
    } else {
      // Off hours - can be more aggressive
      adjustmentFactor *= 1.1;
    }

    return Math.max(1, Math.round(baseSize * adjustmentFactor));
  }

  /**
   * Get batch size constraints for a prompt type
   */
  private getBatchConstraints(promptType: PromptType): {
    min: number;
    max: number;
  } {
    const constraints: Record<PromptType, { min: number; max: number }> = {
      [PromptType.SIMILARITY_CHECK]: { min: 1, max: 20 },
      [PromptType.THEME_EXPANSION]: { min: 1, max: 10 },
      [PromptType.DOMAIN_EXTRACTION]: { min: 5, max: 50 },
      [PromptType.CROSS_LEVEL_SIMILARITY]: { min: 1, max: 15 },
      [PromptType.CODE_ANALYSIS]: { min: 1, max: 5 },
      [PromptType.THEME_EXTRACTION]: { min: 1, max: 1 },
      [PromptType.THEME_NAMING]: { min: 1, max: 1 },
      [PromptType.BATCH_SIMILARITY]: { min: 5, max: 30 },
    };

    return constraints[promptType] || { min: 1, max: 10 };
  }

  /**
   * Get performance report
   */
  getPerformanceReport(): Record<string, any> {
    const report: Record<string, any> = {};

    for (const [type, config] of this.configs.entries()) {
      report[type] = {
        currentBatchSize: config.currentBatchSize,
        successRate: `${(config.successRate * 100).toFixed(1)}%`,
        avgLatency: `${config.avgLatency.toFixed(0)}ms`,
        errorRate: `${(config.errorRate * 100).toFixed(1)}%`,
        throughput: `${config.throughput.toFixed(1)} items/s`,
        lastAdjustment: config.lastAdjustment.toISOString(),
      };
    }

    return report;
  }

  /**
   * Reset adaptive configurations
   */
  reset(): void {
    this.initializeConfigs();
  }

  /**
   * Get current configuration for a prompt type
   */
  getConfig(promptType: PromptType): AdaptiveConfig | undefined {
    return this.configs.get(promptType);
  }

  /**
   * Manually set batch size (for testing/overrides)
   */
  setBatchSize(promptType: PromptType, size: number): void {
    const config = this.configs.get(promptType);
    if (config) {
      config.currentBatchSize = size;
      config.lastAdjustment = new Date();
    }
  }
}
