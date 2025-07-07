/**
 * Logger Constants
 * 
 * Centralized constants for logging configuration and service naming
 */

// Standard service names - use UPPERCASE_UNDERSCORE format
export const LoggerServices = {
  // Core application services
  MAIN: 'MAIN',
  PERF: 'PERF',
  PERFORMANCE: 'PERFORMANCE',
  
  // AI and analysis services
  CODE_ANALYSIS: 'CODE_ANALYSIS',
  AI_ANALYZER: 'AI_ANALYZER',
  
  // Theme services
  EXPANSION: 'EXPANSION',
  CONSOLIDATION: 'CONSOLIDATION',
  SIMILARITY: 'SIMILARITY',
  SIMILARITY_HIERARCHICAL: 'SIMILARITY_HIERARCHICAL',
  
  // Cache services
  CACHE_SEMANTIC: 'CACHE_SEMANTIC',
  CACHE_ANALYSIS: 'CACHE_ANALYSIS',
  
  // Claude client services
  CLAUDE_CLIENT: 'CLAUDE_CLIENT',
  
  // Business domain services
  BUSINESS_DOMAIN: 'BUSINESS_DOMAIN',
  
  // Git services
  GIT_SERVICE: 'GIT_SERVICE',
} as const;

// Log level priorities (from logger.ts LogLevel enum)
export const LogLevels = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
  TRACE: 4,
} as const;

// Common message patterns to avoid duplication
export const LogMessages = {
  STARTING_ANALYSIS: 'Starting analysis',
  ANALYSIS_COMPLETE: 'Analysis complete',
  PROCESSING_ITEMS: (count: number, type: string) => `Processing ${count} ${type}`,
  FAILED_OPERATION: (operation: string, error: string) => `${operation} failed: ${error}`,
  CACHE_HIT: (context: string) => `Cache hit for ${context}`,
  CACHE_MISS: (context: string) => `Cache miss for ${context}`,
} as const;

export type LoggerService = typeof LoggerServices[keyof typeof LoggerServices];