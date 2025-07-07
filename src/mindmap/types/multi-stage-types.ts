import { ExpansionDecision } from '../services/ai/ai-expansion-decision-service';

/**
 * Result of unopinionated theme analysis
 */
export interface ThemeAnalysis {
  actualPurpose: string;
  codeComplexity: 'low' | 'medium' | 'high';
  separableConcerns: string[];
  testScenarios: number;
  reviewerPerspective: string;
  codeMetrics: {
    functionCount: number;
    classCount: number;
    distinctOperations: number;
    hasMultipleAlgorithms: boolean;
    hasNaturalBoundaries: boolean;
  };
}

/**
 * Result of validation stage with scoring
 */
export interface ValidationResult {
  shouldExpand: boolean;
  confidence: number;
  reasoning: string;
  correctedFromInitial: boolean;
  validationFindings: string[];
  granularityScore: number; // 0-1, where 0 is over-granular
  depthAppropriatenessScore: number; // 0-1, based on depth context
  businessValueScore: number; // 0-1, expansion value for understanding
  testBoundaryScore: number; // 0-1, test separation clarity
}

/**
 * Result of consistency check stage
 */
export interface ConsistencyCheckResult {
  isConsistent: boolean;
  issues: string[];
  adjustedDecision?: ValidationResult;
  consistencyScore: number; // 0-1, higher is more consistent
}

/**
 * Complete multi-stage decision with audit trail
 */
export interface MultiStageDecision {
  analysis: ThemeAnalysis;
  validation: ValidationResult;
  consistencyCheck?: ConsistencyCheckResult;
  finalDecision: ExpansionDecision;
  decisionTrace: string[]; // Audit trail of decision process
  processingTimeMs: number;
  stagesCompleted: ('analysis' | 'validation' | 'consistency' | 'subthemes')[];
}

/**
 * Metrics for monitoring expansion decisions
 */
export interface ExpansionMetric {
  themeId: string;
  depth: number;
  timestamp: Date;
  
  // Analysis metrics
  separableConcerns: number;
  codeComplexity: 'low' | 'medium' | 'high';
  
  // Validation scores
  granularityScore: number;
  depthScore: number;
  businessScore: number;
  testScore: number;
  
  // Decision outcome
  expanded: boolean;
  confidence: number;
  corrected: boolean;
  
  // Performance
  processingTimeMs: number;
}

/**
 * Configuration for multi-stage processing
 */
export interface MultiStageConfig {
  enableQuickDecisions: boolean;
  enableConsistencyCheck: boolean;
  consistencyVarianceThreshold: number;
  quickDecisionDepthThreshold: number;
  quickDecisionConfidenceThreshold: number;
}

/**
 * Default configuration values
 */
export const DEFAULT_MULTI_STAGE_CONFIG: MultiStageConfig = {
  enableQuickDecisions: true,
  enableConsistencyCheck: true,
  consistencyVarianceThreshold: 0.2,
  quickDecisionDepthThreshold: 15,
  quickDecisionConfidenceThreshold: 0.95
};