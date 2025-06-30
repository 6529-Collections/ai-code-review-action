import { MindmapNode, NodeSuggestion, SemanticDiff } from '../types/mindmap-types';
/**
 * AI service for mindmap generation with PRD-aligned prompts
 * Creates self-contained nodes with natural depth detection
 */
export declare class AIMindmapService {
    private claudeClient;
    constructor(anthropicApiKey: string);
    /**
     * Determine if a node should be expanded further
     * PRD: "AI decides when further decomposition is needed"
     */
    shouldExpandNode(node: MindmapNode, currentDepth: number): Promise<ExpansionDecision>;
    /**
     * Build expansion prompt following PRD guidelines
     * Every node must be self-contained and understandable
     */
    private buildExpansionPrompt;
    /**
     * Format code preview for prompt
     * Shows representative snippets without overwhelming
     */
    private formatCodePreview;
    /**
     * Validate and clean suggested children
     */
    private validateSuggestions;
    /**
     * Generate initial theme suggestions from semantic diff
     * Used at the root level to identify major themes
     */
    generateRootThemes(semanticDiff: SemanticDiff): Promise<ThemeSuggestion[]>;
    /**
     * Build prompt for root theme generation
     */
    private buildRootThemePrompt;
    /**
     * Group files by type for summary
     */
    private groupFilesByType;
    /**
     * Calculate total lines changed
     */
    private calculateTotalLines;
    /**
     * Summarize semantic changes for prompt
     */
    private summarizeSemanticChanges;
    /**
     * Validate theme suggestions
     */
    private validateThemeSuggestions;
    /**
     * Trim text to word limit
     */
    private trimToLimit;
    /**
     * Generate contextual explanation for code in a specific theme
     * PRD: "Same code shown differently based on usage context"
     */
    generateContextualExplanation(code: CodeDiff, viewingNode: MindmapNode): Promise<string>;
}
interface ExpansionDecision {
    shouldExpand: boolean;
    isAtomic: boolean;
    atomicReason?: string;
    suggestedChildren?: NodeSuggestion[];
    confidence: number;
}
interface ThemeSuggestion {
    name: string;
    businessValue: string;
    description: string;
    affectedFiles: string[];
    confidence: number;
}
interface CodeDiff {
    file: string;
    hunks: DiffHunk[];
    fileContext: FileContext;
    ownership: 'primary' | 'reference';
    contextualMeaning?: string;
}
interface DiffHunk {
    oldStart: number;
    oldLines: number;
    newStart: number;
    newLines: number;
    changes: LineChange[];
    semanticContext?: string;
}
interface LineChange {
    type: 'add' | 'delete' | 'context';
    lineNumber: number;
    content: string;
    isKeyChange?: boolean;
}
interface FileContext {
    functionName?: string;
    className?: string;
    namespace?: string;
    startLine: number;
    endLine: number;
    contextType: 'function' | 'class' | 'module' | 'config' | 'test';
}
export {};
