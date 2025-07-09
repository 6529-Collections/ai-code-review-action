import * as github from '@actions/github';
import * as exec from '@actions/exec';
import { AICodeAnalyzer, CodeChange } from '../utils/ai-code-analyzer';
import { IGitService } from '../interfaces/git-service-interface';
import { logger } from '@/shared/logger/logger';
import { LoggerServices } from '@/shared/logger/constants';
import { FileExclusionPatterns } from '../utils/file-exclusion-patterns';

export interface ChangedFile {
  filename: string;
  status: 'added' | 'modified' | 'removed' | 'renamed';
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

export class GitService implements IGitService {
  private octokit: ReturnType<typeof github.getOctokit> | null = null;
  private aiAnalyzer: AICodeAnalyzer;

  private shouldIncludeFile(filename: string): boolean {
    const isIncluded = FileExclusionPatterns.shouldIncludeFile(filename);
    logger.debug(LoggerServices.GIT_SERVICE, `${filename}: ${isIncluded ? 'INCLUDED' : 'EXCLUDED'}`);
    return isIncluded;
  }

  constructor(
    private readonly githubToken: string,
    anthropicApiKey?: string
  ) {
    // Initialize GitHub API client if token is available
    if (this.githubToken) {
      try {
        this.octokit = github.getOctokit(this.githubToken);
      } catch (error) {
        logger.warn(LoggerServices.GIT_SERVICE, `Failed to initialize GitHub API client: ${error}`);
      }
    }

    // Initialize AI analyzer - use environment variable if not provided
    const apiKey = anthropicApiKey || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        '[GIT-SERVICE] ANTHROPIC_API_KEY is required for AI code analysis'
      );
    }
    this.aiAnalyzer = new AICodeAnalyzer(apiKey);
  }

  async getEnhancedChangedFiles(): Promise<CodeChange[]> {
    logger.info(LoggerServices.GIT_SERVICE, 'Getting enhanced changed files with AI code analysis');

    // Get basic changed files first
    const changedFiles = await this.getChangedFiles();

    if (changedFiles.length === 0) {
      logger.info(LoggerServices.GIT_SERVICE, 'No changed files to analyze');
      return [];
    }

    // Prepare files for concurrent AI analysis
    const filesToAnalyze = changedFiles.map((file) => ({
      filename: file.filename,
      diffPatch: file.patch || '',
      changeType:
        file.status === 'removed'
          ? ('deleted' as const)
          : (file.status as 'added' | 'modified' | 'renamed'),
    }));

    logger.info(LoggerServices.GIT_SERVICE, `Starting AI analysis of ${filesToAnalyze.length} files`);

    // Use AICodeAnalyzer for processing changed files
    const codeChanges =
      await this.aiAnalyzer.processChangedFilesConcurrently(filesToAnalyze);

    logger.info(LoggerServices.GIT_SERVICE, `AI analysis completed: ${codeChanges.length}/${filesToAnalyze.length} files processed successfully`);

    // Log cache statistics
    const cacheStats = this.aiAnalyzer.getCacheStats();
    logger.info(LoggerServices.GIT_SERVICE, `Cache stats: ${cacheStats.size} entries, TTL: ${cacheStats.ttlMs}ms`);

    return codeChanges;
  }

  async getPullRequestContext(): Promise<PullRequestContext | null> {
    // Check for manual PR review environment variables first
    const manualPrNumber = process.env.GITHUB_CONTEXT_ISSUE_NUMBER;
    const manualBaseSha = process.env.GITHUB_CONTEXT_PR_BASE_SHA;
    const manualHeadSha = process.env.GITHUB_CONTEXT_PR_HEAD_SHA;
    
    if (manualPrNumber && manualBaseSha && manualHeadSha) {
      logger.info(LoggerServices.GIT_SERVICE, `Using manual PR review context: #${manualPrNumber}`);
      
      // For manual PR review, we need to get PR details from GitHub API
      if (this.octokit) {
        try {
          const { data: pr } = await this.octokit.rest.pulls.get({
            ...github.context.repo,
            pull_number: parseInt(manualPrNumber),
          });
          
          return {
            number: pr.number,
            title: pr.title,
            body: pr.body || '',
            baseBranch: pr.base.ref,
            headBranch: pr.head.ref,
            baseSha: manualBaseSha,
            headSha: manualHeadSha,
          };
        } catch (error) {
          logger.error(LoggerServices.GIT_SERVICE, `Failed to fetch PR #${manualPrNumber}: ${error}`);
        }
      }
      
      // Fallback for manual review without GitHub API
      return {
        number: parseInt(manualPrNumber),
        title: `PR #${manualPrNumber}`,
        body: '',
        baseBranch: 'main', // Default assumption
        headBranch: 'feature-branch', // Default assumption
        baseSha: manualBaseSha,
        headSha: manualHeadSha,
      };
    }

    // Production mode: Handle GitHub Actions PR context
    if (github.context.eventName === 'pull_request') {
      const pr = github.context.payload.pull_request;
      if (pr) {
        logger.info(LoggerServices.GIT_SERVICE, `Using GitHub Actions PR context: #${pr.number}`);
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

    // Fallback for manual runs: Try to detect PR from current branch
    logger.info(LoggerServices.GIT_SERVICE, `Event: ${github.context.eventName}, attempting PR detection for current branch`);
    return await this.detectCurrentBranchPR();
  }


  async getChangedFiles(): Promise<ChangedFile[]> {
    const prContext = await this.getPullRequestContext();
    
    // Try GitHub API first if we have PR context
    if (prContext && prContext.number > 0 && this.octokit) {
      logger.info(LoggerServices.GIT_SERVICE, `PR Context: #${prContext.number}, event=${github.context.eventName}`);
      logger.info(LoggerServices.GIT_SERVICE, `Using GitHub API for PR #${prContext.number}`);
      return await this.getChangedFilesFromGitHub(prContext.number);
    }

    // Fallback to git-based diff if we have PR context but no GitHub API access
    if (prContext) {
      logger.info(LoggerServices.GIT_SERVICE, 'PR context found but no GitHub API access, using git diff');
      
      // For manual PR review, we prefer using SHAs for more accurate comparison
      const manualBaseSha = process.env.GITHUB_CONTEXT_PR_BASE_SHA;
      const manualHeadSha = process.env.GITHUB_CONTEXT_PR_HEAD_SHA;
      
      if (manualBaseSha && manualHeadSha) {
        logger.info(LoggerServices.GIT_SERVICE, `Using SHA-based comparison: ${manualBaseSha}...${manualHeadSha}`);
        return await this.getChangedFilesFromGitShas(manualBaseSha, manualHeadSha);
      }
      
      return await this.getChangedFilesFromGit(prContext.baseBranch, prContext.headBranch);
    }

    // Last resort: try to compare current branch against common base branches
    logger.info(LoggerServices.GIT_SERVICE, 'No PR context available, attempting git-based detection');
    const currentBranch = await this.getCurrentBranch();
    if (currentBranch) {
      logger.info(LoggerServices.GIT_SERVICE, `Current branch: ${currentBranch}`);
      
      // Try common base branches
      const baseBranches = ['main', 'master', 'develop'];
      for (const baseBranch of baseBranches) {
        if (await this.branchExists(baseBranch) && currentBranch !== baseBranch) {
          logger.info(LoggerServices.GIT_SERVICE, `Comparing ${currentBranch} against ${baseBranch}`);
          const files = await this.getChangedFilesFromGit(baseBranch, currentBranch);
          if (files.length > 0) {
            return files;
          }
        }
      }
    }

    logger.info(LoggerServices.GIT_SERVICE, 'No changed files found using any method');
    return [];
  }

  private async getChangedFilesFromGitHub(
    prNumber: number
  ): Promise<ChangedFile[]> {
    try {
      if (!this.octokit) {
        throw new Error('GitHub API client not initialized');
      }

      // Fetch all files using pagination (GitHub API returns max 30 per page)
      const allFiles = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const { data: files } = await this.octokit.rest.pulls.listFiles({
          ...github.context.repo,
          pull_number: prNumber,
          per_page: 100, // Maximum allowed by GitHub
          page: page,
        });

        allFiles.push(...files);

        // If we got less than 100 files, we've reached the end
        hasMore = files.length === 100;
        page++;

        // Safety limit to prevent infinite loops
        if (page > 10) {
          logger.warn(LoggerServices.GIT_SERVICE, 'Reached pagination limit, stopping at 1000 files');
          break;
        }
      }

      const changedFiles = allFiles
        .filter((file) => this.shouldIncludeFile(file.filename))
        .map((file) => ({
          filename: file.filename,
          status: file.status as ChangedFile['status'],
          additions: file.additions,
          deletions: file.deletions,
          patch: file.patch,
        }));

      logger.info(LoggerServices.GIT_SERVICE, `GitHub API: Filtered ${allFiles.length} files down to ${changedFiles.length} for analysis`);
      return changedFiles;
    } catch (error) {
      logger.error(LoggerServices.GIT_SERVICE, `Failed to get changed files from GitHub: ${error}`);
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
      logger.error(LoggerServices.GIT_SERVICE, `Failed to get diff content: ${error}`);
    }

    return diffOutput;
  }

  /**
   * Get current git branch name
   */
  private async getCurrentBranch(): Promise<string | null> {
    let branchOutput = '';
    
    try {
      await exec.exec('git', ['branch', '--show-current'], {
        listeners: {
          stdout: (data: Buffer) => {
            branchOutput += data.toString();
          },
        },
      });
      
      const branch = branchOutput.trim();
      logger.debug(LoggerServices.GIT_SERVICE, `Current branch: ${branch}`);
      return branch || null;
    } catch (error) {
      logger.error(LoggerServices.GIT_SERVICE, `Failed to get current branch: ${error}`);
      return null;
    }
  }

  /**
   * Check if a branch exists
   */
  private async branchExists(branchName: string): Promise<boolean> {
    try {
      await exec.exec('git', ['show-ref', '--verify', '--quiet', `refs/heads/${branchName}`]);
      return true;
    } catch (error) {
      // Try remote branch
      try {
        await exec.exec('git', ['show-ref', '--verify', '--quiet', `refs/remotes/origin/${branchName}`]);
        return true;
      } catch (remoteError) {
        return false;
      }
    }
  }

  /**
   * Detect PR context from current branch using GitHub API
   */
  private async detectCurrentBranchPR(): Promise<PullRequestContext | null> {
    if (!this.octokit) {
      logger.info(LoggerServices.GIT_SERVICE, 'No GitHub API client available for PR detection');
      return null;
    }

    const currentBranch = await this.getCurrentBranch();
    if (!currentBranch) {
      logger.warn(LoggerServices.GIT_SERVICE, 'Could not determine current branch');
      return null;
    }

    try {
      logger.info(LoggerServices.GIT_SERVICE, `Searching for open PRs from branch: ${currentBranch}`);
      
      // Search for open PRs from current branch
      const { data: pullRequests } = await this.octokit.rest.pulls.list({
        ...github.context.repo,
        state: 'open',
        head: `${github.context.repo.owner}:${currentBranch}`,
      });

      if (pullRequests.length > 0) {
        const pr = pullRequests[0]; // Use the first matching PR
        logger.info(LoggerServices.GIT_SERVICE, `Found PR #${pr.number} for branch ${currentBranch}`);
        
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

      logger.info(LoggerServices.GIT_SERVICE, `No open PR found for branch: ${currentBranch}`);
      return null;
    } catch (error) {
      logger.error(LoggerServices.GIT_SERVICE, `Failed to search for PRs: ${error}`);
      return null;
    }
  }

  /**
   * Get changed files using git diff commands
   */
  private async getChangedFilesFromGit(
    baseBranch: string,
    headBranch: string
  ): Promise<ChangedFile[]> {
    try {
      logger.info(LoggerServices.GIT_SERVICE, `Getting changed files via git diff: ${baseBranch}...${headBranch}`);
      
      // Get list of changed files with status
      let filesOutput = '';
      await exec.exec('git', ['diff', '--name-status', `${baseBranch}...${headBranch}`], {
        listeners: {
          stdout: (data: Buffer) => {
            filesOutput += data.toString();
          },
        },
      });

      if (!filesOutput.trim()) {
        logger.info(LoggerServices.GIT_SERVICE, 'No files changed according to git diff');
        return [];
      }

      // Parse the output
      const lines = filesOutput.trim().split('\n');
      const changedFiles: ChangedFile[] = [];

      for (const line of lines) {
        const match = line.match(/^([AMDRT])\s+(.+)$/);
        if (match) {
          const [, statusChar, filename] = match;
          
          // Skip excluded files
          if (!this.shouldIncludeFile(filename)) {
            continue;
          }

          const status = this.mapGitStatusToChangeStatus(statusChar);
          
          // Get the patch for this file
          let patch = '';
          try {
            await exec.exec('git', ['diff', `${baseBranch}...${headBranch}`, '--', filename], {
              listeners: {
                stdout: (data: Buffer) => {
                  patch += data.toString();
                },
              },
            });
          } catch (patchError) {
            logger.warn(LoggerServices.GIT_SERVICE, `Failed to get patch for ${filename}: ${patchError}`);
          }

          changedFiles.push({
            filename,
            status,
            patch: patch || undefined,
          });
        }
      }

      logger.info(LoggerServices.GIT_SERVICE, `Git diff: Found ${changedFiles.length} changed files`);
      return changedFiles;
    } catch (error) {
      logger.error(LoggerServices.GIT_SERVICE, `Failed to get changed files from git: ${error}`);
      return [];
    }
  }

  /**
   * Get changed files using git diff with specific SHAs
   */
  private async getChangedFilesFromGitShas(
    baseSha: string,
    headSha: string
  ): Promise<ChangedFile[]> {
    try {
      logger.info(LoggerServices.GIT_SERVICE, `Getting changed files via git diff: ${baseSha}...${headSha}`);
      
      // Get list of changed files with status
      let filesOutput = '';
      await exec.exec('git', ['diff', '--name-status', `${baseSha}...${headSha}`], {
        listeners: {
          stdout: (data: Buffer) => {
            filesOutput += data.toString();
          },
        },
      });

      if (!filesOutput.trim()) {
        logger.info(LoggerServices.GIT_SERVICE, 'No files changed according to git diff');
        return [];
      }

      // Parse the output
      const lines = filesOutput.trim().split('\n');
      const changedFiles: ChangedFile[] = [];

      for (const line of lines) {
        const match = line.match(/^([AMDRT])\s+(.+)$/);
        if (match) {
          const [, statusChar, filename] = match;
          
          // Skip excluded files
          if (!this.shouldIncludeFile(filename)) {
            continue;
          }

          const status = this.mapGitStatusToChangeStatus(statusChar);
          
          // Get the patch for this file
          let patch = '';
          try {
            await exec.exec('git', ['diff', `${baseSha}...${headSha}`, '--', filename], {
              listeners: {
                stdout: (data: Buffer) => {
                  patch += data.toString();
                },
              },
            });
          } catch (patchError) {
            logger.warn(LoggerServices.GIT_SERVICE, `Failed to get patch for ${filename}: ${patchError}`);
          }

          changedFiles.push({
            filename,
            status,
            patch: patch || undefined,
          });
        }
      }

      logger.info(LoggerServices.GIT_SERVICE, `Git diff (SHA): Found ${changedFiles.length} changed files`);
      return changedFiles;
    } catch (error) {
      logger.error(LoggerServices.GIT_SERVICE, `Failed to get changed files from git SHAs: ${error}`);
      return [];
    }
  }

  /**
   * Map git status characters to ChangedFile status
   */
  private mapGitStatusToChangeStatus(
    gitStatus: string
  ): ChangedFile['status'] {
    switch (gitStatus) {
      case 'A':
        return 'added';
      case 'M':
        return 'modified';
      case 'D':
        return 'removed';
      case 'R':
        return 'renamed';
      case 'T': // Type change (rare)
        return 'modified';
      default:
        return 'modified';
    }
  }
}
