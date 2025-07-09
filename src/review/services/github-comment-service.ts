import * as github from '@actions/github';
import * as core from '@actions/core';
import { ReviewResult, NodeReview } from '../types/review-types';
import { PRCommentFormatter } from '../utils/pr-comment-formatter';
import { logger } from '@/shared/logger/logger';

/**
 * Service for posting AI review results as GitHub PR comments
 */
export class GitHubCommentService {
  private octokit: ReturnType<typeof github.getOctokit>;
  private context: typeof github.context;
  
  constructor(private githubToken: string) {
    this.octokit = github.getOctokit(githubToken);
    this.context = github.context;
  }
  
  /**
   * Post main review comment to PR
   */
  async postMainReviewComment(reviewResult: ReviewResult): Promise<void> {
    if (!this.isPullRequestContext()) {
      logger.warn('GITHUB_COMMENT', 'Not in PR context, skipping comment posting');
      return;
    }
    
    try {
      const comment = PRCommentFormatter.formatMainComment(reviewResult);
      
      const { data: existingComments } = await this.octokit.rest.issues.listComments({
        owner: this.context.repo.owner,
        repo: this.context.repo.repo,
        issue_number: this.getPRNumber(),
      });
      
      // Check if we already posted a review comment (to update instead of duplicate)
      const existingComment = existingComments.find(c => 
        c.body?.includes('🤖 AI Code Review Results') && c.user?.login === 'github-actions[bot]'
      );
      
      if (existingComment) {
        // Update existing comment
        await this.octokit.rest.issues.updateComment({
          owner: this.context.repo.owner,
          repo: this.context.repo.repo,
          comment_id: existingComment.id,
          body: comment,
        });
        
        logger.info('GITHUB_COMMENT', `Updated existing review comment (ID: ${existingComment.id})`);
      } else {
        // Create new comment
        const { data: newComment } = await this.octokit.rest.issues.createComment({
          owner: this.context.repo.owner,
          repo: this.context.repo.repo,
          issue_number: this.getPRNumber(),
          body: comment,
        });
        
        logger.info('GITHUB_COMMENT', `Posted new review comment (ID: ${newComment.id})`);
      }
      
    } catch (error) {
      logger.error('GITHUB_COMMENT', `Failed to post main review comment: ${error}`);
      throw error;
    }
  }
  
  /**
   * Post detailed comments for nodes with significant issues
   */
  async postDetailedNodeComments(reviewResult: ReviewResult): Promise<void> {
    if (!this.isPullRequestContext()) {
      logger.warn('GITHUB_COMMENT', 'Not in PR context, skipping detailed comments');
      return;
    }
    
    // Only post detailed comments for nodes with critical or multiple major issues
    const significantNodes = reviewResult.nodeReviews.filter(node => 
      this.hasSignificantIssues(node)
    );
    
    if (significantNodes.length === 0) {
      logger.info('GITHUB_COMMENT', 'No nodes require detailed comments');
      return;
    }
    
    logger.info('GITHUB_COMMENT', `Posting detailed comments for ${significantNodes.length} nodes`);
    
    for (const node of significantNodes) {
      await this.postNodeDetailComment(node);
    }
  }
  
  /**
   * Post detailed comment for a specific node
   */
  private async postNodeDetailComment(nodeReview: NodeReview): Promise<void> {
    try {
      const comment = PRCommentFormatter.formatNodeDetailComment(nodeReview);
      
      const { data: newComment } = await this.octokit.rest.issues.createComment({
        owner: this.context.repo.owner,
        repo: this.context.repo.repo,
        issue_number: this.getPRNumber(),
        body: comment,
      });
      
      logger.info('GITHUB_COMMENT', `Posted detailed comment for node "${nodeReview.nodeName}" (ID: ${newComment.id})`);
      
    } catch (error) {
      logger.error('GITHUB_COMMENT', `Failed to post detailed comment for node "${nodeReview.nodeName}": ${error}`);
      // Don't throw - continue with other comments
    }
  }
  
  /**
   * Set PR review status based on recommendation
   */
  async setPRReviewStatus(reviewResult: ReviewResult): Promise<void> {
    if (!this.isPullRequestContext()) {
      logger.warn('GITHUB_COMMENT', 'Not in PR context, skipping review status');
      return;
    }
    
    // Skip setting review status for now - this would require special permissions
    // and might conflict with human reviewers. We'll just post comments.
    
    logger.info('GITHUB_COMMENT', `Review recommendation: ${reviewResult.overallRecommendation}`);
  }
  
