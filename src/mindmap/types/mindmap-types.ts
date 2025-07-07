/**
 * Core types for PRD-aligned dynamic mindmap with complete context at every level
 * Based on PRD vision: Self-organizing mindmap adapting depth to code complexity
 */

/**
 * Complete node information with self-contained context
 * PRD: "Every node has ALL context needed to understand it"
 */
export interface MindmapNode {
  // Identity
  id: string; // Hierarchical format: parent_type_index_uuid
  name: string; // Clear, contextual title (max 8 words per PRD)
  level: number; // 0=root, dynamic depth based on complexity

  // Complete context (PRD lines 58-62)
  description: string; // Detailed explanation (1-3 sentences)
  businessContext: string; // Why this change matters
  technicalContext: string; // What this change does

  // Code ownership with full traceability
  codeDiff: CodeDiff[]; // THIS node's specific changes only
  affectedFiles: string[]; // Files touched by this node

  // Metrics for this node
  metrics: NodeMetrics;

  // Hierarchy
  parentId?: string;
  children: MindmapNode[];

  // Cross-references for intelligent overlap (PRD lines 86-97)
  crossReferences: CrossReference[];
  isPrimary: boolean; // Is this the primary location for this code?

  // AI decision metadata
  atomicReason?: string; // Why expansion stopped here
  expansionConfidence: number; // AI confidence in expansion decision
}

/**
 * Detailed code diff with semantic context
 */
export interface CodeDiff {
  file: string;
  hunks: DiffHunk[]; // Specific code changes for this node
  fileContext: FileContext; // Function/class containing changes
  ownership: 'primary' | 'reference'; // PRD: Primary vs secondary context
  contextualMeaning?: string; // AI-extracted semantic meaning
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
  semanticContext?: string; // What this hunk accomplishes
}

/**
 * Individual line change
 */
export interface LineChange {
  type: 'add' | 'delete' | 'context';
  lineNumber: number;
  content: string;
  isKeyChange?: boolean; // AI-identified critical line
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
  nodeId: string; // ID of related node
  relationship: CrossReferenceType;
  context: string; // Why this reference exists
  bidirectional: boolean; // Does the other node reference back?
}

export type CrossReferenceType =
  | 'uses' // This node uses code from referenced node
  | 'used-by' // This node is used by referenced node
  | 'modifies' // This node modifies code defined in referenced node
  | 'modified-by' // This node is modified by referenced node
  | 'depends-on' // This node depends on referenced node
  | 'dependency-of' // This node is a dependency of referenced node
  | 'shared-utility' // Both nodes use same utility
  | 'related-feature'; // Nodes implement related features

/**
 * Node metrics for complexity assessment
 */
export interface NodeMetrics {
  complexity: 'low' | 'medium' | 'high';
  fileCount: number;
  testCoverage?: number; // If test changes included
}

/**
 * Direct AI code assignment for child nodes (no mechanical matching)
 */
export interface DirectChildAssignment {
  name: string; // Clear title (max 8 words)
  description: string; // What this child does
  businessValue: string; // User impact (max 12 words)
  technicalPurpose: string; // What it does (max 10 words)
  assignedCode: CodeDiff[]; // Complete CodeDiff objects assigned by AI
  ownership: 'primary' | 'reference'; // PRD: Primary vs secondary context
  contextualMeaning?: string; // How this code is used in THIS child's context
  crossReferences?: CrossReference[]; // References to other nodes
  rationale: string; // Why this should be a separate node
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
  oldPath?: string; // For renames
  isNew: boolean;
  isDeleted: boolean;
  isRenamed: boolean;
  hunks: DiffHunk[];
  imports: ImportChange[];
  exports: ExportChange[];
  dependencies: string[]; // Other files this depends on
  semanticChanges: SemanticChange[]; // High-level understanding
}

export type FileType =
  | 'source'
  | 'test'
  | 'config'
  | 'documentation'
  | 'style'
  | 'build'
  | 'data';

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
  affectedSymbols: string[]; // Functions, classes, etc.
}

export type SemanticChangeType =
  | 'api-change'
  | 'behavior-change'
  | 'performance-improvement'
  | 'bug-fix'
  | 'refactoring'
  | 'new-feature'
  | 'deprecation';

