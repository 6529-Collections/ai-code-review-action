import { ReviewResult, NodeReview, ReviewIssue } from '../types/review-types';
/**
 * Formats review results into well-structured GitHub PR comments
 */
export declare class PRCommentFormatter {
    /**
     * Generate main review comment with overall findings
     */
    static formatMainComment(reviewResult: ReviewResult): string;
    /**
     * Generate detailed comment for a specific node
     */
    static formatNodeDetailComment(nodeReview: NodeReview): string;
    /**
     * Generate concise inline comment for specific issues
     */
    static formatInlineComment(issue: ReviewIssue, nodeContext?: string): string;
    private static getRecommendationEmoji;
    private static formatRecommendation;
    private static formatNodeType;
    private static formatRiskLevel;
    private static getSeverityEmoji;
    private static formatIssue;
    private static formatNodeReviewSummary;
    private static getNodeTypeIcon;
    private static getRiskEmoji;
    private static countIssuesBySeverity;
}
