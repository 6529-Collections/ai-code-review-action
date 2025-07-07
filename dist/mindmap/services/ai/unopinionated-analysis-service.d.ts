import { ConsolidatedTheme } from '../../types/similarity-types';
import { ThemeAnalysis } from '../../types/multi-stage-types';
import { ClaudeClient } from '../../../shared/utils/claude-client';
/**
 * Service for performing unopinionated analysis of themes
 * Analyzes code structure and content without depth-based bias
 */
export declare class UnopinionatedAnalysisService {
    private claudeClient;
    constructor(claudeClient: ClaudeClient);
    /**
     * Analyze a theme based purely on its code content and structure
     */
    analyzeTheme(theme: ConsolidatedTheme): Promise<ThemeAnalysis>;
    /**
     * Build unopinionated analysis prompt
     */
    private buildAnalysisPrompt;
    /**
     * Format code snippets for analysis
     */
    private formatCodeSnippets;
    /**
     * Validate analysis response structure
     */
    private validateAnalysisResponse;
    /**
     * Generate default analysis when AI analysis fails
     */
    private getDefaultAnalysis;
}
