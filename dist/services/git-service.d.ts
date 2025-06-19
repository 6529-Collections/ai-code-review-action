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
    constructor(githubToken: string);
    getPullRequestContext(): Promise<PullRequestContext | null>;
    getChangedFiles(): Promise<ChangedFile[]>;
    getDiffContent(baseSha: string, headSha: string): Promise<string>;
}
