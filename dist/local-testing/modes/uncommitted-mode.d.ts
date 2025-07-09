import { BaseDiffMode } from './base-diff-mode';
import { ChangedFile } from '@/shared/services/git-service';
/**
 * UncommittedMode analyzes all uncommitted changes (staged + unstaged)
 * This is the default mode for local testing
 */
export declare class UncommittedMode extends BaseDiffMode {
    getName(): string;
    getDescription(): string;
    private shouldIncludeFile;
    getChangedFiles(): Promise<ChangedFile[]>;
    getDiffContent(): Promise<string>;
    private getStagedFiles;
    private getUnstagedFiles;
    private getUntrackedFiles;
    private createChangedFile;
    private getFilePatch;
    private mapGitStatusToChangedFileStatus;
    private deduplicateFiles;
}
