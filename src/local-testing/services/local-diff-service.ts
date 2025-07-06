import { ChangedFile } from '@/shared/services/git-service';
import { DiffModeConfig, DiffModeType, DEFAULT_DIFF_MODE_CONFIG } from '../config/diff-modes';
import { BaseDiffMode, UncommittedMode } from '../modes';

/**
 * LocalDiffService orchestrates different diff modes for local testing
 * Provides a unified interface for getting changed files based on mode
 */
export class LocalDiffService {
  private mode: BaseDiffMode;

  constructor(modeConfig?: DiffModeConfig) {
    const config = modeConfig || DEFAULT_DIFF_MODE_CONFIG;
    this.mode = this.createMode(config);
  }

  /**
   * Get changed files using the configured diff mode
   */
  async getChangedFiles(): Promise<ChangedFile[]> {
    return await this.mode.getChangedFiles();
  }

  /**
   * Get full diff content using the configured diff mode
   */
  async getDiffContent(): Promise<string> {
    return await this.mode.getDiffContent();
  }

  /**
   * Get the current mode information
   */
  getCurrentMode(): { name: string; description: string } {
    return {
      name: this.mode.getName(),
      description: this.mode.getDescription(),
    };
  }

  /**
   * Create a diff mode instance based on configuration
   */
  private createMode(config: DiffModeConfig): BaseDiffMode {
    switch (config.mode) {
      case DiffModeType.UNCOMMITTED:
        return new UncommittedMode();
      
      // Future modes can be added here
      // case DiffModeType.STAGED:
      //   return new StagedMode();
      // case DiffModeType.LAST_COMMIT:
      //   return new LastCommitMode();
      // case DiffModeType.BRANCH:
      //   return new BranchMode(config.baseBranch || 'main');
      
      default:
        return new UncommittedMode();
    }
  }
}