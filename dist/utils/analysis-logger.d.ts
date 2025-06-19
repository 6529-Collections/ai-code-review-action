import { ChangedFile } from '../services/git-service';
import { Theme } from '../services/theme-service';
import { ConsolidatedTheme } from '../services/theme-similarity';
export interface ClaudeCall {
    filename: string;
    prompt: string;
    response: string;
    success: boolean;
    error?: string;
}
export declare class AnalysisLogger {
    private diffs;
    private claudeCalls;
    private themes;
    private consolidatedThemes;
    private startTime;
    constructor();
    logDiff(file: ChangedFile): void;
    logClaudeCall(call: ClaudeCall): void;
    logResult(themes: Theme[]): void;
    logConsolidatedResult(themes: ConsolidatedTheme[]): void;
    generateReport(): void;
    getReportContent(): string;
    private buildReport;
}
