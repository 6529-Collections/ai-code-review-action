import { ChangedFile } from '@/shared/services/git-service';

/**
 * Abstract base class for different diff modes in local testing
 * Provides extensible foundation for future diff modes
 */
export abstract class BaseDiffMode {
  /**
   * Get the name of this diff mode
   */
  abstract getName(): string;

  /**
   * Get the list of changed files for this mode
   */
  abstract getChangedFiles(): Promise<ChangedFile[]>;

  /**
   * Get the full diff content for this mode
   */
  abstract getDiffContent(): Promise<string>;

  /**
   * Optional: Get a description of what this mode analyzes
   */
  getDescription(): string {
    return `Analyzes changes using ${this.getName()} mode`;
  }
}