import { CodeChange } from '../utils/code-analyzer';
export interface ChangedFile {
    filename: string;
    status: 'added' | 'modified' | 'removed' | 'renamed';
    additions: number;
    deletions: number;
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
export declare class GitService {
    private readonly githubToken;
    private static readonly EXCLUDED_PATTERNS;
    private shouldIncludeFile;
    constructor(githubToken: string);
    getEnhancedChangedFiles(): Promise<CodeChange[]>;
    getPullRequestContext(): Promise<PullRequestContext | null>;
    private createDevModeContext;
    private getCurrentBranch;
    private getCurrentCommitSha;
    private getBranchCommitSha;
    getChangedFiles(): Promise<ChangedFile[]>;
    private getChangedFilesFromGitHub;
    private getChangedFilesFromGit;
    private mapGitStatusToChangedFileStatus;
    getDiffContent(baseSha: string, headSha: string): Promise<string>;
}
