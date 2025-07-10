import { AICodeAnalyzer, CodeChange } from '@/shared/utils/ai-code-analyzer';
import { ChangedFile, PullRequestContext } from '@/shared/services/git-service';
import { IGitService } from '@/shared/interfaces/git-service-interface';
import { LocalDiffService } from './local-diff-service';
import { DiffModeConfig, DiffModeType, DEFAULT_DIFF_MODE_CONFIG } from '../config/diff-modes';

/**
 * LocalGitService provides Git operations specifically for local testing
 * Simplified version focused on uncommitted changes analysis
 */
export class LocalGitService implements IGitService {
  private aiAnalyzer: AICodeAnalyzer;
  private localDiffService: LocalDiffService;

  constructor(anthropicApiKey: string, diffModeConfig?: DiffModeConfig) {
    if (!anthropicApiKey) {
      throw new Error('ANTHROPIC_API_KEY is required for AI code analysis');
    }
    this.aiAnalyzer = new AICodeAnalyzer(anthropicApiKey);
    
    // Use provided config, otherwise check environment, otherwise use default
    const config = diffModeConfig || this.getDiffModeFromEnv();
    this.localDiffService = new LocalDiffService(config);
  }

  /**
   * Get diff mode configuration from environment variables
   * Supports DIFF_MODE environment variable with values: 'uncommitted', 'branch'
   */
  private getDiffModeFromEnv(): DiffModeConfig {
    const envMode = process.env.DIFF_MODE as DiffModeType;
    
    // Validate the environment variable value
    if (envMode && Object.values(DiffModeType).includes(envMode)) {
      return { mode: envMode };
    }
    
    // Return default if no valid environment variable found
    return DEFAULT_DIFF_MODE_CONFIG;
  }

  /**
   * Get enhanced changed files with AI code analysis for local testing
   */
  async getEnhancedChangedFiles(): Promise<CodeChange[]> {

    // Get changed files using local diff service
    const changedFiles = await this.localDiffService.getChangedFiles();

    if (changedFiles.length === 0) {
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


    // Use AICodeAnalyzer for processing changed files
    const codeChanges =
      await this.aiAnalyzer.processChangedFilesConcurrently(filesToAnalyze);



    return codeChanges;
  }

  /**
   * Get basic changed files (without AI analysis) for local testing
   */
  async getChangedFiles(): Promise<ChangedFile[]> {
    return await this.localDiffService.getChangedFiles();
  }

  /**
   * Get synthetic PR context for local testing
   * Always returns a dev mode context since we're not dealing with real PRs
   */
  async getPullRequestContext(): Promise<PullRequestContext | null> {
    const modeInfo = this.localDiffService.getCurrentMode();
    
    return {
      number: 0, // Synthetic PR number
      title: `Local ${modeInfo.name} changes`,
      body: modeInfo.description,
      baseBranch: 'local-base',
      headBranch: 'local-head',
      baseSha: 'local-base-sha',
      headSha: 'local-head-sha',
    };
  }

  /**
   * Get full diff content for local testing
   */
  async getDiffContent(): Promise<string> {
    return await this.localDiffService.getDiffContent();
  }

  /**
   * Get current mode information
   */
  getCurrentMode(): { name: string; description: string } {
    return this.localDiffService.getCurrentMode();
  }
}