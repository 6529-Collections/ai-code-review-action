import { SmartContext, CodeChange } from '@/shared/utils/ai-code-analyzer';
import { ConsolidatedTheme } from '@/mindmap/types/similarity-types';
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
    enhancedContext: SmartContext;
    codeChanges: CodeChange[];
    lastAnalysis: Date;
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
