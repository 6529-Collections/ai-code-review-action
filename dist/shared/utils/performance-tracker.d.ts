export interface TimingEntry {
    name: string;
    startTime: number;
    endTime?: number;
    duration?: number;
    children: TimingEntry[];
    metadata?: Record<string, unknown>;
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
export declare class PerformanceTracker {
    private static instance;
    private timingStack;
    private aiMetrics;
    private resourceMetrics;
    private stages;
    private bottlenecks;
    private effectiveness;
    private constructor();
    static getInstance(): PerformanceTracker;
    /**
     * Start timing an operation
     */
    startTiming(name: string, metadata?: Record<string, unknown>): void;
    /**
     * End timing an operation
     */
    endTiming(name: string): number;
    /**
     * Track AI call performance
     */
    trackAICall(context: string, duration: number, operation?: string): void;
    /**
     * Track effectiveness of an operation
     */
    trackEffectiveness(operation: string, input: number, output: number, timeSpent: number): void;
    /**
     * Track resource usage
     */
    trackTempFile(created?: boolean): void;
    trackCache(hit: boolean): void;
    /**
     * Add bottleneck warning
     */
    private addBottleneck;
    /**
     * Generate comprehensive performance report
     */
    generateReport(): void;
    /**
     * Reset all metrics
     */
    reset(): void;
    private getMemoryUsage;
}
export declare const performanceTracker: PerformanceTracker;
