/**
 * Centralized file exclusion patterns for consistent filtering
 * across all file analysis operations
 */
export class FileExclusionPatterns {
  /**
   * Comprehensive exclusion patterns based on UncommittedMode patterns
   * These patterns exclude files that typically don't need code review
   */
  private static readonly PATTERNS = [
    // Build artifacts and dependencies
    /^dist\//, // Exclude dist folder
    /\.d\.ts$/, // Exclude TypeScript declaration files
    /node_modules\//, // Exclude dependencies
    /\.map$/, // Exclude source maps
    /package-lock\.json$/, // Exclude lock files
    
    // Documentation and configuration
    /\.md$/, // Exclude all markdown files
    /\.txt$/, // Exclude all text files
    /\.json$/, // Exclude all json files
    
    // Specific PRD files
    /command-center\/mindmap-prd\.md$/, // Exclude PRD files
    /command-center\/review-prd\.md$/, // Exclude PRD files
  ];

  /**
   * Check if a file should be included in analysis
   */
  static shouldIncludeFile(filename: string): boolean {
    return !this.PATTERNS.some(pattern => pattern.test(filename));
  }

  /**
   * Get all exclusion patterns for debugging
   */
  static getPatterns(): RegExp[] {
    return [...this.PATTERNS];
  }

  /**
   * Get pattern count for metrics
   */
  static getPatternCount(): number {
    return this.PATTERNS.length;
  }
}