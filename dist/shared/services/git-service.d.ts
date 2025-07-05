import { CodeChange } from '../utils/ai-code-analyzer';
import { IGitService } from '../interfaces/git-service-interface';
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
}
