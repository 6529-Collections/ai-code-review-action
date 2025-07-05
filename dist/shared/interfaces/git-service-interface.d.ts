import { CodeChange } from '../utils/ai-code-analyzer';
import { ChangedFile, PullRequestContext } from '../services/git-service';
/**
 * Common interface for Git services (production and local testing)
 * Defines the contract that ThemeService expects
 */
export interface IGitService {
    /**
     * Get enhanced changed files with AI code analysis
     */
    getEnhancedChangedFiles(): Promise<CodeChange[]>;
    /**
     * Get basic changed files (without AI analysis)
     */
    getChangedFiles(): Promise<ChangedFile[]>;
    /**
     * Get pull request context
     */
    getPullRequestContext(): Promise<PullRequestContext | null>;
}
