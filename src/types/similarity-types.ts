import { Theme } from '../services/theme-service';

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
  level: number; // 0=root, 1=child, 2=grandchild
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
  consolidationMethod: 'merge' | 'hierarchy' | 'single';
}

export interface ConsolidationConfig {
  similarityThreshold: number; // 0.8 - threshold for merging
  maxThemesPerParent: number; // 5 - max child themes
  minThemesForParent: number; // 2 - min themes to create parent
  confidenceWeight: number; // 0.3 - how much confidence affects merging
  businessDomainWeight: number; // 0.4 - importance of business similarity
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
