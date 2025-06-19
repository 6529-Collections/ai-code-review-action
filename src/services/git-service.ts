import * as github from '@actions/github';
import * as exec from '@actions/exec';

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
  constructor(private readonly githubToken: string) {}

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

      return files.map((file) => ({
        filename: file.filename,
        status: file.status as ChangedFile['status'],
        additions: file.additions,
        deletions: file.deletions,
        patch: file.patch,
      }));
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
        if (!filename) continue;

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

        files.push({
          filename,
          status: this.mapGitStatusToChangedFileStatus(status),
          additions,
          deletions,
          patch,
        });
      }

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
