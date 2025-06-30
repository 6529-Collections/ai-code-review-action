/**
 * Type definitions for AI services to reduce use of 'any'
 */

export interface PromptVariables {
  [key: string]: string | number | boolean | string[] | object;
}

export interface CacheableResponse {
  success: boolean;
  confidence?: number;
  [key: string]: unknown;
}

export interface BatchItem {
  variables: PromptVariables;
  priority?: number;
}

export interface ThemeData {
  name: string;
  description: string;
  files?: string[];
  context?: string;
  domain?: string;
  affectedFiles?: string[];
  keyChanges?: string[];
}

export interface SimilarityPair {
  id: string;
  theme1: ThemeData;
  theme2: ThemeData;
}

export interface DomainData {
  domain: string;
  themes: string[];
  confidence: number;
  userValue: string;
}

export interface BatchSimilarityResult {
  pairId: string;
  shouldMerge: boolean;
  confidence: number;
  scores: {
    name: number;
    description: number;
    pattern: number;
    business: number;
    semantic: number;
  };
}

export interface AIAnalysisResult {
  functionsChanged: string[];
  classesChanged: string[];
  importsChanged: string[];
  fileType: string;
  isTestFile: boolean;
  isConfigFile: boolean;
  architecturalPatterns?: string[];
  businessDomain?: string;
  codeComplexity?: 'low' | 'medium' | 'high';
  semanticDescription?: string;
}

export interface ThemeAnalysisResult {
  themeName: string;
  description: string;
  businessImpact: string;
  confidence: number;
  codePattern: string;
  detailedDescription?: string | null;
  technicalSummary?: string;
  keyChanges?: string[];
  userScenario?: string | null;
  suggestedParent?: string | null;
  mainFunctionsChanged?: string[];
  mainClassesChanged?: string[];
}

export interface SimilarityCheckResult {
  shouldMerge: boolean;
  confidence: number;
  reasoning: string;
  nameScore: number;
  descriptionScore: number;
  patternScore: number;
  businessScore: number;
  semanticScore: number;
}

export interface ExpansionResult {
  shouldExpand: boolean;
  confidence: number;
  subThemes: Array<{
    name: string;
    description: string;
    businessValue: string;
    affectedComponents: string[];
    relatedFiles: string[];
  }>;
  reasoning: string;
}

export interface DomainExtractionResult {
  domains: DomainData[];
}

export interface ThemeNamingResult {
  themeName: string;
  alternativeNames?: string[];
  reasoning: string;
}

export interface CrossLevelSimilarityResult {
  relationship: 'parent_child' | 'duplicate' | 'none';
  confidence: number;
  action:
    | 'keep_both'
    | 'merge_into_parent'
    | 'merge_into_child'
    | 'make_sibling';
  reasoning: string;
}
