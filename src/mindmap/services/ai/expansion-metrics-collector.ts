import { ConsolidatedTheme } from '../../types/similarity-types';
import { MultiStageDecision, ExpansionMetric } from '../../types/multi-stage-types';
import { logInfo, logWarning } from '../../../utils/index';

/**
 * Collects and analyzes metrics from expansion decisions
 */
export class ExpansionMetricsCollector {
  private metrics: Map<string, ExpansionMetric> = new Map();
  private readonly maxMetricsSize = 10000;

  /**
   * Record an expansion decision for analysis
   */
  recordDecision(
    theme: ConsolidatedTheme,
    depth: number,
    decision: MultiStageDecision
  ): void {
    const metric: ExpansionMetric = {
      themeId: theme.id,
      depth,
      timestamp: new Date(),
      
      // Analysis metrics
      separableConcerns: decision.analysis.separableConcerns.length,
      codeComplexity: decision.analysis.codeComplexity,
      
      // Validation scores
      granularityScore: decision.validation.granularityScore,
      depthScore: decision.validation.depthAppropriatenessScore,
      businessScore: decision.validation.businessValueScore,
      testScore: decision.validation.testBoundaryScore,
      
      // Decision outcome
      expanded: decision.finalDecision.shouldExpand,
      confidence: parseFloat(decision.validation.confidence.toFixed(3)),
      corrected: decision.validation.correctedFromInitial,
      
      // Performance
      processingTimeMs: decision.processingTimeMs
    };
    
    this.metrics.set(theme.id, metric);
    
    // Prevent memory bloat
    if (this.metrics.size > this.maxMetricsSize) {
      this.pruneOldMetrics();
    }
  }

  /**
   * Generate comprehensive metrics report
   */
  generateReport(): ExpansionReport {
    const allMetrics = Array.from(this.metrics.values());
    
    if (allMetrics.length === 0) {
      return this.getEmptyReport();
    }

    return {
      summary: this.generateSummary(allMetrics),
      depthAnalysis: this.analyzeByDepth(allMetrics),
      complexityAnalysis: this.analyzeByComplexity(allMetrics),
      scoreAnalysis: this.analyzeScores(allMetrics),
      performanceMetrics: this.analyzePerformance(allMetrics),
      problemAreas: this.identifyProblemAreas(allMetrics),
      recommendations: this.generateRecommendations(allMetrics)
    };
  }

  /**
   * Generate summary statistics
   */
  private generateSummary(metrics: ExpansionMetric[]): ReportSummary {
    const total = metrics.length;
    const expanded = metrics.filter(m => m.expanded).length;
    const corrected = metrics.filter(m => m.corrected).length;
    
    const avgConfidence = metrics.reduce((sum, m) => sum + m.confidence, 0) / total;
    const avgProcessingTime = metrics.reduce((sum, m) => sum + m.processingTimeMs, 0) / total;
    
    return {
      totalDecisions: total,
      expansionRate: expanded / total,
      correctionRate: corrected / total,
      averageConfidence: parseFloat(avgConfidence.toFixed(3)),
      averageProcessingTime: parseFloat(avgProcessingTime.toFixed(1)),
      timeRange: {
        start: new Date(Math.min(...metrics.map(m => m.timestamp.getTime()))),
        end: new Date(Math.max(...metrics.map(m => m.timestamp.getTime())))
      }
    };
  }

  /**
   * Analyze decisions by depth
   */
  private analyzeByDepth(metrics: ExpansionMetric[]): Record<number, DepthAnalysis> {
    const depthGroups = this.groupBy(metrics, m => m.depth);
    const analysis: Record<number, DepthAnalysis> = {};
    
    for (const [depth, depthMetrics] of Object.entries(depthGroups)) {
      const total = depthMetrics.length;
      const expanded = depthMetrics.filter(m => m.expanded).length;
      const avgGranularity = depthMetrics.reduce((sum, m) => sum + m.granularityScore, 0) / total;
      const avgDepthScore = depthMetrics.reduce((sum, m) => sum + m.depthScore, 0) / total;
      
      analysis[parseInt(depth)] = {
        totalDecisions: total,
        expansionRate: expanded / total,
        averageGranularityScore: parseFloat(avgGranularity.toFixed(3)),
        averageDepthScore: parseFloat(avgDepthScore.toFixed(3)),
        correctionRate: depthMetrics.filter(m => m.corrected).length / total
      };
    }
    
    return analysis;
  }

