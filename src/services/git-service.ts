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

  private shouldIncludeFile(filename: string): boolean {
    const isExcluded = GitService.EXCLUDED_PATTERNS.some((pattern) =>
      pattern.test(filename)
    );
    console.log(`[GIT-FILTER] ${filename}: ${isExcluded ? 'EXCLUDED' : 'INCLUDED'}`);
    return !isExcluded;
  }

  constructor(private readonly githubToken: string) {}

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

    // Dev mode: create synthetic PR context from local git
    return await this.createDevModeContext();
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

    // GitHub Actions PR mode - use GitHub API
    if (
      github.context.eventName === 'pull_request' &&
      this.githubToken &&
      prContext.number > 0
    ) {
      return await this.getChangedFilesFromGitHub(prContext.number);
    }

    // Dev mode - use git commands
    return await this.getChangedFilesFromGit(
      prContext.baseSha,
      prContext.headSha
    );
  }

  private async getChangedFilesFromGitHub(
    prNumber: number
  ): Promise<ChangedFile[]> {
    try {
      const octokit = github.getOctokit(this.githubToken);
      const { data: files } = await octokit.rest.pulls.listFiles({
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
        `[GIT-SERVICE] Filtered ${files.length} files down to ${changedFiles.length} for analysis`
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
    try {
      const files: ChangedFile[] = [];

      // Get list of changed files with status
      let fileList = '';
      await exec.exec(
        'git',
        ['diff', '--name-status', `${baseSha}...${headSha}`],
        {
          listeners: {
            stdout: (data: Buffer) => {
              fileList += data.toString();
            },
          },
        }
      );

      // Parse file status
      const fileLines = fileList
        .trim()
        .split('\n')
        .filter((line) => line.trim());

      for (const line of fileLines) {
        const [status, filename] = line.split('\t');
        if (!filename || !this.shouldIncludeFile(filename)) continue;

        // Get diff patch for this file
        let patch = '';
        try {
          await exec.exec(
            'git',
            ['diff', `${baseSha}...${headSha}`, '--', filename],
            {
              listeners: {
                stdout: (data: Buffer) => {
                  patch += data.toString();
                },
              },
            }
          );
        } catch (error) {
          console.warn(`Failed to get patch for ${filename}:`, error);
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
    } catch (error) {
      console.error('Failed to get changed files from git:', error);
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
