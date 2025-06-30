/**
 * Core types for PRD-aligned dynamic mindmap with complete context at every level
 * Based on PRD vision: Self-organizing mindmap adapting depth to code complexity
 */
/**
 * Complete node information with self-contained context
 * PRD: "Every node has ALL context needed to understand it"
 */
export interface MindmapNode {
    id: string;
    name: string;
    level: number;
    description: string;
    businessContext: string;
    technicalContext: string;
    codeDiff: CodeDiff[];
    affectedFiles: string[];
    metrics: NodeMetrics;
    parentId?: string;
    children: MindmapNode[];
    crossReferences: CrossReference[];
    isPrimary: boolean;
    atomicReason?: string;
    expansionConfidence: number;
}
/**
 * Detailed code diff with semantic context
 */
export interface CodeDiff {
    file: string;
    hunks: DiffHunk[];
    fileContext: FileContext;
    ownership: 'primary' | 'reference';
    contextualMeaning?: string;
}
/**
 * Individual diff hunk with line-level detail
 */
export interface DiffHunk {
    oldStart: number;
    oldLines: number;
    newStart: number;
    newLines: number;
    changes: LineChange[];
    semanticContext?: string;
}
/**
 * Individual line change
 */
export interface LineChange {
    type: 'add' | 'delete' | 'context';
    lineNumber: number;
    content: string;
    isKeyChange?: boolean;
}
/**
 * Context about the file location of changes
 */
export interface FileContext {
    functionName?: string;
    className?: string;
    namespace?: string;
    startLine: number;
    endLine: number;
    contextType: 'function' | 'class' | 'module' | 'config' | 'test';
}
/**
 * Cross-reference for shared code and utilities
 * PRD: "Intelligent cross-referencing" with clear relationships
 */
export interface CrossReference {
    nodeId: string;
    relationship: CrossReferenceType;
    context: string;
    bidirectional: boolean;
}
export type CrossReferenceType = 'uses' | 'used-by' | 'modifies' | 'modified-by' | 'depends-on' | 'dependency-of' | 'shared-utility' | 'related-feature';
/**
 * Node metrics for complexity assessment
 */
export interface NodeMetrics {
    linesAdded: number;
    linesRemoved: number;
    linesModified: number;
    complexity: 'low' | 'medium' | 'high';
    fileCount: number;
    testCoverage?: number;
}
/**
 * Direct AI code assignment for child nodes (no mechanical matching)
 */
export interface DirectChildAssignment {
    name: string;
    description: string;
    businessValue: string;
    technicalPurpose: string;
    assignedCode: CodeDiff[];
    ownership: 'primary' | 'reference';
    contextualMeaning?: string;
    crossReferences?: CrossReference[];
    rationale: string;
}
/**
 * AI expansion decision with direct code assignment
 */
export interface ExpansionDecision {
    shouldExpand: boolean;
    isAtomic: boolean;
    atomicReason?: string;
    children?: DirectChildAssignment[];
    confidence: number;
}
/**
 * Complete semantic diff analysis result
 */
export interface SemanticDiff {
    files: FileDiff[];
    crossFileRelationships: FileRelationship[];
    sharedComponents: SharedComponent[];
    businessPatterns: BusinessPattern[];
    totalComplexity: number;
}
/**
 * Enhanced file diff with semantic understanding
 */
export interface FileDiff {
    path: string;
    fileType: FileType;
    oldPath?: string;
    isNew: boolean;
    isDeleted: boolean;
    isRenamed: boolean;
    hunks: DiffHunk[];
    imports: ImportChange[];
    exports: ExportChange[];
    dependencies: string[];
    semanticChanges: SemanticChange[];
}
export type FileType = 'source' | 'test' | 'config' | 'documentation' | 'style' | 'build' | 'data';
/**
 * Import/export tracking for dependency analysis
 */
export interface ImportChange {
    type: 'added' | 'removed' | 'modified';
    module: string;
    items: string[];
    line: number;
}
export interface ExportChange {
    type: 'added' | 'removed' | 'modified';
    name: string;
    exportType: 'default' | 'named' | 'namespace';
    line: number;
}
/**
 * High-level semantic understanding of changes
 */
export interface SemanticChange {
    type: SemanticChangeType;
    description: string;
    impact: 'breaking' | 'enhancement' | 'fix' | 'refactor';
    affectedSymbols: string[];
}
export type SemanticChangeType = 'api-change' | 'behavior-change' | 'performance-improvement' | 'bug-fix' | 'refactoring' | 'new-feature' | 'deprecation';
/**
 * Cross-file relationships for understanding impact
 */
export interface FileRelationship {
    sourceFile: string;
    targetFile: string;
    relationshipType: 'imports' | 'extends' | 'implements' | 'uses' | 'tests';
    symbols: string[];
}
/**
 * Shared component identification
 */
export interface SharedComponent {
    id: string;
    type: 'function' | 'class' | 'constant' | 'type' | 'utility';
    name: string;
    definedIn: string;
    usedIn: string[];
    modifications: ComponentModification[];
}
export interface ComponentModification {
    file: string;
    type: 'definition' | 'usage';
    changeType: 'added' | 'modified' | 'removed';
    context: string;
}
/**
 * Business pattern detection for intelligent grouping
 */
export interface BusinessPattern {
    type: BusinessPatternType;
    name: string;
    description: string;
    involvedFiles: string[];
    confidence: number;
}
export type BusinessPatternType = 'user-flow' | 'data-processing' | 'api-endpoint' | 'ui-component' | 'business-logic' | 'infrastructure' | 'configuration' | 'testing';
/**
 * Validation result for AI code assignments
 */
export interface CodeAssignmentValidation {
    isComplete: boolean;
    duplicatedLines: string[];
    unassignedLines: string[];
    issues: string[];
}
/**
 * Validation result for mindmap completeness
 */
export interface ValidationResult {
    isComplete: boolean;
    coverage: {
        percentage: number;
        missingFiles: string[];
        missingLines: Array<{
            file: string;
            lines: number[];
        }>;
    };
    duplication: {
        score: number;
        issues: DuplicationIssue[];
    };
    contextCompleteness: {
        score: number;
        incompleteNodes: string[];
    };
    issues: ValidationIssue[];
}
export interface DuplicationIssue {
    code: string;
    locations: Array<{
        nodeId: string;
        file: string;
        line: number;
    }>;
    severity: 'low' | 'medium' | 'high';
}
export interface ValidationIssue {
    type: 'missing-code' | 'excessive-duplication' | 'incomplete-context' | 'orphaned-node';
    nodeId?: string;
    description: string;
    severity: 'warning' | 'error';
}
/**
 * Hierarchical ID components for readable identification
 */
export interface HierarchicalId {
    parentId: string;
    nodeType: 'root' | 'theme' | 'sub' | 'leaf' | 'ref';
    index: number;
    uuid: string;
}
/**
 * Options for mindmap generation
 */
export interface MindmapOptions {
    maxDepth?: number;
    targetLeafSize?: number;
    crossReferenceThreshold?: number;
    enablePatternDetection?: boolean;
    enableSmartDuplication?: boolean;
    confidenceThreshold?: number;
}