/**
 * Cross-file relationships for understanding impact
 */
export interface FileRelationship {
  sourceFile: string;
  targetFile: string;
  relationshipType: 'imports' | 'extends' | 'implements' | 'uses' | 'tests';
  symbols: string[]; // Specific symbols involved
}

/**
 * Shared component identification
 */
export interface SharedComponent {
  id: string;
  type: 'function' | 'class' | 'constant' | 'type' | 'utility';
  name: string;
  definedIn: string; // Primary file
  usedIn: string[]; // All files using this
  modifications: ComponentModification[];
}

export interface ComponentModification {
  file: string;
  type: 'definition' | 'usage';
  changeType: 'added' | 'modified' | 'removed';
  context: string; // How it's being used/modified
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

export type BusinessPatternType =
  | 'user-flow'
  | 'data-processing'
  | 'api-endpoint'
  | 'ui-component'
  | 'business-logic'
  | 'infrastructure'
  | 'configuration'
  | 'testing';

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
  };
  duplication: {
    score: number; // 0-1, lower is better
    issues: DuplicationIssue[];
  };
  contextCompleteness: {
    score: number; // 0-1, higher is better
    incompleteNodes: string[];
  };
  issues: ValidationIssue[];
}

export interface DuplicationIssue {
  code: string;
  locations: Array<{ nodeId: string; file: string; line: number }>;
  severity: 'low' | 'medium' | 'high';
}

export interface ValidationIssue {
  type:
    | 'missing-code'
    | 'excessive-duplication'
    | 'incomplete-context'
    | 'orphaned-node';
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
  uuid: string; // Short UUID for uniqueness
}

/**
 * Options for mindmap generation
 */
export interface MindmapOptions {
  maxDepth?: number; // Default: unlimited (per PRD)
  crossReferenceThreshold?: number; // Min similarity for cross-refs (0-1)
  enablePatternDetection?: boolean;
  enableSmartDuplication?: boolean;
  confidenceThreshold?: number; // Min confidence for AI decisions
}

/**
 * AI-driven business domain classification result
 * Replaces mechanical keyword matching with semantic understanding
 */
export interface AIDomainClassification {
  domain: string; // Clear business domain (max 5 words)
  userValue: string; // End user benefit (max 12 words)
  businessCapability: string; // What this enables users to do (max 15 words)
  confidence: number; // 0.0-1.0 confidence score
  reasoning: string; // Why this domain (max 20 words)
  subDomains?: string[]; // Specific user flows within capability
  crossCuttingConcerns?: string[]; // Domains this also affects
  userJourney?: string; // Step in user workflow this improves
  businessMetrics?: string[]; // Metrics this improvement could affect
}

/**
 * AI-driven semantic change analysis result
 * Replaces regex pattern matching with contextual understanding
 */
export interface AISemanticAnalysis {
  changeType: SemanticChangeType; // Primary nature of change
  semanticImpact: 'breaking' | 'enhancement' | 'fix' | 'internal'; // Impact level
  userImpact: string; // Description of user-visible impact (max 20 words)
  technicalNature: string; // What technically changed (max 15 words)
  affectedCapabilities: string[]; // List of affected features/capabilities
  confidence: number; // 0.0-1.0 confidence score
  reasoning: string; // Classification reasoning (max 25 words)
  filePurpose?: string; // AI-determined file purpose from content
  relatedChanges?: string[]; // IDs of semantically related changes
}

/**
 * Enhanced file context with AI understanding
 * Replaces path-based file type detection
 */
export interface AIFileContext extends FileContext {
  actualPurpose: string; // AI-determined actual purpose from content
  businessRelevance: string; // How this file relates to business logic
  technicalRole: string; // Technical role in the system
  userFacing: boolean; // Whether changes affect user experience
  architecturalSignificance: 'high' | 'medium' | 'low'; // System impact level
}

/**
 * AI prompt context for semantic analysis
 */
export interface AIAnalysisContext {
  filePath: string;
  completeDiff: string;
  surroundingContext: string;
  commitMessage?: string;
  prDescription?: string;
  fileHistory?: string; // Recent changes to understand evolution
  dependencies?: string[]; // Files this depends on
  dependents?: string[]; // Files that depend on this
}
