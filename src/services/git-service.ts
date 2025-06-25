import * as github from '@actions/github';
import * as exec from '@actions/exec';
import { CodeAnalyzer, CodeChange } from '../utils/code-analyzer';

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

export class GitService {
  // Patterns for files to exclude from analysis
  private static readonly EXCLUDED_PATTERNS = [
    /^dist\//, // Exclude dist folder
    /\.d\.ts$/, // Exclude TypeScript declaration files
    /node_modules\//, // Exclude dependencies
    /\.map$/, // Exclude source maps
    /package-lock\.json$/, // Exclude lock files
  ];

  private octokit: ReturnType<typeof github.getOctokit> | null = null;

  private shouldIncludeFile(filename: string): boolean {
    const isExcluded = GitService.EXCLUDED_PATTERNS.some((pattern) =>
      pattern.test(filename)
    );
    console.log(
      `[GIT-FILTER] ${filename}: ${isExcluded ? 'EXCLUDED' : 'INCLUDED'}`
    );
    return !isExcluded;
  }

  constructor(private readonly githubToken: string) {
    // Initialize GitHub API client if token is available
    if (this.githubToken) {
      try {
        this.octokit = github.getOctokit(this.githubToken);
      } catch (error) {
        console.warn(
          '[GIT-SERVICE] Failed to initialize GitHub API client:',
          error
        );
      }
    }
  }

  async getEnhancedChangedFiles(): Promise<CodeChange[]> {
    console.log(
      '[GIT-SERVICE] Getting enhanced changed files with code analysis'
    );

    // Get basic changed files first
    const changedFiles = await this.getChangedFiles();

    // Convert to enhanced CodeChange objects
    const codeChanges: CodeChange[] = [];

    for (const file of changedFiles) {
      console.log(
        `[GIT-SERVICE] Processing ${file.filename} for enhanced analysis`
      );

      // Map GitHub status to our type system
      const changeType =
        file.status === 'removed'
          ? 'deleted'
          : (file.status as 'added' | 'modified' | 'renamed');

      const codeChange = CodeAnalyzer.processChangedFile(
        file.filename,
        file.patch || '',
        changeType,
        file.additions,
        file.deletions
      );

      codeChanges.push(codeChange);
    }

    console.log(
      `[GIT-SERVICE] Processed ${codeChanges.length} files with enhanced context`
    );
    return codeChanges;
  }

  async getPullRequestContext(): Promise<PullRequestContext | null> {
    // Check if we're in a GitHub Actions PR context
    if (github.context.eventName === 'pull_request') {
      const pr = github.context.payload.pull_request;
      if (pr) {
        console.log(
          `[GIT-SERVICE] Using GitHub Actions PR context: #${pr.number}`
        );
        return {
          number: pr.number,
          title: pr.title,
          body: pr.body || '',
          baseBranch: pr.base.ref,
          headBranch: pr.head.ref,
          baseSha: pr.base.sha,
          headSha: pr.head.sha,
        };
      }
    }

    // Dev mode: First try to find existing PR for current branch
    const currentBranch = await this.getCurrentBranch();
    const existingPR = await this.getPullRequestForBranch(currentBranch);

    if (existingPR) {
      console.log(
        `[GIT-SERVICE] Using existing PR #${existingPR.number} context for local testing`
      );
      return existingPR;
    }

    // Fallback: create synthetic PR context from local git
    console.log('[GIT-SERVICE] No PR found, using branch comparison mode');
    return await this.createDevModeContext();
  }

  private async getPullRequestForBranch(
    branchName: string
  ): Promise<PullRequestContext | null> {
    if (!this.octokit) {
      console.log(
        '[GIT-SERVICE] No GitHub token available, cannot check for existing PR'
      );
      return null;
    }

    try {
      console.log(
        `[GIT-SERVICE] Checking for open PR for branch: ${branchName}`
      );

      const { data: pulls } = await this.octokit.rest.pulls.list({
        ...github.context.repo,
        head: `${github.context.repo.owner}:${branchName}`,
        state: 'open',
      });

      if (pulls.length > 0) {
        const pr = pulls[0]; // Take the first matching PR
        console.log(
          `[GIT-SERVICE] Found PR #${pr.number} for branch ${branchName}`
        );

        return {
          number: pr.number,
          title: pr.title,
          body: pr.body || '',
          baseBranch: pr.base.ref,
          headBranch: pr.head.ref,
          baseSha: pr.base.sha,
          headSha: pr.head.sha,
        };
      }

      console.log(`[GIT-SERVICE] No open PR found for branch ${branchName}`);
      return null;
    } catch (error) {
      console.warn(
        `[GIT-SERVICE] Failed to check for PR on branch ${branchName}:`,
        error
      );
      return null;
    }
  }

