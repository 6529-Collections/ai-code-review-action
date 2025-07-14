import { ConsolidatedTheme } from '@/mindmap/types/similarity-types';
import { ReviewResult, NodeReview, ReviewConfig } from '../types/review-types';
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
     * Production: Review themes from Phase 1 output using recursive bottom-up approach
     */
    reviewThemes(themes: ConsolidatedTheme[]): Promise<ReviewResult>;
    /**
     * Development: Review from test-output file
     */
    reviewFromTestOutput(filename?: string): Promise<ReviewResult>;
    /**
     * Recursively review a theme and all its children (bottom-up)
     * Children are reviewed first, then their results inform parent review
     * Returns all reviews from this subtree (current theme + all descendants)
     */
    reviewTheme(theme: ConsolidatedTheme): Promise<NodeReview[]>;
    /**
     * AI compresses child review results for parent theme review
     * NO mechanical truncation - only intelligent AI selection
     */
    private compressChildContext;
    /**
     * Generate hierarchy-aware context to help AI understand review focus
     */
    private getHierarchyContext;
    /**
     * Review a single theme node with hierarchy-aware context
     */
    private reviewSingleNodeWithContext;
    /**
     * Review a single theme node (Week 1 strategy: basic node review)
     */
    private reviewSingleNode;
    /**
     * AI determines node type based on context with hierarchy awareness
     */
    private classifyNodeTypeWithContext;
    /**
     * AI determines node type based on context
     */
    private classifyNodeType;
    /**
     * AI analyzes node for review findings with hierarchy awareness
     */
    private analyzeNodeFindingsWithContext;
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
    /**
     * Extract file context from theme data
     */
    private extractFileContext;
    /**
     * Build enhanced code context with file/function information
     */
    private buildEnhancedCodeContext;
    /**
     * Extract diff hunks with line numbers from theme data
     */
    private extractDiffHunks;
    /**
     * Extract file path from diff content
     */
    private extractFileFromDiff;
    /**
     * Enrich findings with location context
     */
    private enrichFindingsWithLocation;
    /**
     * Map issue to specific file location
     */
    private mapIssueToLocation;
}
