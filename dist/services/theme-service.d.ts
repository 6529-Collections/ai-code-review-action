import { ChangedFile } from './git-service';
import { AnalysisLogger } from '../utils/analysis-logger';
import { ConsolidatedTheme, ConsolidationConfig } from './theme-similarity';
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
    lastAnalysis: Date;
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
    expandable: {
        hasChildThemes: boolean;
        canDrillDown: boolean;
    };
    consolidationStats: {
        mergedThemes: number;
        hierarchicalThemes: number;
        consolidationRatio: number;
    };
}
export declare class ThemeService {
    private readonly anthropicApiKey;
    private readonly logger?;
    private similarityService;
    constructor(anthropicApiKey: string, logger?: AnalysisLogger | undefined, consolidationConfig?: Partial<ConsolidationConfig>);
    analyzeThemes(changedFiles: ChangedFile[]): Promise<ThemeAnalysisResult>;
    private createFallbackThemes;
}