  private async createDevModeContext(): Promise<PullRequestContext | null> {
    try {
      const currentBranch = await this.getCurrentBranch();
      const baseBranch = 'main'; // Default comparison branch
      const headSha = await this.getCurrentCommitSha();
      const baseSha = await this.getBranchCommitSha(baseBranch);

      return {
        number: 0, // Synthetic PR number
        title: `Local changes on ${currentBranch}`,
        body: 'Development mode - comparing local changes against main branch',
        baseBranch,
        headBranch: currentBranch,
        baseSha,
        headSha,
      };
    } catch (error) {
      console.warn('Failed to create dev mode context:', error);
      return null;
    }
  }

  private async getCurrentBranch(): Promise<string> {
    let branch = '';
    await exec.exec('git', ['branch', '--show-current'], {
      listeners: {
        stdout: (data: Buffer) => {
          branch += data.toString().trim();
        },
      },
    });
    return branch || 'unknown';
  }

  private async getCurrentCommitSha(): Promise<string> {
    let sha = '';
    await exec.exec('git', ['rev-parse', 'HEAD'], {
      listeners: {
        stdout: (data: Buffer) => {
          sha += data.toString().trim();
        },
      },
    });
    return sha;
  }

  private async getBranchCommitSha(branch: string): Promise<string> {
    let sha = '';
    try {
      await exec.exec('git', ['rev-parse', `origin/${branch}`], {
        listeners: {
          stdout: (data: Buffer) => {
            sha += data.toString().trim();
          },
        },
      });
    } catch (error) {
      // Fallback to local branch if remote doesn't exist
      await exec.exec('git', ['rev-parse', branch], {
        listeners: {
          stdout: (data: Buffer) => {
            sha += data.toString().trim();
          },
        },
      });
    }
    return sha;
  }

  async getChangedFiles(): Promise<ChangedFile[]> {
    const prContext = await this.getPullRequestContext();
    if (!prContext) {
      return [];
    }

    console.log(
      `[GIT-DEBUG] PR Context: number=${prContext.number}, event=${github.context.eventName}, hasToken=${!!this.githubToken}`
    );
    console.log(
      `[GIT-DEBUG] baseBranch=${prContext.baseBranch}, headBranch=${prContext.headBranch}`
    );

    // Use GitHub API for real PRs (in GitHub Actions or when PR found locally)
    if (prContext.number > 0 && this.octokit) {
      console.log(
        `[GIT-DEBUG] Using GitHub API for PR #${prContext.number} (exact same as live)`
      );
      return await this.getChangedFilesFromGitHub(prContext.number);
    }

    // Fallback to git commands for synthetic dev mode (no PR)
    console.log(`[GIT-DEBUG] Using git commands method for branch comparison`);
    return await this.getChangedFilesFromGit(
      prContext.baseSha,
      prContext.headSha
    );
  }

  private async getChangedFilesFromGitHub(
    prNumber: number
  ): Promise<ChangedFile[]> {
    try {
      if (!this.octokit) {
        throw new Error('GitHub API client not initialized');
      }

      const { data: files } = await this.octokit.rest.pulls.listFiles({
        ...github.context.repo,
        pull_number: prNumber,
      });

      const changedFiles = files
        .filter((file) => this.shouldIncludeFile(file.filename))
        .map((file) => ({
          filename: file.filename,
          status: file.status as ChangedFile['status'],
          additions: file.additions,
          deletions: file.deletions,
          patch: file.patch,
        }));

      console.log(
        `[GIT-SERVICE] GitHub API: Filtered ${files.length} files down to ${changedFiles.length} for analysis`
      );
      return changedFiles;
    } catch (error) {
      console.error('Failed to get changed files from GitHub:', error);
      return [];
    }
  }

