import { logger } from './logger';

export interface TimingEntry {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  children: TimingEntry[];
  metadata?: Record<string, any>;
}

export interface AICallMetrics {
  context: string;
  calls: number;
  totalTime: number;
  avgTime: number;
  maxTime: number;
  minTime: number;
  slowestOperation?: string;
}

export interface ResourceMetrics {
  memoryStart: number;
  memoryPeak: number;
  memoryEnd: number;
  tempFilesCreated: number;
  tempFilesCleaned: number;
  cacheHits: number;
  cacheMisses: number;
}

export interface StageMetrics {
  name: string;
  duration: number;
  percentOfTotal: number;
  subStages: Array<{
    name: string;
    duration: number;
    percentOfStage: number;
    isBottleneck: boolean;
  }>;
}

export interface BottleneckWarning {
  type: 'high_ai_latency' | 'low_batch_efficiency' | 'sequential_processing' | 'large_file_analysis' | 'unnecessary_work';
  description: string;
  currentValue: string;
  suggestion: string;
  estimatedSavings?: string;
}

export interface EffectivenessMetrics {
  operation: string;
  input: number;
  output: number;
  reductionRate: number;
  timeSpent: number;
  worthwhile: boolean;
}

export class PerformanceTracker {
  private static instance: PerformanceTracker;
  private timingStack: TimingEntry[] = [];
  private aiMetrics: Map<string, { calls: number; totalTime: number; times: number[]; operations: string[] }> = new Map();
  private resourceMetrics: ResourceMetrics = {
    memoryStart: this.getMemoryUsage(),
    memoryPeak: this.getMemoryUsage(),
    memoryEnd: 0,
    tempFilesCreated: 0,
    tempFilesCleaned: 0,
    cacheHits: 0,
    cacheMisses: 0
  };
  private stages: TimingEntry[] = [];
  private bottlenecks: BottleneckWarning[] = [];
  private effectiveness: EffectivenessMetrics[] = [];

  private constructor() {}

  static getInstance(): PerformanceTracker {
    if (!PerformanceTracker.instance) {
      PerformanceTracker.instance = new PerformanceTracker();
    }
    return PerformanceTracker.instance;
  }

  /**
   * Start timing an operation
   */
  startTiming(name: string, metadata?: Record<string, any>): void {
    const entry: TimingEntry = {
      name,
      startTime: Date.now(),
      children: [],
      metadata
    };

    if (this.timingStack.length > 0) {
      // Add as child to current operation
      this.timingStack[this.timingStack.length - 1].children.push(entry);
    } else {
      // Top-level operation
      this.stages.push(entry);
    }

    this.timingStack.push(entry);
    logger.info('PERF', `🔄 Starting: ${name}`);
  }

  /**
   * End timing an operation
   */
  endTiming(name: string): number {
    const entry = this.timingStack.pop();
    if (!entry || entry.name !== name) {
      logger.warn('PERF', `Timing mismatch: expected ${name}, got ${entry?.name || 'none'}`);
      return 0;
    }

    entry.endTime = Date.now();
    entry.duration = entry.endTime - entry.startTime;

    // Log completion with sub-stage breakdown
    if (entry.children.length > 0) {
      logger.info('PERF', `✅ Complete: ${name} (${(entry.duration / 1000).toFixed(1)}s total)`);
      
      // Log sub-stages with bottleneck detection
      for (const child of entry.children) {
        const childDuration = child.duration || 0;
        const percentOfParent = (childDuration / entry.duration) * 100;
        const isBottleneck = percentOfParent > 70; // More than 70% of parent time
        
        const bottleneckIcon = isBottleneck ? ' ⚠️' : '';
        logger.info('PERF', `└─ ${child.name}: ${(childDuration / 1000).toFixed(1)}s (${percentOfParent.toFixed(0)}% of stage)${bottleneckIcon}`);
        
        if (isBottleneck) {
          this.addBottleneck({
            type: 'sequential_processing',
            description: `${child.name} consuming ${percentOfParent.toFixed(0)}% of ${name}`,
            currentValue: `${(childDuration / 1000).toFixed(1)}s`,
            suggestion: 'Consider parallelization or optimization'
          });
        }
      }
    } else {
      logger.info('PERF', `✅ Complete: ${name} (${(entry.duration / 1000).toFixed(1)}s)`);
    }

    return entry.duration;
  }

