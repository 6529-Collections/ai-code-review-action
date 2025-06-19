import { ChangedFile } from './git-service';
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
    themes: Theme[];
    summary: string;
    changedFilesCount: number;
    analysisTimestamp: Date;
    totalThemes: number;
    processingTime: number;
    expandable: {
        hasChildThemes: boolean;
        canDrillDown: boolean;
    };
}
export declare class ThemeService {
    private readonly anthropicApiKey;
    constructor(anthropicApiKey: string);
    analyzeThemes(changedFiles: ChangedFile[]): Promise<ThemeAnalysisResult>;
    private createFallbackThemes;
}
