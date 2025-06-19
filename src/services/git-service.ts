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
    if (github.context.eventName !== 'pull_request') {
      return null;
    }

    const pr = github.context.payload.pull_request;
    if (!pr) {
      return null;
    }

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

  async getChangedFiles(): Promise<ChangedFile[]> {
    const prContext = await this.getPullRequestContext();
    if (!prContext) {
      return [];
    }

    if (!this.githubToken) {
      return [];
    }

    const octokit = github.getOctokit(this.githubToken);

    try {
      const { data: files } = await octokit.rest.pulls.listFiles({
        ...github.context.repo,
        pull_number: prContext.number,
      });

      return files.map((file) => ({
        filename: file.filename,
        status: file.status as ChangedFile['status'],
        additions: file.additions,
        deletions: file.deletions,
        patch: file.patch,
      }));
    } catch (error) {
      console.error('Failed to get changed files:', error);
      return [];
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