  /**
   * Track AI call performance
   */
  trackAICall(context: string, duration: number, operation?: string): void {
    if (!this.aiMetrics.has(context)) {
      this.aiMetrics.set(context, { calls: 0, totalTime: 0, times: [], operations: [] });
    }

    const metrics = this.aiMetrics.get(context)!;
    metrics.calls++;
    metrics.totalTime += duration;
    metrics.times.push(duration);
    if (operation) {
      metrics.operations.push(operation);
    }

    // Check for high latency
    if (duration > 5000) { // 5+ seconds
      this.addBottleneck({
        type: 'high_ai_latency',
        description: `High AI latency in ${context}`,
        currentValue: `${(duration / 1000).toFixed(1)}s`,
        suggestion: 'Consider reducing prompt size or splitting into chunks',
        estimatedSavings: `${((duration - 3000) / 1000).toFixed(1)}s per call`
      });
    }

    // Update memory peak
    this.resourceMetrics.memoryPeak = Math.max(this.resourceMetrics.memoryPeak, this.getMemoryUsage());
  }

  /**
   * Track effectiveness of an operation
   */
  trackEffectiveness(operation: string, input: number, output: number, timeSpent: number): void {
    const reductionRate = input > 0 ? ((input - output) / input) * 100 : 0;
    const worthwhile = reductionRate > 10 || timeSpent < 5000; // Either good reduction or fast

    this.effectiveness.push({
      operation,
      input,
      output,
      reductionRate,
      timeSpent,
      worthwhile
    });

    if (!worthwhile && timeSpent > 10000) { // 10+ seconds for minimal benefit
      this.addBottleneck({
        type: 'unnecessary_work',
        description: `${operation}: ${timeSpent / 1000}s for ${reductionRate.toFixed(1)}% improvement`,
        currentValue: `${reductionRate.toFixed(1)}% reduction`,
        suggestion: 'Consider skipping this step or optimizing thresholds',
        estimatedSavings: `${(timeSpent / 1000).toFixed(1)}s`
      });
    }
  }

  /**
   * Track resource usage
   */
  trackTempFile(created: boolean = true): void {
    if (created) {
      this.resourceMetrics.tempFilesCreated++;
    } else {
      this.resourceMetrics.tempFilesCleaned++;
    }
  }

  trackCache(hit: boolean): void {
    if (hit) {
      this.resourceMetrics.cacheHits++;
    } else {
      this.resourceMetrics.cacheMisses++;
    }
  }

  /**
   * Add bottleneck warning
   */
  private addBottleneck(bottleneck: BottleneckWarning): void {
    this.bottlenecks.push(bottleneck);
  }

