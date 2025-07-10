import { BaseDiffMode } from './base-diff-mode';
import { ChangedFile } from '@/shared/services/git-service';
/**
 * BranchMode analyzes changes between current branch and target branch
 * REQUIRES: Must be in PR context (branch with upstream tracking)
 * ERRORS: Hard error if not in PR context - no fallbacks
 */
export declare class BranchMode extends BaseDiffMode {
    private targetBranch;
    getName(): string;
    getDescription(): string;
    private shouldIncludeFile;
    /**
     * Strict PR detection with hard error handling
     * NO FALLBACKS - Fail fast if not in PR context
     */
    private validatePRContext;
    private getCurrentBranch;
    private getUpstreamBranch;
    private getTargetBranch;
    getChangedFiles(): Promise<ChangedFile[]>;
    getDiffContent(): Promise<string>;
    private createChangedFile;
    private getFilePatch;
    private mapGitStatusToChangedFileStatus;
}
