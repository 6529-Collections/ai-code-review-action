import { ConsolidatedTheme } from '../types/similarity-types';
/**
 * Configuration for expansion control
 */
export interface ExpansionControlConfig {
    maxDepth: number;
    sameThemeExpansionLimit: number;
    atomicThresholds: {
        singleFile: {
            maxLines: number;
        };
        singleMethod: {
            autoAtomic: boolean;
        };
        singleLineChange: {
            autoAtomic: boolean;
        };
    };
    complexityDepthRatio: number;
}
/**
 * Circuit breaker to prevent infinite expansion loops
 */
export declare class ExpansionCircuitBreaker {
    private config;
    private expansionHistory;
    private atomicDecisions;
    constructor(config?: Partial<ExpansionControlConfig>);
    /**
     * Check if expansion should be allowed for a theme
     */
    shouldAllowExpansion(theme: ConsolidatedTheme, currentDepth: number, metrics?: {
        totalLines?: number;
        fileCount?: number;
        methodCount?: number;
        complexityScore?: number;
    }): {
        allowed: boolean;
        reason: string;
        confidence: number;
    };
    /**
     * Check if theme meets atomic thresholds
     */
    private checkAtomicThresholds;
    /**
     * Reset circuit breaker state
     */
    reset(): void;
    /**
     * Get expansion statistics
     */
    getStats(): {
        totalThemes: number;
        averageExpansions: number;
        atomicThemes: number;
        maxExpansions: number;
    };
    /**
     * Mark a theme as atomic (override)
     */
    markAsAtomic(themeId: string): void;
    /**
     * Check if theme was previously marked atomic
     */
    isMarkedAtomic(themeId: string): boolean;
}
