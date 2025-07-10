/**
 * Core review result types for Phase 2
 */
export interface ReviewResult {
  overallRecommendation: 'approve' | 'request-changes' | 'needs-discussion';
  summary: string;
  nodeReviews: NodeReview[];
  processingTime: number;
  metadata: {
    totalNodes: number;
    averageConfidence: number;
    timestamp: string;
  };
}

/**
 * Review analysis for a single mindmap node
 */
export interface NodeReview {
  nodeId: string;
  nodeName: string;
  nodeType: 'atomic-technical' | 'business-feature' | 'integration-hybrid';
  findings: ReviewFindings;
  confidence: number;
  processingTime: number;
}

/**
 * Review findings and analysis results
 */
export interface ReviewFindings {
  issues: ReviewIssue[];
  strengths: string[];
  testRecommendations: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Individual issue found during review
 */
export interface ReviewIssue {
  severity: 'critical' | 'major' | 'minor' | 'suggestion';
  category: 'logic' | 'security' | 'performance' | 'style' | 'test';
  description: string;
  suggestedFix?: string;
  codeContext?: string;
  
  // File/line context from Phase 1 theme data
  locationContext?: {
    filePath: string;        // From theme.affectedFiles
    functionName?: string;   // From theme.mainFunctionsChanged
    className?: string;      // From theme.mainClassesChanged
    lineNumber?: number;     // Parsed from diffHunk
    codeSnippet?: string;    // From theme.codeExamples
  };
}

/**
 * Node type classification response from AI
 */
export interface NodeTypeClassification {
  nodeType: 'atomic-technical' | 'business-feature' | 'integration-hybrid';
  reasoning: string;
  confidence: number;
}

/**
 * Review configuration options
 */
export interface ReviewConfig {
  skipPhase1?: boolean;
  testOutputFile?: string;
  maxRetries?: number;
  timeoutMs?: number;
}

/**
 * File context mapping for location-aware review analysis
 */
export interface FileContextMap {
  files: string[];
  codeExamples: Array<{ file: string; snippet: string; description: string; }>;
  functions: string[];
  classes: string[];
  diffHunks: DiffHunkInfo[];
}

/**
 * Parsed diff hunk information with line numbers
 */
export interface DiffHunkInfo {
  oldLineStart: number;
  newLineStart: number;
  content: string;
  filePath?: string;
}