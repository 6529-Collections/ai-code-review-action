import { ConsolidatedTheme } from './similarity-types';

/**
 * Types specifically for hierarchical theme expansion
 */

export interface HierarchyLevel {
  level: number;
  themes: ConsolidatedTheme[];
  parentLevel?: HierarchyLevel;
  childLevels: HierarchyLevel[];
}

export interface ThemeHierarchy {
  rootLevel: HierarchyLevel;
  maxDepth: number;
  totalThemes: number;
  levelCounts: Record<number, number>; // level -> count
}

export interface ExpansionMetrics {
  originalThemeCount: number;
  expandedThemeCount: number;
  averageDepth: number;
  maxDepth: number;
  expansionRatio: number; // expanded / original
  processingTime: number;
  aiCallCount: number;
  cacheHitRate: number;
}



export interface BusinessPattern {
  id: string;
  name: string;
  description: string;
  category:
    | 'user_flow'
    | 'business_logic'
    | 'data_processing'
    | 'integration'
    | 'validation'
    | 'workflow';
  confidence: number;
  affectedThemes: string[]; // theme IDs
  files: string[];
  codeIndicators: string[]; // code patterns/keywords
}

export interface UserFlowPattern {
  id: string;
  name: string;
  description: string;
  steps: string[];
  triggers: string[];
  outcomes: string[];
  confidence: number;
  affectedThemes: string[];
  files: string[];
}

export interface ExpansionValidation {
  isValid: boolean;
  issues: string[];
  warnings: string[];
  suggestions: string[];
  themeIntegrity: {
    orphanedThemes: string[];
    circularReferences: string[];
    levelInconsistencies: string[];
  };
  fileConsistency: {
    missingFiles: string[];
    fileConflicts: string[];
    scopeOverlaps: string[];
  };
}
