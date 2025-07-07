import { Theme } from '@/shared/types/theme-types';

export interface AISimilarityResult {
  nameScore: number;
  descriptionScore: number;
  patternScore: number;
  businessScore: number;
  semanticScore: number;
  shouldMerge: boolean;
  confidence: number;
  reasoning: string;
}

export interface SimilarityMetrics {
  nameScore: number; // 0-1 based on theme name similarity
  descriptionScore: number; // 0-1 based on description similarity
  fileOverlap: number; // 0-1 based on affected files overlap
  patternScore: number; // 0-1 based on code pattern similarity
  businessScore: number; // 0-1 based on business impact similarity
  combinedScore: number; // Weighted combination
}

export interface ConsolidatedTheme {
  id: string;
  name: string;
  description: string;
  level: number; // 0=root, 1=child, 2=grandchild, 3=great-grandchild, etc. (unlimited depth)
  parentId?: string;
  childThemes: ConsolidatedTheme[];

  // Consolidated data from child themes
  affectedFiles: string[];
  confidence: number; // Average of child confidences
  businessImpact: string; // Combined business impact
  codeSnippets: string[];
  context: string;
  lastAnalysis: Date;

  // Consolidation metadata
  sourceThemes: string[]; // IDs of original themes
  consolidationMethod: 'merge' | 'hierarchy' | 'single' | 'expansion';

  // Expansion metadata
  isExpanded?: boolean; // Whether this theme has been expanded
  expansionDepth?: number; // Depth of expansion from original theme
  businessLogicPatterns?: string[]; // Identified business patterns
  userFlowPatterns?: string[]; // Identified user flow patterns

  // Dynamic depth fields (simplified)
  isAtomic?: boolean;
  expansionReason?: string;

  // New consolidation context fields
  consolidationSummary?: string; // Why these were merged
  childThemeSummaries?: string[]; // Quick summary of each child
  combinedTechnicalDetails?: string; // Unified technical description
  unifiedUserImpact?: string; // Combined user value proposition

  // Rich context from Theme
  detailedDescription?: string;
  technicalSummary?: string;
  keyChanges?: string[];
  userScenario?: string;
  mainFunctionsChanged?: string[];
  mainClassesChanged?: string[];
  codeMetrics?: {
    filesChanged: number;
  };
  codeExamples?: Array<{
    file: string;
    description: string;
    snippet: string;
  }>;
}

export interface ConsolidationConfig {
  similarityThreshold: number; // 0.8 - threshold for merging
  maxThemesPerParent: number; // 5 - max child themes
  minThemesForParent: number; // 2 - min themes to create parent

  // Hierarchical expansion configuration
  maxHierarchyDepth: number; // 4 - maximum depth for theme expansion
  expansionEnabled: boolean; // true - whether to enable hierarchical expansion
  crossLevelSimilarityCheck: boolean; // true - check similarity across hierarchy levels
}

export interface MergeDecision {
  action: 'merge' | 'group_under_parent' | 'keep_separate';
  confidence: number;
  reason: string;
  targetThemeId?: string;
}

export interface CachedSimilarity {
  similarity: SimilarityMetrics;
  timestamp: Date;
}

export interface QuickSimilarityResult {
  shouldSkipAI: boolean;
  similarity?: SimilarityMetrics;
  reason: string;
}

export interface ThemePair {
  theme1: Theme;
  theme2: Theme;
  id: string;
}

export interface BatchSimilarityResult {
  pairId: string;
  similarity: AISimilarityResult;
  error?: string;
}
