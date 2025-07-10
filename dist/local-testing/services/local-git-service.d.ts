import { CodeChange } from '@/shared/utils/ai-code-analyzer';
import { ChangedFile, PullRequestContext } from '@/shared/services/git-service';
import { IGitService } from '@/shared/interfaces/git-service-interface';
import { DiffModeConfig } from '../config/diff-modes';
/**
 * LocalGitService provides Git operations specifically for local testing
 * Simplified version focused on uncommitted changes analysis
 */
export declare class LocalGitService implements IGitService {
    private aiAnalyzer;
    private localDiffService;
    constructor(anthropicApiKey: string, diffModeConfig?: DiffModeConfig);
    /**
     * Get diff mode configuration from environment variables
     * Supports DIFF_MODE environment variable with values: 'uncommitted', 'branch'
     */
    private getDiffModeFromEnv;
    /**
     * Get enhanced changed files with AI code analysis for local testing
     */
    getEnhancedChangedFiles(): Promise<CodeChange[]>;
    /**
     * Get basic changed files (without AI analysis) for local testing
     */
    getChangedFiles(): Promise<ChangedFile[]>;
    /**
     * Get synthetic PR context for local testing
     * Always returns a dev mode context since we're not dealing with real PRs
     */
    getPullRequestContext(): Promise<PullRequestContext | null>;
    /**
     * Get full diff content for local testing
     */
    getDiffContent(): Promise<string>;
    /**
     * Get current mode information
     */
    getCurrentMode(): {
        name: string;
        description: string;
    };
}
