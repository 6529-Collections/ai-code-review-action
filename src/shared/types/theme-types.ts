import { SmartContext, CodeChange } from '@/shared/utils/ai-code-analyzer';
import { ConsolidatedTheme } from '../../types/similarity-types';

export interface Theme {
  id: string;
  name: string;
  description: string;
  level: number;
  parentId?: string;
  childIds: string[];

  affectedFiles: string[];
  codeSnippets: string[];
  confidence: number;

  context: string;
  enhancedContext: SmartContext; // Rich code context with algorithmic + AI insights
  codeChanges: CodeChange[]; // Detailed code change information
  lastAnalysis: Date;

  // New fields for richer context
  detailedDescription?: string; // 2-3 sentence detailed explanation
  technicalSummary?: string; // Technical changes summary
  keyChanges?: string[]; // Bullet points of main changes
  userScenario?: string; // Example user flow

  // Code context
  mainFunctionsChanged?: string[]; // Key functions/methods
  mainClassesChanged?: string[]; // Key classes/components
  codeMetrics?: {
    linesAdded: number;
    linesRemoved: number;
    filesChanged: number;
  };

  // Enhanced snippets
  codeExamples?: Array<{
    file: string;
    description: string;
    snippet: string;
  }>;

  // Dynamic depth fields (simplified)
  isAtomic?: boolean;
  expansionReason?: string;
}

export interface CodeChunk {
  id: string;
  content: string;
  filename: string;
  startLine?: number;
  endLine?: number;
  type: 'function' | 'class' | 'file' | 'block';
}

export interface ChunkAnalysis {
  themeName: string;
  description: string;
  businessImpact: string;
  suggestedParent?: string | null;
  confidence: number;
  codePattern: string;

  // New detailed fields
  detailedDescription?: string;
  technicalSummary?: string;
  keyChanges?: string[];
  userScenario?: string;
  mainFunctionsChanged?: string[];
  mainClassesChanged?: string[];
}

export interface ThemePlacement {
  action: 'merge' | 'create';
  targetThemeId?: string;
  level?: number;
}

export interface LiveContext {
  themes: Map<string, Theme>;
  rootThemeIds: string[];
  globalInsights: string[];
  processingState: 'idle' | 'processing' | 'complete';
}

export interface ChunkAnalysisResult {
  chunk: CodeChunk;
  analysis: ChunkAnalysis;
  error?: string;
}

export interface ThemeAnalysisResult {
  themes: ConsolidatedTheme[];
  originalThemes: Theme[];
  summary: string;
  changedFilesCount: number;
  analysisTimestamp: Date;
  totalThemes: number;
  originalThemeCount: number;
  processingTime: number;
  consolidationTime: number;
  expansionTime?: number;
  expandable: {
    hasChildThemes: boolean;
    canDrillDown: boolean;
  };
  consolidationStats: {
    mergedThemes: number;
    hierarchicalThemes: number;
    consolidationRatio: number;
  };
  expansionStats?: {
    expandedThemes: number;
    maxDepth: number;
    averageDepth: number;
    totalSubThemes: number;
  };
}