/**
 * Phase 1: Mindmap Generation Entry Point
 *
 * This module exports the main functionality for hierarchical mindmap generation
 * from pull request changes using AI-powered theme analysis.
 */
export { ThemeService } from './services/theme-service';
export { ThemeSimilarityService } from './services/theme-similarity';
export { ThemeExpansionService } from './services/theme-expansion';
export { ThemeNamingService } from './services/theme-naming';
export { Theme, CodeChunk, ChunkAnalysis, ThemePlacement, LiveContext, ChunkAnalysisResult, ThemeAnalysisResult, } from '@/shared/types/theme-types';
export { ConsolidatedTheme, ConsolidationConfig, SimilarityMetrics, AISimilarityResult, } from './types/similarity-types';
export { MindmapNode } from './types/mindmap-types';
