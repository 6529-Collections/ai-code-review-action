import * as exec from '@actions/exec';
import { BaseDiffMode } from './base-diff-mode';
import { ChangedFile } from '@/shared/services/git-service';

/**
 * UncommittedMode analyzes all uncommitted changes (staged + unstaged)
 * This is the default mode for local testing
 */
export class UncommittedMode extends BaseDiffMode {
  // Patterns for files to exclude from analysis
  private static readonly EXCLUDED_PATTERNS = [
    /^dist\//, // Exclude dist folder
    /\.d\.ts$/, // Exclude TypeScript declaration files
    /node_modules\//, // Exclude dependencies
    /\.map$/, // Exclude source maps
    /package-lock\.json$/, // Exclude lock files
    /mindmap-prd\.txt$/, // Exclude PRD files
    /review-prd\.md$/, // Exclude PRD files
    /\.md$/, // Exclude all markdown files
  ];

  getName(): string {
    return 'uncommitted';
  }

  getDescription(): string {
    return 'Analyzes all uncommitted changes (staged and unstaged)';
  }

  private shouldIncludeFile(filename: string): boolean {
    const isExcluded = UncommittedMode.EXCLUDED_PATTERNS.some((pattern) =>
      pattern.test(filename)
    );
    return !isExcluded;
  }

  async getChangedFiles(): Promise<ChangedFile[]> {
    
    const files: ChangedFile[] = [];
    
    // Get staged files
    const stagedFiles = await this.getStagedFiles();
    files.push(...stagedFiles);
    
    // Get unstaged files (modified/deleted)
    const unstagedFiles = await this.getUnstagedFiles();
    files.push(...unstagedFiles);
    
    // Get untracked files
    const untrackedFiles = await this.getUntrackedFiles();
    files.push(...untrackedFiles);
    
    // Remove duplicates and filter
    const uniqueFiles = this.deduplicateFiles(files);
    const filteredFiles = uniqueFiles.filter(file => this.shouldIncludeFile(file.filename));
    
    
    return filteredFiles;
  }

  async getDiffContent(): Promise<string> {
    
    let diffOutput = '';
    
    try {
      // Get staged changes
      await exec.exec('git', ['diff', '--cached'], {
        silent: true,
        listeners: {
          stdout: (data: Buffer) => {
            diffOutput += data.toString();
          },
        },
      });
      
      // Get unstaged changes
      await exec.exec('git', ['diff'], {
        silent: true,
        listeners: {
          stdout: (data: Buffer) => {
            diffOutput += data.toString();
          },
        },
      });
      
    } catch (error) {
      console.error('[UNCOMMITTED-MODE] Failed to get diff content:', error);
    }
    
    return diffOutput;
  }

  private async getStagedFiles(): Promise<ChangedFile[]> {
    const files: ChangedFile[] = [];
    let fileList = '';
    
    try {
      await exec.exec('git', ['diff', '--cached', '--name-status'], {
        silent: true,
        listeners: {
          stdout: (data: Buffer) => {
            fileList += data.toString();
          },
        },
      });
    } catch (error) {
      return [];
    }
    
    const fileLines = fileList.trim().split('\n').filter(line => line.trim());
    
    for (const line of fileLines) {
      const [status, filename] = line.split('\t');
      if (!filename) continue;
      
      const file = await this.createChangedFile(filename, status, true);
      if (file) files.push(file);
    }
    
    return files;
  }

  private async getUnstagedFiles(): Promise<ChangedFile[]> {
    const files: ChangedFile[] = [];
    let fileList = '';
    
    try {
      await exec.exec('git', ['diff', '--name-status'], {
        silent: true,
        listeners: {
          stdout: (data: Buffer) => {
            fileList += data.toString();
          },
        },
      });
    } catch (error) {
      return [];
    }
    
    const fileLines = fileList.trim().split('\n').filter(line => line.trim());
    
    for (const line of fileLines) {
      const [status, filename] = line.split('\t');
      if (!filename) continue;
      
      const file = await this.createChangedFile(filename, status, false);
      if (file) files.push(file);
    }
    
    return files;
  }

  private async getUntrackedFiles(): Promise<ChangedFile[]> {
    const files: ChangedFile[] = [];
    let fileList = '';
    
    try {
      await exec.exec('git', ['ls-files', '--others', '--exclude-standard'], {
        silent: true,
        listeners: {
          stdout: (data: Buffer) => {
            fileList += data.toString();
          },
        },
      });
    } catch (error) {
      return [];
    }
    
    const fileLines = fileList.trim().split('\n').filter(line => line.trim());
    
    for (const filename of fileLines) {
      if (!filename) continue;
      
      const file = await this.createChangedFile(filename, 'A', false);
      if (file) files.push(file);
    }
    
    return files;
  }

  private async createChangedFile(
    filename: string,
    gitStatus: string,
    isStaged: boolean
  ): Promise<ChangedFile | null> {
    try {
      // Get patch for this file
      const patch = await this.getFilePatch(filename, isStaged);
      
      
      return {
        filename,
        status: this.mapGitStatusToChangedFileStatus(gitStatus),
        patch,
      };
    } catch (error) {
      return null;
    }
  }

  private async getFilePatch(filename: string, isStaged: boolean): Promise<string> {
    let patch = '';
    
    try {
      const diffArgs = isStaged 
        ? ['diff', '--cached', '--', filename]
        : ['diff', '--', filename];
        
      await exec.exec('git', diffArgs, {
        silent: true,
        listeners: {
          stdout: (data: Buffer) => {
            patch += data.toString();
          },
        },
      });
    } catch (error) {
      // For untracked files, we need to show the entire file as added
      if (!isStaged) {
        try {
          await exec.exec('git', ['diff', '--no-index', '/dev/null', filename], {
            silent: true,
            listeners: {
              stdout: (data: Buffer) => {
                patch += data.toString();
              },
            },
          });
        } catch (untrackedError) {
          // Ignore untracked file patch errors
        }
      }
    }
    
    return patch;
  }

  private mapGitStatusToChangedFileStatus(gitStatus: string): ChangedFile['status'] {
    switch (gitStatus) {
      case 'A':
        return 'added';
      case 'D':
        return 'removed';
      case 'M':
        return 'modified';
      case 'R':
        return 'renamed';
      default:
        return 'modified';
    }
  }

  private deduplicateFiles(files: ChangedFile[]): ChangedFile[] {
    const fileMap = new Map<string, ChangedFile>();
    
    for (const file of files) {
      const existing = fileMap.get(file.filename);
      if (!existing) {
        fileMap.set(file.filename, file);
      } else {
        // Merge staged and unstaged changes
        fileMap.set(file.filename, {
          ...existing,
          patch: existing.patch + '\n' + file.patch,
        });
      }
    }
    
    return Array.from(fileMap.values());
  }
}