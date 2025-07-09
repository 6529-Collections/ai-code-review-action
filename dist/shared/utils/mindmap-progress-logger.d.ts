import { ConsolidatedTheme } from '@/mindmap/types/similarity-types';
/**
 * Mindmap-style progress logger that shows visual hierarchy and real progress
 * Replaces noisy debug logging with clean, structured output
 */
export declare class MindmapProgressLogger {
    private static instance;
    private startTime;
    private phase;
    private phaseStartTime;
    private totalFiles;
    private themesBuilt;
    private maxDepth;
    private isQuiet;
    private logFile;
    private logStream;
    private constructor();
    static getInstance(): MindmapProgressLogger;
    /**
     * Start the analysis with file count
     */
    startAnalysis(fileCount: number): void;
    /**
     * Start a new phase with progress tracking
     */
    startPhase(phaseName: string, description?: string): void;
    /**
     * Update progress within current phase
     */
    updateProgress(current: number, total: number, description?: string): void;
    /**
     * Complete current phase
     */
    completePhase(summary?: string): void;
    /**
     * Show consolidated themes after consolidation
     */
    showConsolidatedThemes(themes: ConsolidatedTheme[]): void;
    /**
     * Show mindmap structure as it's being built
     */
    showMindmapStructure(themes: ConsolidatedTheme[]): void;
    /**
     * Update mindmap expansion progress
     */
    updateExpansionProgress(currentTheme: string, completed: number, total: number, depth: number): void;
    /**
     * Show when a theme becomes atomic
     */
    showAtomicTheme(themeName: string, depth: number, reason: string): void;
    /**
     * Show theme expansion result
     */
    showThemeExpanded(parentName: string, subThemes: string[], depth: number): void;
    /**
     * Complete the entire analysis
     */
    completeAnalysis(totalThemes: number, totalNodes: number, maxDepth: number): void;
    /**
     * Show error with context
     */
    showError(phase: string, error: string, context?: string): void;
    /**
     * Show warning with context
     */
    showWarning(message: string, context?: string): void;
    /**
     * Print a single theme and its children as a tree
     */
    private printThemeTree;
    /**
     * Create visual progress bar
     */
    private createProgressBar;
    /**
     * Format duration in human-readable format
     */
    private formatDuration;
    /**
     * Enable/disable quiet mode
     */
    setQuietMode(quiet: boolean): void;
    /**
     * Set up file logging to capture all progress
     */
    private setupFileLogging;
    /**
     * Write message to log file if enabled
     */
    private logToFile;
    /**
     * Log both to console and file
     */
    private log;
    /**
     * Close log file when analysis is complete
     */
    private closeLogFile;
}
export declare const mindmapLogger: MindmapProgressLogger;
