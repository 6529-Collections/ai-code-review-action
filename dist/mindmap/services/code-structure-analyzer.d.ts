import { ConsolidatedTheme } from '../types/similarity-types';
/**
 * Analyzes code structure to provide intelligent hints for theme expansion
 */
export declare class CodeStructureAnalyzer {
    /**
     * Analyze code structure to generate expansion hints
     */
    analyzeThemeStructure(theme: ConsolidatedTheme): Promise<CodeStructureAnalysis>;
    /**
     * Count distinct functions/methods in code changes
     */
    private countFunctions;
    /**
     * Count distinct classes/interfaces in code changes
     */
    private countClasses;
    /**
     * Count distinct modules/files with significant changes
     */
    private countModules;
    /**
     * Identify types of changes (config, logic, UI, test, etc.)
     */
    private identifyChangeTypes;
    /**
     * Analyze code complexity indicators
     */
    private analyzeComplexity;
    /**
     * Analyze file structure patterns
     */
    private analyzeFileStructure;
}
/**
 * Analysis result containing code structure insights
 */
export interface CodeStructureAnalysis {
    functionCount: number;
    classCount: number;
    moduleCount: number;
    changeTypes: ChangeType[];
    complexityIndicators: ComplexityIndicators;
    fileStructure: FileStructureAnalysis;
}
/**
 * Types of code changes detected
 */
export type ChangeType = 'config' | 'logic' | 'ui' | 'test' | 'types' | 'utils' | 'docs' | 'implementation' | 'imports';
/**
 * Code complexity indicators
 */
export interface ComplexityIndicators {
    hasConditionals: boolean;
    hasLoops: boolean;
    hasErrorHandling: boolean;
    hasAsyncOperations: boolean;
    nestingDepth: number;
    branchingFactor: number;
}
/**
 * File structure analysis
 */
export interface FileStructureAnalysis {
    directories: Set<string>;
    fileExtensions: Set<string>;
    isMultiDirectory: boolean;
    isMultiLanguage: boolean;
    hasTestFiles: boolean;
    hasConfigFiles: boolean;
}
