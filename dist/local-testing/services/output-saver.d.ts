import { ThemeAnalysisResult } from '@/shared/types/theme-types';
export interface SavedAnalysisMetadata {
    timestamp: string;
    mode: string;
    totalFiles: number;
    totalThemes: number;
    processingTimeMs: number;
    gitBranch?: string;
    gitCommit?: string;
}
export interface SavedAnalysis {
    metadata: SavedAnalysisMetadata;
    themes: any;
    summary: string;
    rawAnalysis: ThemeAnalysisResult;
}
/**
 * OutputSaver handles saving local testing results to disk
 */
export declare class OutputSaver {
    private static readonly OUTPUT_DIR;
    private static readonly LOCAL_DIR;
    /**
     * Save analysis results to disk with timestamp and metadata
     */
    static saveAnalysis(themes: any, summary: string, rawAnalysis: ThemeAnalysisResult, mode: string): Promise<string>;
    /**
     * Get list of saved analysis files
     */
    static getSavedAnalyses(): string[];
    /**
     * Load a specific saved analysis
     */
    static loadAnalysis(filename: string): SavedAnalysis | null;
    /**
     * Clean up old analysis files (keep last N files)
     */
    static cleanupOldAnalyses(keepCount?: number): void;
    /**
     * Ensure output directories exist
     */
    private static ensureDirectoryExists;
    /**
     * Generate metadata for the analysis
     */
    private static generateMetadata;
    /**
     * Get summary of all saved analyses
     */
    static getSavedAnalysesSummary(): Array<{
        filename: string;
        metadata: SavedAnalysisMetadata;
    }>;
}
