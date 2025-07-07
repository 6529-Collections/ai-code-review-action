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
    granularityScore: number;
    depthAppropriatenessScore: number;
    businessValueScore: number;
    testBoundaryScore: number;
}
/**
 * Result of consistency check stage
 */
export interface ConsistencyCheckResult {
    isConsistent: boolean;
    issues: string[];
    adjustedDecision?: ValidationResult;
    consistencyScore: number;
}
/**
 * Complete multi-stage decision with audit trail
 */
export interface MultiStageDecision {
    analysis: ThemeAnalysis;
    validation: ValidationResult;
    consistencyCheck?: ConsistencyCheckResult;
    finalDecision: ExpansionDecision;
    decisionTrace: string[];
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
    separableConcerns: number;
    codeComplexity: 'low' | 'medium' | 'high';
    granularityScore: number;
    depthScore: number;
    businessScore: number;
    testScore: number;
    expanded: boolean;
    confidence: number;
    corrected: boolean;
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
export declare const DEFAULT_MULTI_STAGE_CONFIG: MultiStageConfig;
