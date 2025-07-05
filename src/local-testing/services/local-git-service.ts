import { AICodeAnalyzer, CodeChange } from '@/shared/utils/ai-code-analyzer';
import { ChangedFile, PullRequestContext } from '@/shared/services/git-service';
import { IGitService } from '@/shared/interfaces/git-service-interface';
import { LocalDiffService } from './local-diff-service';
import { DiffModeConfig } from '../config/diff-modes';

/**
 * LocalGitService provides Git operations specifically for local testing
 * Simplified version focused on uncommitted changes analysis
 */
export class LocalGitService implements IGitService {
  private aiAnalyzer: AICodeAnalyzer;
  private localDiffService: LocalDiffService;

  constructor(anthropicApiKey: string, diffModeConfig?: DiffModeConfig) {
    // Initialize AI analyzer for code analysis
    if (!anthropicApiKey) {
      throw new Error('[LOCAL-GIT-SERVICE] ANTHROPIC_API_KEY is required for AI code analysis');
    }
    this.aiAnalyzer = new AICodeAnalyzer(anthropicApiKey);
    
    // Initialize local diff service
    this.localDiffService = new LocalDiffService(diffModeConfig);
    
    console.log('[LOCAL-GIT-SERVICE] Initialized for local testing');
    const modeInfo = this.localDiffService.getCurrentMode();
    console.log(`[LOCAL-GIT-SERVICE] Using mode: ${modeInfo.name} - ${modeInfo.description}`);
  }

  /**
   * Get enhanced changed files with AI code analysis for local testing
   */
  async getEnhancedChangedFiles(): Promise<CodeChange[]> {
    console.log('[LOCAL-GIT-SERVICE] Getting enhanced changed files for local testing');

    // Get changed files using local diff service
    const changedFiles = await this.localDiffService.getChangedFiles();

    if (changedFiles.length === 0) {
      console.log('[LOCAL-GIT-SERVICE] No changed files to analyze');
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
      `[LOCAL-GIT-SERVICE] Starting concurrent AI analysis of ${filesToAnalyze.length} files`
    );

    // Use AICodeAnalyzer with ConcurrencyManager for parallel processing
    const codeChanges =
      await this.aiAnalyzer.processChangedFilesConcurrently(filesToAnalyze);

    console.log(
      `[LOCAL-GIT-SERVICE] AI analysis completed: ${codeChanges.length}/${filesToAnalyze.length} files processed successfully`
    );

    // Log cache statistics
    const cacheStats = this.aiAnalyzer.getCacheStats();
    console.log(
      `[LOCAL-GIT-SERVICE] Cache stats: ${cacheStats.size} entries, TTL: ${cacheStats.ttlMs}ms`
    );

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
    console.log('[LOCAL-GIT-SERVICE] Creating synthetic PR context for local testing');
    
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