  private async getChangedFilesFromGit(
    baseSha: string,
    headSha: string
  ): Promise<ChangedFile[]> {
    console.log(
      `[GIT-DEBUG] Comparing ${baseSha.substring(0, 8)} (base) vs ${headSha.substring(0, 8)} (head)`
    );

    const files: ChangedFile[] = [];
    let fileList = '';
    let diffCommand: string[] = [];

    // Method 1: Try exact SHA comparison (remove triple-dot syntax)
    try {
      diffCommand = ['diff', '--name-status', baseSha, headSha];
      console.log(`[GIT-DEBUG] Method 1: git ${diffCommand.join(' ')}`);

      await exec.exec('git', diffCommand, {
        listeners: {
          stdout: (data: Buffer) => {
            fileList += data.toString();
          },
        },
      });

      console.log(`[GIT-DEBUG] Method 1 succeeded`);
    } catch (method1Error) {
      console.log(`[GIT-DEBUG] Method 1 failed: ${method1Error}`);

      // Method 2: Fetch base branch and compare
      try {
        const prContext = await this.getPullRequestContext();
        const baseBranch = prContext?.baseBranch || 'main';

        console.log(`[GIT-DEBUG] Method 2: Fetching base branch ${baseBranch}`);
        await exec.exec('git', ['fetch', 'origin', baseBranch]);

        diffCommand = ['diff', '--name-status', `origin/${baseBranch}`, 'HEAD'];
        console.log(`[GIT-DEBUG] Method 2: git ${diffCommand.join(' ')}`);

        fileList = ''; // Reset for retry
        await exec.exec('git', diffCommand, {
          listeners: {
            stdout: (data: Buffer) => {
              fileList += data.toString();
            },
          },
        });

        console.log(`[GIT-DEBUG] Method 2 succeeded`);
      } catch (method2Error) {
        console.log(`[GIT-DEBUG] Method 2 failed: ${method2Error}`);

        // Method 3: Emergency fallback - recent commits only
        try {
          diffCommand = ['diff', '--name-status', 'HEAD~1', 'HEAD'];
          console.log(
            `[GIT-DEBUG] Method 3 (emergency): git ${diffCommand.join(' ')}`
          );

          fileList = ''; // Reset for retry
          await exec.exec('git', diffCommand, {
            listeners: {
              stdout: (data: Buffer) => {
                fileList += data.toString();
              },
            },
          });

          console.log(
            `[GIT-DEBUG] Method 3 succeeded (showing recent commits only)`
          );
        } catch (method3Error) {
          console.error(
            `[GIT-DEBUG] All methods failed. Method 3 error: ${method3Error}`
          );
          throw new Error(
            `Git diff failed with all methods. Last error: ${method3Error}`
          );
        }
      }
    }

    // Parse file status
    const fileLines = fileList
      .trim()
      .split('\n')
      .filter((line) => line.trim());

    console.log(
      `[GIT-DEBUG] Found ${fileLines.length} changed files total before filtering`
    );

    try {
      for (const line of fileLines) {
        const [status, filename] = line.split('\t');
        if (!filename || !this.shouldIncludeFile(filename)) continue;

        // Get diff patch for this file using the same command that succeeded for file list
        let patch = '';
        try {
          const patchCommand = [...diffCommand, '--', filename];
          await exec.exec('git', patchCommand, {
            listeners: {
              stdout: (data: Buffer) => {
                patch += data.toString();
              },
            },
          });
        } catch (error) {
          console.warn(
            `[GIT-DEBUG] Failed to get patch for ${filename}:`,
            error
          );
          // Continue without patch - we still have the file status
        }

        // Count additions/deletions from patch
        const additions = (patch.match(/^\+(?!\+)/gm) || []).length;
        const deletions = (patch.match(/^-(?!-)/gm) || []).length;

        const file = {
          filename,
          status: this.mapGitStatusToChangedFileStatus(status),
          additions,
          deletions,
          patch,
        };

        files.push(file);
      }

      console.log(
        `[GIT-SERVICE] Found ${files.length} source files for analysis (excluded build artifacts)`
      );
      return files;
    } catch (fileProcessingError) {
      console.error('Failed to process files:', fileProcessingError);
      return [];
    }
  }

  private mapGitStatusToChangedFileStatus(
    gitStatus: string
  ): ChangedFile['status'] {
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

  async getDiffContent(baseSha: string, headSha: string): Promise<string> {
    let diffOutput = '';

    try {
      await exec.exec('git', ['diff', `${baseSha}...${headSha}`], {
        listeners: {
          stdout: (data: Buffer) => {
            diffOutput += data.toString();
          },
        },
      });
    } catch (error) {
      console.error('Failed to get diff content:', error);
    }

    return diffOutput;
  }
}
