#!/usr/bin/env node

/**
 * Simple test script to verify PR comment posting works
 * Run this during manual workflow_dispatch to test comment functionality
 */

const { GitHubCommentService } = require('./dist/review/services/github-comment-service');

// Mock review result for testing
const mockReviewResult = {
  overallRecommendation: 'approve',
  confidence: 85,
  summary: 'Test comment posting - everything looks good!',
  nodeReviews: [
    {
      nodeName: 'Test Node',
      findings: {
        issues: [
          {
            severity: 'minor',
            description: 'This is a test issue',
            suggestedFix: 'This is a test fix'
          }
        ],
        riskLevel: 'low'
      }
    }
  ]
};

async function testCommentPosting() {
  console.log('🧪 Testing PR comment posting...');
  
  // Log environment variables for debugging
  console.log('Environment check:');
  console.log('- GITHUB_CONTEXT_ISSUE_NUMBER:', process.env.GITHUB_CONTEXT_ISSUE_NUMBER);
  console.log('- GITHUB_CONTEXT_PR_BASE_SHA:', process.env.GITHUB_CONTEXT_PR_BASE_SHA);
  console.log('- GITHUB_CONTEXT_PR_HEAD_SHA:', process.env.GITHUB_CONTEXT_PR_HEAD_SHA);
  
  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) {
    console.error('❌ GITHUB_TOKEN not found');
    process.exit(1);
  }
  
  try {
    const commentService = new GitHubCommentService(githubToken);
    
    console.log('📝 Posting test comment...');
    await commentService.postMainReviewComment(mockReviewResult);
    
    console.log('✅ Test comment posted successfully!');
    
  } catch (error) {
    console.error('❌ Failed to post test comment:', error.message);
    process.exit(1);
  }
}

testCommentPosting();