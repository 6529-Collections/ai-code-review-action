/**
 * Phase 2 Review Module
 *
 * Provides AI-powered code review functionality that consumes Phase 1 mindmap output
 * and generates comprehensive review analysis following the AI-first philosophy.
 */

// Main services
export { ReviewService } from './services/review-service';
export { TestDataLoader } from './services/test-data-loader';
export { GitHubCommentService } from './services/github-comment-service';

// Utilities
export { PRCommentFormatter } from './utils/pr-comment-formatter';

// Types and interfaces
export * from './types/review-types';

// Re-export commonly used types from other modules for convenience
export type { ConsolidatedTheme } from '@/mindmap/types/similarity-types';