  /**
   * Post a summary comment with key action items
   */
  async postActionItemsSummary(reviewResult: ReviewResult): Promise<void> {
    if (!this.isPullRequestContext()) {
      logger.warn('GITHUB_COMMENT', 'Not in PR context, skipping action items summary');
      return;
    }
    
    const actionItems = this.extractActionItems(reviewResult);
    
    if (actionItems.length === 0) {
      logger.info('GITHUB_COMMENT', 'No action items to post');
      return;
    }
    
    try {
      const comment = this.formatActionItemsComment(actionItems, reviewResult.overallRecommendation);
      
      const { data: newComment } = await this.octokit.rest.issues.createComment({
        owner: this.context.repo.owner,
        repo: this.context.repo.repo,
        issue_number: this.getPRNumber(),
        body: comment,
      });
      
      logger.info('GITHUB_COMMENT', `Posted action items summary (ID: ${newComment.id})`);
      
    } catch (error) {
      logger.error('GITHUB_COMMENT', `Failed to post action items summary: ${error}`);
      // Don't throw - this is optional
    }
  }
  
  // Helper methods
  
  private isPullRequestContext(): boolean {
    const eventName = this.context.eventName;
    const issueNumber = this.context.issue?.number;
    const manualPrNumber = process.env.GITHUB_CONTEXT_ISSUE_NUMBER;
    
    logger.info('GITHUB_COMMENT', `PR context check: eventName=${eventName}, issueNumber=${issueNumber}, manualPrNumber=${manualPrNumber}`);
    logger.info('GITHUB_COMMENT', `Full context.issue: ${JSON.stringify(this.context.issue)}`);
    
    const result = eventName === 'pull_request' || 
                   eventName === 'pull_request_target' ||
                   !!issueNumber || // For local testing with issue number
                   !!manualPrNumber; // For manual PR review via workflow_dispatch
    
    logger.info('GITHUB_COMMENT', `PR context result: ${result}`);
    return result;
  }
  
  private getPRNumber(): number {
    // Check manual PR review environment variable first
    if (process.env.GITHUB_CONTEXT_ISSUE_NUMBER) {
      return parseInt(process.env.GITHUB_CONTEXT_ISSUE_NUMBER);
    }
    
    // Fallback to context issue number
    return this.context.issue.number;
  }
  
  private hasSignificantIssues(nodeReview: NodeReview): boolean {
    const criticalIssues = nodeReview.findings.issues.filter(i => i.severity === 'critical').length;
    const majorIssues = nodeReview.findings.issues.filter(i => i.severity === 'major').length;
    
    // Post detailed comment if:
    // - Has any critical issues
    // - Has 2+ major issues  
    // - Has high/critical risk level
    return criticalIssues > 0 || 
           majorIssues >= 2 || 
           ['high', 'critical'].includes(nodeReview.findings.riskLevel);
  }
  
  private extractActionItems(reviewResult: ReviewResult): Array<{
    priority: 'critical' | 'major' | 'minor';
    description: string;
    nodeContext: string;
    suggestedFix?: string;
  }> {
    const actionItems: Array<{
      priority: 'critical' | 'major' | 'minor';
      description: string;
      nodeContext: string;
      suggestedFix?: string;
    }> = [];
    
    reviewResult.nodeReviews.forEach(node => {
      node.findings.issues.forEach(issue => {
        if (['critical', 'major'].includes(issue.severity)) {
          actionItems.push({
            priority: issue.severity as 'critical' | 'major',
            description: issue.description,
            nodeContext: node.nodeName,
            suggestedFix: issue.suggestedFix
          });
        }
      });
    });
    
    // Sort by priority: critical first, then major
    return actionItems.sort((a, b) => {
      const priorityOrder = { critical: 0, major: 1, minor: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }
  
  private formatActionItemsComment(actionItems: Array<{
    priority: 'critical' | 'major' | 'minor';
    description: string;
    nodeContext: string;
    suggestedFix?: string;
  }>, recommendation: string): string {
    const sections = [];
    
    sections.push('## 📋 Action Items from AI Review');
    sections.push('');
    
    if (recommendation === 'request-changes') {
      sections.push('⚠️ **These items must be addressed before merge:**');
    } else {
      sections.push('💡 **Recommended improvements:**');
    }
    sections.push('');
    
    actionItems.forEach((item, index) => {
      const emoji = item.priority === 'critical' ? '🚨' : '⚠️';
      sections.push(`### ${index + 1}. ${emoji} ${item.priority.toUpperCase()}`);
      sections.push(`**Context:** ${item.nodeContext}`);
      sections.push('');
      sections.push(item.description);
      
      if (item.suggestedFix) {
        sections.push('');
        sections.push(`**💡 Suggested fix:** ${item.suggestedFix}`);
      }
      sections.push('');
    });
    
    sections.push('---');
    sections.push('*Generated by AI Code Review Action*');
    
    return sections.join('\n');
  }
}