  /**
   * Analyze decisions by code complexity
   */
  private analyzeByComplexity(metrics: ExpansionMetric[]): Record<string, ComplexityAnalysis> {
    const complexityGroups = this.groupBy(metrics, m => m.codeComplexity);
    const analysis: Record<string, ComplexityAnalysis> = {};
    
    for (const [complexity, complexityMetrics] of Object.entries(complexityGroups)) {
      const total = complexityMetrics.length;
      const expanded = complexityMetrics.filter(m => m.expanded).length;
      const avgConcerns = complexityMetrics.reduce((sum, m) => sum + m.separableConcerns, 0) / total;
      
      analysis[complexity] = {
        totalDecisions: total,
        expansionRate: expanded / total,
        averageSeparableConcerns: parseFloat(avgConcerns.toFixed(2)),
        averageConfidence: parseFloat(
          (complexityMetrics.reduce((sum, m) => sum + m.confidence, 0) / total).toFixed(3)
        )
      };
    }
    
    return analysis;
  }

  /**
   * Analyze validation scores
   */
  private analyzeScores(metrics: ExpansionMetric[]): ScoreAnalysis {
    const scores = {
      granularity: metrics.map(m => m.granularityScore),
      depth: metrics.map(m => m.depthScore),
      business: metrics.map(m => m.businessScore),
      test: metrics.map(m => m.testScore)
    };
    
    const analysis: ScoreAnalysis = {};
    
    for (const [scoreType, values] of Object.entries(scores)) {
      const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
      const sorted = values.sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      const min = Math.min(...values);
      const max = Math.max(...values);
      
      analysis[scoreType] = {
        average: parseFloat(avg.toFixed(3)),
        median: parseFloat(median.toFixed(3)),
        min: parseFloat(min.toFixed(3)),
        max: parseFloat(max.toFixed(3)),
        distribution: this.getScoreDistribution(values)
      };
    }
    
    return analysis;
  }

  /**
   * Analyze performance metrics
   */
  private analyzePerformance(metrics: ExpansionMetric[]): PerformanceAnalysis {
    const processingTimes = metrics.map(m => m.processingTimeMs);
    const avg = processingTimes.reduce((sum, t) => sum + t, 0) / processingTimes.length;
    const sorted = processingTimes.sort((a, b) => a - b);
    
    return {
      averageProcessingTime: parseFloat(avg.toFixed(1)),
      medianProcessingTime: sorted[Math.floor(sorted.length / 2)],
      p95ProcessingTime: sorted[Math.floor(sorted.length * 0.95)],
      slowestDecisions: metrics
        .sort((a, b) => b.processingTimeMs - a.processingTimeMs)
        .slice(0, 5)
        .map(m => ({
          themeId: m.themeId,
          depth: m.depth,
          processingTime: m.processingTimeMs,
          complexity: m.codeComplexity
        }))
    };
  }

  /**
   * Identify potential problem areas
   */
  private identifyProblemAreas(metrics: ExpansionMetric[]): string[] {
    const problems: string[] = [];
    
    // High correction rate
    const correctionRate = metrics.filter(m => m.corrected).length / metrics.length;
    if (correctionRate > 0.2) {
      problems.push(`High correction rate: ${(correctionRate * 100).toFixed(1)}% of decisions were corrected`);
    }
    
    // Low confidence decisions
    const lowConfidenceRate = metrics.filter(m => m.confidence < 0.5).length / metrics.length;
    if (lowConfidenceRate > 0.3) {
      problems.push(`Many low-confidence decisions: ${(lowConfidenceRate * 100).toFixed(1)}% below 0.5 confidence`);
    }
    
    // Deep expansion patterns
    const deepExpansions = metrics.filter(m => m.depth > 10 && m.expanded).length;
    if (deepExpansions > 0) {
      problems.push(`Deep expansions detected: ${deepExpansions} expansions at depth > 10`);
    }
    
    // Slow processing
    const avgProcessingTime = metrics.reduce((sum, m) => sum + m.processingTimeMs, 0) / metrics.length;
    if (avgProcessingTime > 5000) {
      problems.push(`Slow processing: average ${avgProcessingTime.toFixed(0)}ms per decision`);
    }
    
    return problems;
  }

