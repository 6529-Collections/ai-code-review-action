/**
 * Represents a single change in a file
 */
export interface CodeChange {
    file: string;
    type: 'added' | 'modified' | 'deleted';
    startLine: number;
    endLine: number;
    linesAdded: number;
    linesRemoved: number;
    content: string;
    diff: string;
    methods?: string[];
    classes?: string[];
    imports?: string[];
}
/**
 * Represents analyzed diff results
 */
export interface DiffAnalysis {
    files: Map<string, CodeChange[]>;
    totalFiles: number;
    totalLinesAdded: number;
    totalLinesRemoved: number;
    totalMethods: string[];
    totalClasses: string[];
    changeTypes: Map<string, number>;
}
/**
 * Service for analyzing git diffs to extract exact change information
 */
export declare class GitDiffAnalyzer {
    private readonly METHOD_REGEX;
    private readonly CLASS_REGEX;
    private readonly IMPORT_REGEX;
    /**
     * Analyze a git diff to extract structured change information
     */
    analyzeDiff(diffContent: string): DiffAnalysis;
    /**
     * Extract file name from diff header
     */
    private extractFileName;
    /**
     * Parse hunk header to get line numbers
     */
    private parseHunkHeader;
    /**
     * Extract code elements (methods, classes, imports) from a line
     */
    private extractCodeElements;
    /**
     * Finalize current change and add to changes list
     */
    private finalizeCurrentChange;
    /**
     * Check if a change is valid (has actual modifications)
     */
    private isValidChange;
    /**
     * Determine the type of file change
     */
    private determineFileChangeType;
    /**
     * Get a summary of changes for a specific file
     */
    getFileSummary(analysis: DiffAnalysis, filePath: string): string;
    /**
     * Check if changes are atomic (single concern, testable)
     */
    isAtomicChange(analysis: DiffAnalysis): boolean;
}
