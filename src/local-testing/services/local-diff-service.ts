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
    
    console.log(`[LOCAL-DIFF-SERVICE] Initialized with mode: ${this.mode.getName()}`);
    console.log(`[LOCAL-DIFF-SERVICE] ${this.mode.getDescription()}`);
  }

  /**
   * Get changed files using the configured diff mode
   */
  async getChangedFiles(): Promise<ChangedFile[]> {
    console.log(`[LOCAL-DIFF-SERVICE] Getting changed files using ${this.mode.getName()} mode`);
    
    const files = await this.mode.getChangedFiles();
    
    console.log(`[LOCAL-DIFF-SERVICE] Found ${files.length} changed files`);
    
    if (files.length === 0) {
      console.log('[LOCAL-DIFF-SERVICE] No changes found - returning empty result');
    } else {
      const fileNames = files.map(f => f.filename).join(', ');
      console.log(`[LOCAL-DIFF-SERVICE] Files: ${fileNames}`);
    }
    
    return files;
  }

  /**
   * Get full diff content using the configured diff mode
   */
  async getDiffContent(): Promise<string> {
    console.log(`[LOCAL-DIFF-SERVICE] Getting diff content using ${this.mode.getName()} mode`);
    
    const content = await this.mode.getDiffContent();
    
    console.log(`[LOCAL-DIFF-SERVICE] Diff content length: ${content.length} characters`);
    
    return content;
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
        console.warn(`[LOCAL-DIFF-SERVICE] Unknown diff mode: ${config.mode}, falling back to uncommitted`);
        return new UncommittedMode();
    }
  }
}