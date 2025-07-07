import { ConsolidatedTheme } from '../../types/similarity-types';
import { MultiStageDecision } from '../../types/multi-stage-types';
/**
 * Collects and analyzes metrics from expansion decisions
 */
export declare class ExpansionMetricsCollector {
    private metrics;
    private readonly maxMetricsSize;
    /**
     * Record an expansion decision for analysis
     */
    recordDecision(theme: ConsolidatedTheme, depth: number, decision: MultiStageDecision): void;
    /**
     * Generate comprehensive metrics report
     */
    generateReport(): ExpansionReport;
    /**
     * Generate summary statistics
     */
    private generateSummary;
    /**
     * Analyze decisions by depth
     */
    private analyzeByDepth;
    /**
     * Analyze decisions by code complexity
     */
    private analyzeByComplexity;
    /**
     * Analyze validation scores
     */
    private analyzeScores;
    /**
     * Analyze performance metrics
     */
    private analyzePerformance;
    /**
     * Identify potential problem areas
     */
    private identifyProblemAreas;
    /**
     * Generate recommendations for improvement
     */
    private generateRecommendations;
    /**
     * Utility: Group array by key function
     */
    private groupBy;
    /**
     * Get score distribution
     */
    private getScoreDistribution;
    /**
     * Remove old metrics to prevent memory bloat
     */
    private pruneOldMetrics;
    /**
     * Get empty report structure
     */
    private getEmptyReport;
    /**
     * Clear all metrics
     */
    clearMetrics(): void;
    /**
     * Get current metrics count
     */
    getMetricsCount(): number;
}
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
    timeRange: {
        start: Date;
        end: Date;
    };
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
export {};