  /**
   * Generate comprehensive performance report
   */
  generateReport(): void {
    this.resourceMetrics.memoryEnd = this.getMemoryUsage();
    
    logger.info('PERFORMANCE', '📊 === PERFORMANCE ANALYSIS REPORT ===');
    
    // Overall timing breakdown
    const totalTime = this.stages.reduce((sum, stage) => sum + (stage.duration || 0), 0);
    logger.info('PERFORMANCE', `Total execution time: ${(totalTime / 1000).toFixed(1)}s`);
    
    // Stage breakdown
    if (this.stages.length > 0) {
      logger.info('PERFORMANCE', '\n🎯 Stage Breakdown:');
      this.stages.forEach((stage, index) => {
        const duration = stage.duration || 0;
        const percent = totalTime > 0 ? (duration / totalTime) * 100 : 0;
        logger.info('PERFORMANCE', `${index + 1}. ${stage.name}: ${(duration / 1000).toFixed(1)}s (${percent.toFixed(0)}%)`);
      });
    }

    // AI call analytics
    if (this.aiMetrics.size > 0) {
      logger.info('PERFORMANCE', '\n🤖 AI Call Analytics:');
      for (const [context, metrics] of this.aiMetrics) {
        const avgTime = metrics.totalTime / metrics.calls;
        const maxTime = Math.max(...metrics.times);
        const minTime = Math.min(...metrics.times);
        
        logger.info('PERFORMANCE', `${context}:`);
        logger.info('PERFORMANCE', `├─ Calls: ${metrics.calls}, Total: ${(metrics.totalTime / 1000).toFixed(1)}s`);
        logger.info('PERFORMANCE', `├─ Avg: ${(avgTime / 1000).toFixed(1)}s, Max: ${(maxTime / 1000).toFixed(1)}s, Min: ${(minTime / 1000).toFixed(1)}s`);
        
        // Find slowest operation
        if (metrics.operations.length > 0) {
          const slowestIndex = metrics.times.indexOf(maxTime);
          if (slowestIndex >= 0 && metrics.operations[slowestIndex]) {
            logger.info('PERFORMANCE', `└─ Slowest: ${metrics.operations[slowestIndex]} (${(maxTime / 1000).toFixed(1)}s)`);
          }
        }
      }
    }

    // Resource utilization
    logger.info('PERFORMANCE', '\n💾 Resource Utilization:');
    logger.info('PERFORMANCE', `Memory: ${this.resourceMetrics.memoryStart}MB → ${this.resourceMetrics.memoryEnd}MB (peak: ${this.resourceMetrics.memoryPeak}MB)`);
    
    const tempFileLeaks = this.resourceMetrics.tempFilesCreated - this.resourceMetrics.tempFilesCleaned;
    logger.info('PERFORMANCE', `Temp files: ${this.resourceMetrics.tempFilesCreated} created, ${this.resourceMetrics.tempFilesCleaned} cleaned${tempFileLeaks > 0 ? ` (${tempFileLeaks} leaked!)` : ''}`);
    
    const totalCacheOps = this.resourceMetrics.cacheHits + this.resourceMetrics.cacheMisses;
    const cacheHitRate = totalCacheOps > 0 ? (this.resourceMetrics.cacheHits / totalCacheOps) * 100 : 0;
    logger.info('PERFORMANCE', `Cache: ${this.resourceMetrics.cacheHits}/${totalCacheOps} hits (${cacheHitRate.toFixed(0)}% hit rate)`);

    // Effectiveness tracking
    if (this.effectiveness.length > 0) {
      logger.info('PERFORMANCE', '\n📈 Effectiveness Analysis:');
      this.effectiveness.forEach(eff => {
        const worthwhileIcon = eff.worthwhile ? '✅' : '⚠️';
        logger.info('PERFORMANCE', `${worthwhileIcon} ${eff.operation}: ${eff.input}→${eff.output} (${eff.reductionRate.toFixed(1)}% reduction, ${(eff.timeSpent / 1000).toFixed(1)}s)`);
      });
    }

    // Bottleneck warnings and suggestions
    if (this.bottlenecks.length > 0) {
      logger.info('PERFORMANCE', '\n⚠️ Bottlenecks & Optimization Opportunities:');
      this.bottlenecks.forEach((bottleneck, index) => {
        logger.info('PERFORMANCE', `${index + 1}. ${bottleneck.description}`);
        logger.info('PERFORMANCE', `   Current: ${bottleneck.currentValue}`);
        logger.info('PERFORMANCE', `   Suggestion: ${bottleneck.suggestion}`);
        if (bottleneck.estimatedSavings) {
          logger.info('PERFORMANCE', `   Est. savings: ${bottleneck.estimatedSavings}`);
        }
      });
    }

    // Final insights
    const totalAICalls = Array.from(this.aiMetrics.values()).reduce((sum, m) => sum + m.calls, 0);
    const totalAITime = Array.from(this.aiMetrics.values()).reduce((sum, m) => sum + m.totalTime, 0);
    
    logger.info('PERFORMANCE', '\n🎯 Key Insights:');
    logger.info('PERFORMANCE', `• Total AI calls: ${totalAICalls} (${(totalAITime / 1000).toFixed(1)}s, ${((totalAITime / totalTime) * 100).toFixed(0)}% of total time)`);
    
    if (totalAICalls > 50) {
      logger.warn('PERFORMANCE', `• High AI usage detected (${totalAICalls} calls) - consider batch optimization`);
    }
    
    if (totalTime > 120000) { // 2+ minutes
      logger.warn('PERFORMANCE', `• Long processing time (${(totalTime / 1000).toFixed(1)}s) - see bottleneck suggestions above`);
    }
    
    logger.info('PERFORMANCE', '📊 === END PERFORMANCE REPORT ===');
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.timingStack = [];
    this.aiMetrics.clear();
    this.stages = [];
    this.bottlenecks = [];
    this.effectiveness = [];
    this.resourceMetrics = {
      memoryStart: this.getMemoryUsage(),
      memoryPeak: this.getMemoryUsage(),
      memoryEnd: 0,
      tempFilesCreated: 0,
      tempFilesCleaned: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
  }

  private getMemoryUsage(): number {
    const usage = process.memoryUsage();
    return Math.round(usage.heapUsed / 1024 / 1024); // MB
  }
}

// Export singleton instance
export const performanceTracker = PerformanceTracker.getInstance();