import { PRCommentFormatter } from './utils/pr-comment-formatter';
import { ReviewResult } from './types/review-types';

/**
 * Demo script to show how PR comments would look using actual review data
 */

// Mock review result based on our actual test data
const mockReviewResult: ReviewResult = {
  overallRecommendation: 'needs-discussion',
  summary:
    'Reviewed 3 changes (1 integration-hybrid, 2 atomic-technical). Found 16 issues: 0 critical, 6 major, 6 minor. Average confidence: 93.3%',
  processingTime: 87863,
  metadata: {
    totalNodes: 3,
    averageConfidence: 0.9333333333333332,
    timestamp: new Date().toISOString(),
  },
  nodeReviews: [
    {
      nodeId: 'merged-1752057459201-xbodyfyg7',
      nodeName: 'Enable Automated Code Quality Feedback',
      nodeType: 'integration-hybrid',
      confidence: 0.9999999999999999,
      processingTime: 23657,
      findings: {
        riskLevel: 'medium',
        issues: [
          {
            severity: 'major',
            category: 'logic',
            description:
              'Inconsistent development mode logic: SKIP_PHASE1 environment variable is confusing since it actually runs Phase 2 review in development mode, not skipping Phase 1',
            suggestedFix:
              'Rename SKIP_PHASE1 to DEV_MODE_PHASE2_ONLY or similar to clarify intent',
          },
          {
            severity: 'major',
            category: 'logic',
            description:
              'Double execution risk: shouldRunReview logic could cause Phase 2 to run twice - once in development mode block and once in normal flow',
            suggestedFix:
              'Add early return after development mode execution or restructure control flow',
          },
          {
            severity: 'minor',
            category: 'performance',
            description:
              'Redundant ReviewService instantiation: Created twice when both development mode and normal review run',
            suggestedFix: 'Extract service creation to avoid duplication',
          },
        ],
        strengths: [
          'Good separation of concerns with ReviewService integration',
          'Proper performance tracking for review phases',
          'Graceful error handling with logging for review failures',
        ],
        testRecommendations: [
          'Integration test for development mode (DEV_MODE_PHASE2_ONLY=true) execution path',
          'Integration test for normal Phase 2 review execution',
          'Test error handling when ReviewService fails in both modes',
        ],
      },
    },
    {
      nodeId: 'theme-saveReviewResults',
      nodeName: 'Add saveReviewResults method to OutputSaver class',
      nodeType: 'atomic-technical',
      confidence: 0.85,
      processingTime: 15000,
      findings: {
        riskLevel: 'low',
        issues: [
          {
            severity: 'minor',
            category: 'style',
            description: 'Redundant data structure in savedReview object',
            suggestedFix:
              'Remove redundant metadata fields and only store reviewResult',
          },
        ],
        strengths: [
          'Clean method signature and implementation',
          'Proper error handling with file operations',
        ],
        testRecommendations: [
          'Unit test for file saving functionality',
          'Test error handling for disk write failures',
        ],
      },
    },
  ],
};

// Generate preview comments
export function generateCommentPreviews(): void {
  console.log('='.repeat(80));
  console.log('MAIN REVIEW COMMENT PREVIEW');
  console.log('='.repeat(80));
  console.log(PRCommentFormatter.formatMainComment(mockReviewResult));

  console.log('\n\n');
  console.log('='.repeat(80));
  console.log('DETAILED NODE COMMENT PREVIEW');
  console.log('='.repeat(80));
  console.log(
    PRCommentFormatter.formatNodeDetailComment(mockReviewResult.nodeReviews[0])
  );

  console.log('\n\n');
  console.log('='.repeat(80));
  console.log('INLINE COMMENT PREVIEW');
  console.log('='.repeat(80));
  console.log(
    PRCommentFormatter.formatInlineComment(
      mockReviewResult.nodeReviews[0].findings.issues[0],
      mockReviewResult.nodeReviews[0].nodeName
    )
  );
}

// Run preview if called directly
if (require.main === module) {
  generateCommentPreviews();
}
