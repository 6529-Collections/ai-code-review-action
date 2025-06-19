import { ChangedFile } from './git-service';
export interface Theme {
    id: string;
    name: string;
    scope: 'flow' | 'feature' | 'module' | 'class' | 'function' | 'component';
    description: string;
    impactLevel: 'high' | 'medium' | 'low';
    affectedFiles: string[];
    codeLocations?: Array<{
        file: string;
        startLine?: number;
        endLine?: number;
        functions?: string[];
        classes?: string[];
    }>;
    parent?: string;
    children: Theme[];
    relatedThemes: string[];
    confidence: number;
    analysis?: ThemeAnalysis;
}
export interface ThemeAnalysis {
    summary: string;
    codeQuality: {
        score: number;
        issues: string[];
        suggestions: string[];
    };
    testCoverage: {
        hasTests: boolean;
        missingTests: string[];
        testQuality: number;
    };
    potentialBugs: {
        risks: string[];
        unhandledCases: string[];
    };
    businessImpact: {
        userFacing: boolean;
        criticalPath: boolean;
        breakingChange: boolean;
    };
}
export interface ThemeAnalysisResult {
    themes: Theme[];
    summary: string;
    changedFilesCount: number;
    analysisTimestamp: Date;
    totalThemes: number;
    themesByScope: Record<Theme['scope'], number>;
}
export declare class ThemeService {
    private readonly anthropicApiKey;
    constructor(anthropicApiKey: string);
    analyzeThemes(changedFiles: ChangedFile[]): Promise<ThemeAnalysisResult>;
    private detectThemes;
}
