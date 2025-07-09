/**
 * Centralized file exclusion patterns for consistent filtering
 * across all file analysis operations
 */
export declare class FileExclusionPatterns {
    /**
     * Comprehensive exclusion patterns based on UncommittedMode patterns
     * These patterns exclude files that typically don't need code review
     */
    private static readonly PATTERNS;
    /**
     * Check if a file should be included in analysis
     */
    static shouldIncludeFile(filename: string): boolean;
    /**
     * Get all exclusion patterns for debugging
     */
    static getPatterns(): RegExp[];
    /**
     * Get pattern count for metrics
     */
    static getPatternCount(): number;
}
