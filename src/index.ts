import * as core from '@actions/core';
import * as exec from '@actions/exec';
import { validateInputs } from './validation';
import { handleError, logInfo } from './utils';
import { GitService } from '@/shared/services/git-service';
import { LocalGitService } from '@/local-testing';
import { IGitService } from '@/shared/interfaces/git-service-interface';
import { OutputSaver } from '@/local-testing/services/output-saver';
import { ThemeService } from '@/mindmap/services/theme-service';
import { ThemeFormatter } from '@/mindmap/utils/theme-formatter';
import { logger, Logger } from '@/shared/utils/logger';
import { performanceTracker } from '@/shared/utils/performance-tracker';

/**
 * Detect if we're running in local testing mode
 */
function isLocalTesting(): boolean {
  return process.env.ACT === 'true' || 
         process.env.LOCAL_TESTING === 'true' ||
         process.env.NODE_ENV === 'development';
}

export async function run(): Promise<void> {
  const isLocal = isLocalTesting();
  let logFilePath: string | null = null;

  try {
    // Initialize live logging for local testing
    if (isLocal) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      logFilePath = await OutputSaver.initializeLogFile(timestamp);
      Logger.initializeLiveLogging(logFilePath);
      logger.info('MAIN', 'Live logging initialized for local testing');
    }

    // Reset performance tracker for this run
    performanceTracker.reset();
    performanceTracker.startTiming('Total AI Code Review');

    const inputs = validateInputs();

    // Set Anthropic API key for Claude CLI
    process.env.ANTHROPIC_API_KEY = inputs.anthropicApiKey;

    // Log mode (isLocal already defined above)
    logInfo(`Running in ${isLocal ? 'LOCAL TESTING' : 'PRODUCTION'} mode`);

    performanceTracker.startTiming('Setup');

    // Install Claude Code CLI (only in production or when explicitly needed)
    if (!isLocal) {
      logInfo('Installing Claude Code CLI...');
      await exec.exec('npm', ['install', '-g', '@anthropic-ai/claude-code'], { silent: true });
      logInfo('Claude Code CLI installed successfully');

      // Initialize Claude CLI configuration to avoid JSON config errors
      logInfo('Initializing Claude CLI configuration...');
      const claudeConfig = {
        allowedTools: [],
        hasTrustDialogAccepted: true,
        permissions: {
          allow: ['*'],
        },
      };
      await exec.exec('bash', [
        '-c',
        `echo '${JSON.stringify(claudeConfig)}' > /root/.claude.json || true`,
      ], { silent: true });
      logInfo('Claude CLI configuration initialized');
    } else {
      logInfo('Skipping Claude CLI installation in local testing mode');
    }

    performanceTracker.endTiming('Setup');

    logInfo('Starting AI code review analysis...');

    // Initialize services based on environment
    const gitService: IGitService = isLocal 
      ? new LocalGitService(inputs.anthropicApiKey)
      : new GitService(inputs.githubToken || '', inputs.anthropicApiKey);

    // Initialize theme service with AI-driven expansion
    const themeService = new ThemeService(inputs.anthropicApiKey);

    logInfo('Using AI-driven theme expansion for natural hierarchy depth');

    performanceTracker.startTiming('Git Operations');
    
    // Get PR context and changed files
    const prContext = await gitService.getPullRequestContext();
    const changedFiles = await gitService.getChangedFiles();

    performanceTracker.endTiming('Git Operations');

    // Log mode-specific info
    if (isLocal) {
      if (gitService instanceof LocalGitService) {
        const modeInfo = gitService.getCurrentMode();
        logInfo(`Local testing mode: ${modeInfo.name} - ${modeInfo.description}`);
      }
    } else if (prContext && prContext.number === 0) {
      logInfo(
        `Dev mode: Comparing ${prContext.headBranch} against ${prContext.baseBranch}`
      );
      logInfo(`Base SHA: ${prContext.baseSha.substring(0, 8)}`);
      logInfo(`Head SHA: ${prContext.headSha.substring(0, 8)}`);
    }

    logInfo(`Found ${changedFiles.length} changed files`);

    if (changedFiles.length === 0) {
      const message = isLocal 
        ? 'No uncommitted changes found, skipping analysis'
        : 'No files changed in this PR, skipping analysis';
      logInfo(message);
      core.setOutput('themes', JSON.stringify([]));
      core.setOutput('summary', message);
      return;
    }

    // Analyze themes
    performanceTracker.startTiming('Theme Analysis');
    logInfo('Analyzing code themes...');
    const themeAnalysis =
      await themeService.analyzeThemesWithEnhancedContext(gitService);
    performanceTracker.endTiming('Theme Analysis');

    // Debug: Log theme analysis result
    logger.debug('MAIN', `Theme analysis completed: ${themeAnalysis.totalThemes} themes in ${themeAnalysis.processingTime}ms`);
    logger.debug('MAIN', `Themes array length: ${themeAnalysis.themes?.length || 'undefined'}`);
    logger.debug('MAIN', `Has expansion stats: ${!!themeAnalysis.expansionStats}`);

    if (themeAnalysis.themes) {
      logger.debug('MAIN', `Theme names: ${themeAnalysis.themes.map((t) => t.name).join(', ')}`);
    } else {
      logger.warn('MAIN', 'Themes is null/undefined!');
    }

    // Output results using enhanced formatter
    performanceTracker.startTiming('Output Generation');
    try {
      logger.debug('MAIN', 'Starting output formatting...');

      // Use the new ThemeFormatter for better hierarchical display
      const detailedThemes = ThemeFormatter.formatThemesForOutput(
        themeAnalysis.themes
      );
      logger.debug('MAIN', `Detailed themes formatted, length: ${detailedThemes?.length || 'undefined'}`);

      const safeSummary = ThemeFormatter.createThemeSummary(
        themeAnalysis.themes
      );
      logger.debug('MAIN', `Summary created, length: ${safeSummary?.length || 'undefined'}`);

      logger.debug('MAIN', 'Setting outputs...');
      core.setOutput('themes', detailedThemes);
      core.setOutput('summary', safeSummary);
      logger.debug('MAIN', 'Outputs set successfully');

      // Save analysis results for local testing
      if (isLocal && gitService instanceof LocalGitService) {
        try {
          const modeInfo = gitService.getCurrentMode();
          const savedPath = await OutputSaver.saveAnalysis(
            detailedThemes,
            safeSummary,
            themeAnalysis,
            modeInfo.name
          );
          logInfo(`Analysis saved to: ${savedPath}`);
          
          // Clean up old files (keep last 10)
          OutputSaver.cleanupOldAnalyses(10);
        } catch (saveError) {
          logger.warn('MAIN', `Failed to save analysis: ${saveError}`);
        }
      }

      logInfo(`Set outputs - ${themeAnalysis.totalThemes} themes processed`);

      // Log expansion statistics if available
      if (themeAnalysis.expansionStats) {
        logInfo(
          `Expansion: ${themeAnalysis.expansionStats.expandedThemes} themes expanded, max depth: ${themeAnalysis.expansionStats.maxDepth}`
        );
      }
    } catch (error) {
      logger.error('MAIN', `Error in output formatting: ${error}`);
      if (error instanceof Error && error.stack) {
        logger.debug('MAIN', `Error stack: ${error.stack}`);
      }
      logger.error('MAIN', `Failed to set outputs: ${error}`);
      core.setOutput('themes', 'No themes found');
      core.setOutput('summary', 'Output generation failed');
    }
    performanceTracker.endTiming('Output Generation');

    logger.info('MAIN', `Analysis complete: Found ${themeAnalysis.totalThemes} themes in ${themeAnalysis.processingTime}ms`);

    // Log theme names only (not full JSON)
    if (themeAnalysis.themes.length > 0) {
      const themeNames = themeAnalysis.themes.map((t) => t.name).join(', ');
      logger.info('MAIN', `Themes: ${themeNames}`);
    }

    // Log expansion statistics if available
    if (themeAnalysis.expansionStats) {
      logger.info('MAIN', 
        `Expansion: ${themeAnalysis.expansionStats.expandedThemes} themes expanded, max depth: ${themeAnalysis.expansionStats.maxDepth}`
      );
    }

    // End total timing and generate comprehensive performance report
    performanceTracker.endTiming('Total AI Code Review');
    performanceTracker.generateReport();

  } catch (error) {
    handleError(error);
  } finally {
    // Close live logging if it was initialized
    if (isLocal && logFilePath) {
      Logger.closeLiveLogging();
      logger.info('MAIN', 'Live logging closed');
    }
  }
}


if (require.main === module) {
  run();
}
