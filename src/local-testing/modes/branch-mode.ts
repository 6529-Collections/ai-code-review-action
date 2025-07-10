import * as exec from '@actions/exec';
import { BaseDiffMode } from './base-diff-mode';
import { ChangedFile } from '@/shared/services/git-service';
import { FileExclusionPatterns } from '@/shared/utils/file-exclusion-patterns';

/**
 * BranchMode analyzes changes between current branch and target branch
 * REQUIRES: Must be in PR context (branch with upstream tracking)
 * ERRORS: Hard error if not in PR context - no fallbacks
 */
export class BranchMode extends BaseDiffMode {
  private targetBranch: string | null = null;

  getName(): string {
    return 'diff-compare';
  }

  getDescription(): string {
    return 'Compares current ref against target ref (requires PR context)';
  }

  private shouldIncludeFile(filename: string): boolean {
    return FileExclusionPatterns.shouldIncludeFile(filename);
  }

  /**
   * Strict PR detection with hard error handling
   * NO FALLBACKS - Fail fast if not in PR context
   */
  private async validatePRContext(): Promise<string> {
    try {
      // Get current branch name
      const currentBranch = await this.getCurrentBranch();
      console.log(`[BRANCH-MODE] Current ref: ${currentBranch}`);
      
      // Check if current branch has upstream tracking
      const upstreamBranch = await this.getUpstreamBranch(currentBranch);
      console.log(`[BRANCH-MODE] Upstream ref: ${upstreamBranch}`);
      
      // Resolve target branch (what this PR would merge into)
      const targetBranch = await this.getTargetBranch(upstreamBranch);
      console.log(`[BRANCH-MODE] Target ref: ${targetBranch}`);
      
      return targetBranch;
    } catch (error) {
      throw new Error(
        `BRANCH mode requires PR context but validation failed: ${error instanceof Error ? error.message : 'Unknown error'}\n` +
        `\nBRANCH mode can only be used when:\n` +
        `1. You are on a feature branch (not main/master)\n` +
        `2. The branch has upstream tracking set up\n` +
        `3. There is a clear target branch to compare against\n` +
        `\nFor uncommitted changes, use UNCOMMITTED mode instead.`
      );
    }
  }

  private async getCurrentBranch(): Promise<string> {
    let branchName = '';
    
    try {
      await exec.exec('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
        silent: true,
        listeners: {
          stdout: (data: Buffer) => {
            branchName = data.toString().trim();
          },
        },
      });
    } catch (error) {
      throw new Error('Failed to get current branch name');
    }
    
    if (!branchName) {
      throw new Error('Could not determine current branch name');
    }
    
    // Hard error if on main/master branch
    if (branchName === 'main' || branchName === 'master') {
      throw new Error(
        `Cannot use BRANCH mode on main/master branch. ` +
        `BRANCH mode is for feature branches in PR context only.`
      );
    }
    
    return branchName;
  }

  private async getUpstreamBranch(currentBranch: string): Promise<string> {
    let upstreamBranch = '';
    
    try {
      await exec.exec('git', ['rev-parse', '--abbrev-ref', `${currentBranch}@{upstream}`], {
        silent: true,
        listeners: {
          stdout: (data: Buffer) => {
            upstreamBranch = data.toString().trim();
          },
        },
      });
    } catch (error) {
      throw new Error(
        `Branch '${currentBranch}' has no upstream tracking branch. ` +
        `Set up upstream tracking with: git push -u origin ${currentBranch}`
      );
    }
    
    if (!upstreamBranch) {
      throw new Error(`Could not determine upstream branch for '${currentBranch}'`);
    }
    
    return upstreamBranch;
  }

  private async getTargetBranch(upstreamBranch: string): Promise<string> {
    // Extract remote and branch from upstream (e.g., "origin/feature-branch" -> "origin")
    const parts = upstreamBranch.split('/');
    if (parts.length < 2) {
      throw new Error(`Invalid upstream branch format: ${upstreamBranch}`);
    }
    
    const remote = parts[0];
    
    // Check for common target branches in order of preference
    const candidateTargets = [`${remote}/main`, `${remote}/master`, `${remote}/develop`];
    
    for (const candidate of candidateTargets) {
      try {
        // Check if the branch exists
        await exec.exec('git', ['rev-parse', '--verify', candidate], {
          silent: true,
        });
        
        // Found valid target branch
        return candidate;
      } catch (error) {
        // Branch doesn't exist, try next candidate
        continue;
      }
    }
    
    throw new Error(
      `Could not determine target branch. Tried: ${candidateTargets.join(', ')}\n` +
      `Make sure the target branch exists in remote '${remote}'.`
    );
  }

  async getChangedFiles(): Promise<ChangedFile[]> {
    // Ensure we're in PR context first
    this.targetBranch = await this.validatePRContext();
    
    // Log the target branch for debugging
    console.log(`[BRANCH-MODE] Comparing against target: ${this.targetBranch}`);
    
    const files: ChangedFile[] = [];
    let fileList = '';
    
    try {
      // Get changed files between current branch and target branch
      await exec.exec('git', ['diff', '--name-status', `${this.targetBranch}...HEAD`], {
        silent: true,
        listeners: {
          stdout: (data: Buffer) => {
            fileList += data.toString();
          },
        },
      });
    } catch (error) {
      throw new Error(
        `Failed to get changed files between current branch and ${this.targetBranch}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
    
    const fileLines = fileList.trim().split('\n').filter(line => line.trim());
    
    for (const line of fileLines) {
      const [status, filename] = line.split('\t');
      if (!filename) continue;
      
      const file = await this.createChangedFile(filename, status);
      if (file) files.push(file);
    }
    
    // Filter files according to exclusion patterns
    const filteredFiles = files.filter(file => this.shouldIncludeFile(file.filename));
    
    return filteredFiles;
  }

  async getDiffContent(): Promise<string> {
    // Ensure we're in PR context first
    if (!this.targetBranch) {
      this.targetBranch = await this.validatePRContext();
    }
    
    let diffOutput = '';
    
    try {
      // Get diff between current branch and target branch
      await exec.exec('git', ['diff', `${this.targetBranch}...HEAD`], {
        silent: true,
        listeners: {
          stdout: (data: Buffer) => {
            diffOutput += data.toString();
          },
        },
      });
    } catch (error) {
      throw new Error(
        `Failed to get diff content between current branch and ${this.targetBranch}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
    
    return diffOutput;
  }

  private async createChangedFile(filename: string, gitStatus: string): Promise<ChangedFile | null> {
    try {
      // Get patch for this file
      const patch = await this.getFilePatch(filename);
      
      return {
        filename,
        status: this.mapGitStatusToChangedFileStatus(gitStatus),
        patch,
      };
    } catch (error) {
      return null;
    }
  }

  private async getFilePatch(filename: string): Promise<string> {
    if (!this.targetBranch) {
      throw new Error('Target branch not set - call validatePRContext first');
    }
    
    let patch = '';
    
    try {
      await exec.exec('git', ['diff', `${this.targetBranch}...HEAD`, '--', filename], {
        silent: true,
        listeners: {
          stdout: (data: Buffer) => {
            patch += data.toString();
          },
        },
      });
    } catch (error) {
      throw new Error(`Failed to get patch for file ${filename}: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
}