import { ConsolidatedTheme } from '@/mindmap/types/similarity-types';
import { ReviewResult, ReviewConfig } from '../types/review-types';
/**
 * Main review service that orchestrates Phase 2 code review
 * Implements Week 1 strategy: Basic node review with AI analysis
 */
export declare class ReviewService {
    private apiKey;
    private claudeClient;
    private config;
    constructor(apiKey: string, config?: ReviewConfig);
    /**
     * Production: Review themes from Phase 1 output
     */
    reviewThemes(themes: ConsolidatedTheme[]): Promise<ReviewResult>;
    /**
     * Development: Review from test-output file
     */
    reviewFromTestOutput(filename?: string): Promise<ReviewResult>;
    /**
     * Review a single theme node (Week 1 strategy: basic node review)
     */
    private reviewSingleNode;
    /**
     * AI determines node type based on context
     */
    private classifyNodeType;
    /**
     * AI analyzes node for review findings
     */
    private analyzeNodeFindings;
    /**
     * Calculate review confidence based on available context
     */
    private calculateReviewConfidence;
    /**
     * Determine overall recommendation from node reviews
     */
    private determineOverallRecommendation;
    /**
     * Generate human-readable review summary
     */
    private generateReviewSummary;
}
