import { CodeChange } from '../utils/ai-code-analyzer';
import { IGitService } from '../interfaces/git-service-interface';
export interface ChangedFile {
    filename: string;
    status: 'added' | 'modified' | 'removed' | 'renamed';
    patch?: string;
}
export interface PullRequestContext {
    number: number;
    title: string;
    body: string;
    baseBranch: string;
    headBranch: string;
    baseSha: string;
    headSha: string;
}
export declare class GitService implements IGitService {
    private readonly githubToken;
    private static readonly EXCLUDED_PATTERNS;
    private octokit;
    private aiAnalyzer;
    private shouldIncludeFile;
    constructor(githubToken: string, anthropicApiKey?: string);
    getEnhancedChangedFiles(): Promise<CodeChange[]>;
    getPullRequestContext(): Promise<PullRequestContext | null>;
    getChangedFiles(): Promise<ChangedFile[]>;
    private getChangedFilesFromGitHub;
    getDiffContent(baseSha: string, headSha: string): Promise<string>;
    /**
     * Get current git branch name
     */
    private getCurrentBranch;
    /**
     * Check if a branch exists
     */
    private branchExists;
    /**
     * Detect PR context from current branch using GitHub API
     */
    private detectCurrentBranchPR;
    /**
     * Get changed files using git diff commands
     */
    private getChangedFilesFromGit;
    /**
     * Map git status characters to ChangedFile status
     */
    private mapGitStatusToChangeStatus;
}
