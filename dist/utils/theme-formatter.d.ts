import { ConsolidatedTheme } from '../types/similarity-types';
/**
 * Utility for formatting theme hierarchies for output
 */
export declare class ThemeFormatter {
    private static readonly MAX_FILES_SHOWN;
    private static readonly MAX_DESCRIPTION_LENGTH;
    /**
     * Format themes for GitHub Actions output with deep hierarchy support
     */
    static formatThemesForOutput(themes: ConsolidatedTheme[]): string;
    /**
     * Format a single theme recursively with proper indentation
     */
    private static formatThemeRecursively;
    /**
     * Create a concise summary of the theme analysis
     */
    static createThemeSummary(themes: ConsolidatedTheme[]): string;
    /**
     * Format themes for JSON output (useful for integrations)
     */
    static formatThemesAsJson(themes: ConsolidatedTheme[]): string;
    /**
     * Create a flat list of all themes with hierarchy indicators
     */
    static createFlatThemeList(themes: ConsolidatedTheme[]): string;
    private static countTotalThemes;
    private static calculateMaxDepth;
    private static calculateAverageConfidence;
    private static countExpandedThemes;
    private static countMergedThemes;
    private static truncateText;
    private static themeToJsonObject;
}
