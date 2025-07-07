import * as github from '@actions/github';
import * as exec from '@actions/exec';
import { AICodeAnalyzer, CodeChange } from '../utils/ai-code-analyzer';
import { IGitService } from '../interfaces/git-service-interface';

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
  // Patterns for files to exclude from analysis
  private static readonly EXCLUDED_PATTERNS = [
    /^dist\//, // Exclude dist folder
    /\.d\.ts$/, // Exclude TypeScript declaration files
    /node_modules\//, // Exclude dependencies
    /\.map$/, // Exclude source maps
    /package-lock\.json$/, // Exclude lock files
  ];

  private octokit: ReturnType<typeof github.getOctokit> | null = null;
  private aiAnalyzer: AICodeAnalyzer;

  private shouldIncludeFile(filename: string): boolean {
    const isExcluded = GitService.EXCLUDED_PATTERNS.some((pattern) =>
      pattern.test(filename)
    );
    console.log(
      `[GIT-FILTER] ${filename}: ${isExcluded ? 'EXCLUDED' : 'INCLUDED'}`
    );
    return !isExcluded;
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
        console.warn(
          '[GIT-SERVICE] Failed to initialize GitHub API client:',
          error
        );
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
    console.log(
      '[GIT-SERVICE] Getting enhanced changed files with AI code analysis'
    );

    // Get basic changed files first
    const changedFiles = await this.getChangedFiles();

    if (changedFiles.length === 0) {
      console.log('[GIT-SERVICE] No changed files to analyze');
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

    console.log(
      `[GIT-SERVICE] Starting AI analysis of ${filesToAnalyze.length} files`
    );

    // Use AICodeAnalyzer for processing changed files
    const codeChanges =
      await this.aiAnalyzer.processChangedFilesConcurrently(filesToAnalyze);

    console.log(
      `[GIT-SERVICE] AI analysis completed: ${codeChanges.length}/${filesToAnalyze.length} files processed successfully`
    );

    // Log cache statistics
    const cacheStats = this.aiAnalyzer.getCacheStats();
    console.log(
      `[GIT-SERVICE] Cache stats: ${cacheStats.size} entries, TTL: ${cacheStats.ttlMs}ms`
    );

    return codeChanges;
  }

  async getPullRequestContext(): Promise<PullRequestContext | null> {
    // Production mode: Only handle GitHub Actions PR context
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

    console.log('[GIT-SERVICE] No PR context found in GitHub Actions');
    return null;
  }


  async getChangedFiles(): Promise<ChangedFile[]> {
    const prContext = await this.getPullRequestContext();
    if (!prContext) {
      console.log('[GIT-SERVICE] No PR context available, returning empty file list');
      return [];
    }

    console.log(
      `[GIT-SERVICE] PR Context: #${prContext.number}, event=${github.context.eventName}`
    );

    // Production mode: Use GitHub API for PR files
    if (prContext.number > 0 && this.octokit) {
      console.log(`[GIT-SERVICE] Using GitHub API for PR #${prContext.number}`);
      return await this.getChangedFilesFromGitHub(prContext.number);
    }

    console.log('[GIT-SERVICE] No GitHub API access or invalid PR context');
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
          console.warn(
            '[GIT-SERVICE] Reached pagination limit, stopping at 1000 files'
          );
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

      console.log(
        `[GIT-SERVICE] GitHub API: Filtered ${allFiles.length} files down to ${changedFiles.length} for analysis`
      );
      return changedFiles;
    } catch (error) {
      console.error('Failed to get changed files from GitHub:', error);
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
