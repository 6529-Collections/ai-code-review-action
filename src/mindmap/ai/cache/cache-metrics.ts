import { PromptType } from '../prompt-types';

/**
 * Cache performance metrics
 */
export interface CacheMetrics {
  hits: number;
  misses: number;
  evictions: number;
  totalRequests: number;
  hitRate: number;
  averageHitAge: number; // Average age of cache hits in ms
  memoryUsage: number; // Approximate memory usage in bytes
}

export interface CacheMetricsByType {
  [key: string]: CacheMetrics;
}

/**
 * Cache metrics collector
 */
export class CacheMetricsCollector {
  private metrics: Map<PromptType, CacheMetrics> = new Map();
  private hitAges: Map<PromptType, number[]> = new Map();

  constructor() {
    this.initializeMetrics();
  }

  private initializeMetrics(): void {
    for (const promptType of Object.values(PromptType)) {
      this.metrics.set(promptType as PromptType, {
        hits: 0,
        misses: 0,
        evictions: 0,
        totalRequests: 0,
        hitRate: 0,
        averageHitAge: 0,
        memoryUsage: 0,
      });
      this.hitAges.set(promptType as PromptType, []);
    }
  }

  recordHit(promptType: PromptType, ageMs: number): void {
    const metrics = this.metrics.get(promptType);
    if (!metrics) return;

    metrics.hits++;
    metrics.totalRequests++;
    metrics.hitRate = metrics.hits / metrics.totalRequests;

    // Track hit ages for average calculation
    const ages = this.hitAges.get(promptType) || [];
    ages.push(ageMs);

    // Keep only last 100 ages to avoid memory issues
    if (ages.length > 100) {
      ages.shift();
    }

    // Calculate average age
    metrics.averageHitAge =
      ages.reduce((sum, age) => sum + age, 0) / ages.length;
  }

  recordMiss(promptType: PromptType): void {
    const metrics = this.metrics.get(promptType);
    if (!metrics) return;

    metrics.misses++;
    metrics.totalRequests++;
    metrics.hitRate = metrics.hits / metrics.totalRequests;
  }

  recordEviction(promptType: PromptType): void {
    const metrics = this.metrics.get(promptType);
    if (!metrics) return;

    metrics.evictions++;
  }

  updateMemoryUsage(promptType: PromptType, bytes: number): void {
    const metrics = this.metrics.get(promptType);
    if (!metrics) return;

    metrics.memoryUsage = bytes;
  }

  getMetrics(promptType?: PromptType): CacheMetrics | CacheMetricsByType {
    if (promptType) {
      return this.metrics.get(promptType) || this.createEmptyMetrics();
    }

    const allMetrics: CacheMetricsByType = {};
    for (const [type, metrics] of this.metrics.entries()) {
      allMetrics[type] = { ...metrics };
    }
    return allMetrics;
  }

  getOverallMetrics(): CacheMetrics {
    const overall: CacheMetrics = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalRequests: 0,
      hitRate: 0,
      averageHitAge: 0,
      memoryUsage: 0,
    };

    for (const metrics of this.metrics.values()) {
      overall.hits += metrics.hits;
      overall.misses += metrics.misses;
      overall.evictions += metrics.evictions;
      overall.totalRequests += metrics.totalRequests;
      overall.memoryUsage += metrics.memoryUsage;
    }

    overall.hitRate =
      overall.totalRequests > 0 ? overall.hits / overall.totalRequests : 0;

    // Calculate weighted average hit age
    let totalHitAge = 0;
    let totalHits = 0;
    for (const [promptType, metrics] of this.metrics.entries()) {
      if (metrics.hits > 0) {
        totalHitAge += metrics.averageHitAge * metrics.hits;
        totalHits += metrics.hits;
      }
    }
    overall.averageHitAge = totalHits > 0 ? totalHitAge / totalHits : 0;

    return overall;
  }

  reset(): void {
    this.initializeMetrics();
  }

  private createEmptyMetrics(): CacheMetrics {
    return {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalRequests: 0,
      hitRate: 0,
      averageHitAge: 0,
      memoryUsage: 0,
    };
  }

  /**
   * Get cache efficiency report
   */
  getEfficiencyReport(): string {
    const overall = this.getOverallMetrics();
    const topPerformers: Array<{ type: PromptType; hitRate: number }> = [];
    const worstPerformers: Array<{ type: PromptType; hitRate: number }> = [];

    for (const [type, metrics] of this.metrics.entries()) {
      if (metrics.totalRequests > 10) {
        // Only consider types with sufficient requests
        const entry = { type, hitRate: metrics.hitRate };
        if (metrics.hitRate > 0.7) {
          topPerformers.push(entry);
        } else if (metrics.hitRate < 0.3) {
          worstPerformers.push(entry);
        }
      }
    }

    topPerformers.sort((a, b) => b.hitRate - a.hitRate);
    worstPerformers.sort((a, b) => a.hitRate - b.hitRate);

    let report = `Cache Efficiency Report\n`;
    report += `=======================\n`;
    report += `Overall Hit Rate: ${(overall.hitRate * 100).toFixed(1)}%\n`;
    report += `Total Requests: ${overall.totalRequests}\n`;
    report += `Memory Usage: ${(overall.memoryUsage / 1024 / 1024).toFixed(2)} MB\n`;
    report += `Average Hit Age: ${(overall.averageHitAge / 1000).toFixed(1)} seconds\n\n`;

    if (topPerformers.length > 0) {
      report += `Top Performers:\n`;
      topPerformers.slice(0, 3).forEach((p) => {
        report += `  - ${p.type}: ${(p.hitRate * 100).toFixed(1)}%\n`;
      });
      report += '\n';
    }

    if (worstPerformers.length > 0) {
      report += `Needs Improvement:\n`;
      worstPerformers.slice(0, 3).forEach((p) => {
        report += `  - ${p.type}: ${(p.hitRate * 100).toFixed(1)}%\n`;
      });
    }

    return report;
  }
}
