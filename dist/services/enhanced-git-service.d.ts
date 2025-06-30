import { SemanticDiff } from '../types/mindmap-types';
/**
 * Enhanced Git service for semantic diff analysis
 * Provides rich understanding of code changes beyond raw diffs
 */
export declare class EnhancedGitService {
    private octokit;
    constructor(githubToken: string);
    /**
     * Extract rich diff information with full semantic context
     */
    getSemanticDiff(owner: string, repo: string, prNumber: number): Promise<SemanticDiff>;
    /**
     * Parse files with full semantic context
     */
    private parseFilesWithContext;
    /**
     * Parse individual file diff with semantic understanding
     */
    private parseFileDiff;
    /**
     * Detect file type based on path and extension
     */
    private detectFileType;
    /**
     * Parse diff hunks with line-level detail
     */
    private parseDiffHunks;
    /**
     * Extract semantic context from hunk header
     */
    private extractSemanticContext;
    /**
     * Determine if a line change is a key change
     */
    private isKeyChange;
    /**
     * Extract import changes from hunks
     */
    private extractImportChanges;
    /**
     * Extract export changes from hunks
     */
    private extractExportChanges;
    /**
     * Extract dependencies from imports
     */
    private extractDependencies;
    /**
     * Analyze semantic changes in the code
     */
    private analyzeSemanticChanges;
    /**
     * Detect API changes
     */
    private detectAPIChange;
    /**
     * Detect new features
     */
    private detectNewFeature;
    /**
     * Detect bug fixes
     */
    private detectBugFix;
    /**
     * Extract symbols from changes
     */
    private extractSymbols;
    /**
     * Analyze cross-file dependencies
     */
    private analyzeDependencies;
    /**
     * Resolve import path to actual file
     */
    private resolveImportPath;
    /**
     * Get the file being tested
     */
    private getTestedFile;
    /**
     * Identify shared components across files
     */
    private identifySharedComponents;
    /**
     * Detect component type from name and context
     */
    private detectComponentType;
    /**
     * Detect business patterns in changes
     */
    private detectBusinessPatterns;
    /**
     * Calculate total complexity score
     */
    private calculateTotalComplexity;
}
