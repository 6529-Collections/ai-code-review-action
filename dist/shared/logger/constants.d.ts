/**
 * Logger Constants
 *
 * Centralized constants for logging configuration and service naming
 */
export declare const LoggerServices: {
    readonly MAIN: "MAIN";
    readonly PERF: "PERF";
    readonly PERFORMANCE: "PERFORMANCE";
    readonly CODE_ANALYSIS: "CODE_ANALYSIS";
    readonly AI_ANALYZER: "AI_ANALYZER";
    readonly EXPANSION: "EXPANSION";
    readonly CONSOLIDATION: "CONSOLIDATION";
    readonly SIMILARITY: "SIMILARITY";
    readonly SIMILARITY_HIERARCHICAL: "SIMILARITY_HIERARCHICAL";
    readonly CACHE_SEMANTIC: "CACHE_SEMANTIC";
    readonly CACHE_ANALYSIS: "CACHE_ANALYSIS";
    readonly CLAUDE_CLIENT: "CLAUDE_CLIENT";
    readonly BUSINESS_DOMAIN: "BUSINESS_DOMAIN";
    readonly GIT_SERVICE: "GIT_SERVICE";
};
export declare const LogLevels: {
    readonly ERROR: 0;
    readonly WARN: 1;
    readonly INFO: 2;
    readonly DEBUG: 3;
    readonly TRACE: 4;
};
export declare const LogMessages: {
    readonly STARTING_ANALYSIS: "Starting analysis";
    readonly ANALYSIS_COMPLETE: "Analysis complete";
    readonly PROCESSING_ITEMS: (count: number, type: string) => string;
    readonly FAILED_OPERATION: (operation: string, error: string) => string;
    readonly CACHE_HIT: (context: string) => string;
    readonly CACHE_MISS: (context: string) => string;
};
export type LoggerService = typeof LoggerServices[keyof typeof LoggerServices];
