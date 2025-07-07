import { ChangedFile } from '@/shared/services/git-service';
import { DiffModeConfig } from '../config/diff-modes';
/**
 * LocalDiffService orchestrates different diff modes for local testing
 * Provides a unified interface for getting changed files based on mode
 */
export declare class LocalDiffService {
    private mode;
    constructor(modeConfig?: DiffModeConfig);
    /**
     * Get changed files using the configured diff mode
     */
    getChangedFiles(): Promise<ChangedFile[]>;
    /**
     * Get full diff content using the configured diff mode
     */
    getDiffContent(): Promise<string>;
    /**
     * Get the current mode information
     */
    getCurrentMode(): {
        name: string;
        description: string;
    };
    /**
     * Create a diff mode instance based on configuration
     */
    private createMode;
}
