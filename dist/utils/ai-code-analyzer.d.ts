export interface CodeChange {
    file: string;
    diffHunk: string;
    changeType: 'added' | 'modified' | 'deleted' | 'renamed';
    linesAdded: number;
    linesRemoved: number;
    functionsChanged: string[];
    classesChanged: string[];
    importsChanged: string[];
    fileType: string;
    isTestFile: boolean;
    isConfigFile: boolean;
    architecturalPatterns?: string[];
    businessDomain?: string;
    codeComplexity?: 'low' | 'medium' | 'high';
    semanticDescription?: string;
}
export interface SmartContext {
    fileMetrics: {
        totalFiles: number;
        fileTypes: string[];
        hasTests: boolean;
        hasConfig: boolean;
        codeComplexity: 'low' | 'medium' | 'high';
    };
    changePatterns: {
        newFunctions: string[];
        modifiedFunctions: string[];
        newImports: string[];
        removedImports: string[];
        newClasses: string[];
        modifiedClasses: string[];
        architecturalPatterns: string[];
        businessDomains: string[];
    };
    contextSummary: string;
    significantChanges: string[];
}
/**
 * AI-powered code analyzer that replaces regex-based analysis
 * Uses Claude to understand code structure across all programming languages
 */
export declare class AICodeAnalyzer {
    private cache;
    private claudeClient;
    constructor(anthropicApiKey: string);
    /**
     * Analyze multiple code changes with AI and build smart context
     * Replaces the static analyzeCodeChanges method
     */
    analyzeCodeChanges(changes: CodeChange[]): Promise<SmartContext>;
    /**
     * Process a single changed file with AI analysis
     * Replaces the static processChangedFile method
     */
    processChangedFile(filename: string, diffPatch: string, changeType: 'added' | 'modified' | 'deleted' | 'renamed', linesAdded: number, linesRemoved: number): Promise<CodeChange>;
    /**
     * Process multiple files concurrently using ConcurrencyManager
     */
    processChangedFilesConcurrently(files: Array<{
        filename: string;
        diffPatch: string;
        changeType: 'added' | 'modified' | 'deleted' | 'renamed';
        linesAdded: number;
        linesRemoved: number;
    }>): Promise<CodeChange[]>;
    /**
     * Perform AI analysis on a single file
     */
    private analyzeWithAI;
    /**
     * Build AI prompt for code analysis
     */
    private buildCodeAnalysisPrompt;
    /**
     * Create minimal analysis when AI fails
     */
    private createMinimalAnalysis;
    private detectLanguage;
    private getFileType;
    private isTestFile;
    private isConfigFile;
    private analyzeFileMetrics;
    private extractChangePatterns;
    private buildContextSummary;
    private extractSignificantChanges;
    /**
     * Get cache statistics for monitoring
     */
    getCacheStats(): {
        size: number;
        ttlMs: number;
    };
}
