import { ReviewResult } from '../types/review-types';
/**
 * Service for posting AI review results as GitHub PR comments
 */
export declare class GitHubCommentService {
    private githubToken;
    private octokit;
    private context;
    constructor(githubToken: string);
    /**
     * Post main review comment to PR
     */
    postMainReviewComment(reviewResult: ReviewResult): Promise<void>;
    /**
     * Post detailed comments for nodes with significant issues
     */
    postDetailedNodeComments(reviewResult: ReviewResult): Promise<void>;
    /**
     * Post detailed comment for a specific node
     */
    private postNodeDetailComment;
    /**
     * Set PR review status based on recommendation
     */
    setPRReviewStatus(reviewResult: ReviewResult): Promise<void>;
    /**
     * Post a summary comment with key action items
     */
    postActionItemsSummary(reviewResult: ReviewResult): Promise<void>;
    private isPullRequestContext;
    private getPRNumber;
    private hasSignificantIssues;
    private extractActionItems;
    private formatActionItemsComment;
}
