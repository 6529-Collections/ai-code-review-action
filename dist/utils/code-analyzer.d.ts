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
    };
    contextSummary: string;
    significantChanges: string[];
}
export declare class CodeAnalyzer {
    private static readonly FUNCTION_PATTERNS;
    private static readonly CLASS_PATTERNS;
    private static readonly IMPORT_PATTERNS;
    static analyzeCodeChanges(changes: CodeChange[]): SmartContext;
    static processChangedFile(filename: string, diffPatch: string, changeType: 'added' | 'modified' | 'deleted' | 'renamed', linesAdded: number, linesRemoved: number): CodeChange;
    private static analyzeFileMetrics;
    private static extractChangePatterns;
    private static extractFunctions;
    private static extractClasses;
    private static extractImports;
    private static extractImportChanges;
    private static getFileType;
    private static isTestFile;
    private static isConfigFile;
    private static buildContextSummary;
    private static extractSignificantChanges;
}
