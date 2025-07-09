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