import { SemanticDiff } from '../../mindmap/types/mindmap-types';
/**
 * Enhanced Git service for semantic diff analysis
 * Provides AI-driven understanding of code changes beyond raw diffs
 * PRD: "AI decides" semantic meaning, replaces mechanical pattern matching
 */
export declare class EnhancedGitService {
    private octokit;
    private aiSemanticAnalyzer;
    constructor(githubToken: string, anthropicApiKey: string);
    /**
     * Extract rich diff information with full semantic context
     */
    getSemanticDiff(owner: string, repo: string, prNumber: number): Promise<SemanticDiff>;
    /**
     * Parse files with full semantic context
     */
    private parseFilesWithContext;
    /**
     * Parse individual file diff with AI-enhanced semantic understanding
     */
    private parseFileDiff;
    /**
     * Detect file type with AI assistance for better accuracy
     * PRD: "File type intelligence" - understand actual purpose, not just extension
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
     * Analyze semantic changes using AI instead of regex patterns
     * PRD: "AI decides" semantic meaning based on contextual understanding
     */
    private analyzeSemanticChangesWithAI;
    /**
     * Extract surrounding context from hunks for AI analysis
     */
    private extractSurroundingContext;
    /**
     * Map AI semantic impact to SemanticChange impact type
     */
    private mapSemanticImpact;
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
