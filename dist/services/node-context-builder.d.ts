import { ConsolidatedTheme } from '../types/similarity-types';
/**
 * NodeContextBuilder ensures every theme node has complete context
 * Implements PRD: "Every node MUST have ALL context needed to understand it"
 */
export declare class NodeContextBuilder {
    private gitDiffAnalyzer;
    private codeAnalyzer;
    constructor();
    /**
     * Build complete context for a theme node
     * Ensures node is self-contained without parent dependency
     */
    buildNodeContext(theme: ConsolidatedTheme, diffContent?: string, parentContext?: NodeContext): Promise<NodeContext>;
    /**
     * Build context for each file in the theme
     */
    private buildFileContexts;
    /**
     * Build context for methods/functions
     */
    private buildMethodContexts;
    /**
     * Extract business context ensuring self-containment
     */
    private extractBusinessContext;
    /**
     * Build complete technical context
     */
    private buildTechnicalContext;
    /**
     * Validate that context is complete
     */
    private validateContextCompleteness;
    /**
     * Helper: Infer file purpose from path
     */
    private inferFilePurpose;
    /**
     * Helper: Describe a change in natural language
     */
    private describeChange;
    /**
     * Helper: Extract imports from code context
     */
    private extractImports;
    /**
     * Helper: Extract exports from code context
     */
    private extractExports;
    /**
     * Helper: Find related files based on imports
     */
    private findRelatedFiles;
    /**
     * Helper: Find which file contains a method
     */
    private findMethodFile;
    /**
     * Helper: Infer method purpose from name
     */
    private inferMethodPurpose;
    /**
     * Helper: Extract method signature from code
     */
    private extractMethodSignature;
    /**
     * Helper: Extract method dependencies
     */
    private extractMethodDependencies;
    /**
     * Helper: Find related tests
     */
    private findRelatedTests;
    /**
     * Helper: Assess business impact
     */
    private assessBusinessImpact;
    /**
     * Helper: Generate user story
     */
    private generateUserStory;
    /**
     * Helper: Generate acceptance criteria
     */
    private generateAcceptanceCriteria;
    /**
     * Helper: Determine change type
     */
    private determineChangeType;
    /**
     * Helper: Assess complexity
     */
    private assessComplexity;
    /**
     * Helper: Extract dependencies
     */
    private extractDependencies;
    /**
     * Helper: Determine testing strategy
     */
    private determineTestingStrategy;
    /**
     * Helper: Identify code patterns
     */
    private identifyCodePatterns;
    /**
     * Helper: Check if context represents atomic change
     */
    private isAtomicContext;
}
/**
 * Complete context for a theme node
 */
export interface NodeContext {
    themeId: string;
    themeName: string;
    description: string;
    files: FileContext[];
    methods: MethodContext[];
    businessContext: BusinessContext;
    technicalContext: TechnicalContext;
    metrics: {
        totalFiles: number;
        totalLines: number;
        totalMethods: number;
        isAtomic: boolean;
    };
    parentReference?: {
        themeId: string;
        themeName: string;
        purpose: string;
    };
    isComplete: boolean;
    missingContext: string[];
}
/**
 * Context for a single file
 */
export interface FileContext {
    path: string;
    purpose: string;
    changes: Array<{
        type: 'added' | 'modified' | 'deleted';
        startLine: number;
        endLine: number;
        description: string;
        methods: string[];
        classes: string[];
    }>;
    imports: string[];
    exports: string[];
    relatedFiles: string[];
}
/**
 * Context for a method/function
 */
export interface MethodContext {
    name: string;
    file: string;
    purpose: string;
    signature: string;
    dependencies: string[];
    tests: string[];
}
/**
 * Business context
 */
export interface BusinessContext {
    purpose: string;
    impact: string;
    userStory: string;
    acceptanceCriteria: string[];
}
/**
 * Technical context
 */
export interface TechnicalContext {
    changeType: ChangeType;
    complexity: ComplexityLevel;
    dependencies: string[];
    testingStrategy: string;
    codePatterns: string[];
}
/**
 * Change types
 */
export type ChangeType = 'feature' | 'bugfix' | 'refactor' | 'enhancement' | 'test' | 'docs' | 'cleanup';
/**
 * Complexity levels
 */
export type ComplexityLevel = 'trivial' | 'simple' | 'moderate' | 'complex' | 'very-complex';