  /**
   * Generate recommendations for improvement
   */
  private generateRecommendations(metrics: ExpansionMetric[]): string[] {
    const recommendations: string[] = [];
    const problems = this.identifyProblemAreas(metrics);
    
    if (problems.some(p => p.includes('correction rate'))) {
      recommendations.push('Consider adjusting validation prompts to improve initial decision quality');
    }
    
    if (problems.some(p => p.includes('low-confidence'))) {
      recommendations.push('Review confidence calibration in validation service');
    }
    
    if (problems.some(p => p.includes('Deep expansions'))) {
      recommendations.push('Implement stronger depth limits or quick decision thresholds');
    }
    
    if (problems.some(p => p.includes('Slow processing'))) {
      recommendations.push('Optimize AI calls or implement more aggressive quick decisions');
    }
    
    // Depth-specific recommendations
    const depthAnalysis = this.analyzeByDepth(metrics);
    const highExpansionDepths = Object.entries(depthAnalysis)
      .filter(([_, analysis]) => analysis.expansionRate > 0.8 && parseInt(_) > 8)
      .map(([depth, _]) => depth);
    
    if (highExpansionDepths.length > 0) {
      recommendations.push(`Review expansion logic for depths ${highExpansionDepths.join(', ')} - high expansion rates detected`);
    }
    
    return recommendations.length > 0 ? recommendations : ['No specific issues detected - system performing well'];
  }

  /**
   * Utility: Group array by key function
   */
  private groupBy<T, K extends string | number>(
    array: T[],
    keyFn: (item: T) => K
  ): Record<K, T[]> {
    const groups = {} as Record<K, T[]>;
    for (const item of array) {
      const key = keyFn(item);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
    }
    return groups;
  }

  /**
   * Get score distribution
   */
  private getScoreDistribution(scores: number[]): Record<string, number> {
    const ranges = {
      '0.0-0.2': 0,
      '0.2-0.4': 0,
      '0.4-0.6': 0,
      '0.6-0.8': 0,
      '0.8-1.0': 0
    };
    
    scores.forEach(score => {
      if (score < 0.2) ranges['0.0-0.2']++;
      else if (score < 0.4) ranges['0.2-0.4']++;
      else if (score < 0.6) ranges['0.4-0.6']++;
      else if (score < 0.8) ranges['0.6-0.8']++;
      else ranges['0.8-1.0']++;
    });
    
    return ranges;
  }

  /**
   * Remove old metrics to prevent memory bloat
   */
  private pruneOldMetrics(): void {
    const sortedMetrics = Array.from(this.metrics.entries())
      .sort(([, a], [, b]) => b.timestamp.getTime() - a.timestamp.getTime());
    
    const keepCount = Math.floor(this.maxMetricsSize * 0.8);
    const toKeep = sortedMetrics.slice(0, keepCount);
    
    this.metrics.clear();
    toKeep.forEach(([id, metric]) => this.metrics.set(id, metric));
    
    logInfo(`Pruned metrics: kept ${keepCount} most recent entries`);
  }

  /**
   * Get empty report structure
   */
  private getEmptyReport(): ExpansionReport {
    return {
      summary: {
        totalDecisions: 0,
        expansionRate: 0,
        correctionRate: 0,
        averageConfidence: 0,
        averageProcessingTime: 0,
        timeRange: { start: new Date(), end: new Date() }
      },
      depthAnalysis: {},
      complexityAnalysis: {},
      scoreAnalysis: {},
      performanceMetrics: {
        averageProcessingTime: 0,
        medianProcessingTime: 0,
        p95ProcessingTime: 0,
        slowestDecisions: []
      },
      problemAreas: [],
      recommendations: ['No data available yet']
    };
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics.clear();
    logInfo('All expansion metrics cleared');
  }

  /**
   * Get current metrics count
   */
  getMetricsCount(): number {
    return this.metrics.size;
  }
}

// Type definitions for report structures
interface ExpansionReport {
  summary: ReportSummary;
  depthAnalysis: Record<number, DepthAnalysis>;
  complexityAnalysis: Record<string, ComplexityAnalysis>;
  scoreAnalysis: ScoreAnalysis;
  performanceMetrics: PerformanceAnalysis;
  problemAreas: string[];
  recommendations: string[];
}

interface ReportSummary {
  totalDecisions: number;
  expansionRate: number;
  correctionRate: number;
  averageConfidence: number;
  averageProcessingTime: number;
  timeRange: { start: Date; end: Date };
}

interface DepthAnalysis {
  totalDecisions: number;
  expansionRate: number;
  averageGranularityScore: number;
  averageDepthScore: number;
  correctionRate: number;
}

interface ComplexityAnalysis {
  totalDecisions: number;
  expansionRate: number;
  averageSeparableConcerns: number;
  averageConfidence: number;
}

interface ScoreAnalysis {
  [scoreType: string]: {
    average: number;
    median: number;
    min: number;
    max: number;
    distribution: Record<string, number>;
  };
}

interface PerformanceAnalysis {
  averageProcessingTime: number;
  medianProcessingTime: number;
  p95ProcessingTime: number;
  slowestDecisions: Array<{
    themeId: string;
    depth: number;
    processingTime: number;
    complexity: string;
  }>;
}