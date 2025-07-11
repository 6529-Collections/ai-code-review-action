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
import { logger, Logger } from '@/shared/logger/logger';
import { performanceTracker } from '@/shared/utils/performance-tracker';
import { ReviewService } from '@/review/services/review-service';
import { GitHubCommentService } from '@/review/services/github-comment-service';
import { ReviewResult } from '@/review/types/review-types';


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

    // Development Mode: Run Phase 2 review only with test data
    const isDevelopmentReviewMode = process.env.DEV_MODE_PHASE2_ONLY === 'true';
    if (isDevelopmentReviewMode) {
      logger.info('MAIN', 'Development mode: Running Phase 2 review only with test data');
      
      try {
        performanceTracker.startTiming('Phase 2 Development Review');
        
        const reviewService = new ReviewService(inputs.anthropicApiKey);
        const testFile = process.env.TEST_OUTPUT_FILE;
        
        const reviewResult = testFile 
          ? await reviewService.reviewFromTestOutput(testFile)
          : await reviewService.reviewFromTestOutput();
        
        logger.info('MAIN', `Development review completed: ${reviewResult.overallRecommendation} (${reviewResult.nodeReviews.length} nodes)`);
        logger.info('MAIN', reviewResult.summary);
        
        if (isLocal) {
          try {
            const savedPath = await OutputSaver.saveReviewResults(
              reviewResult,
              'development-mode'
            );
            logger.info('MAIN', `Development review results saved to: ${savedPath}`);
          } catch (saveError) {
            logger.warn('MAIN', `Failed to save development review results: ${saveError}`);
          }
        }
        
        performanceTracker.endTiming('Phase 2 Development Review');
        performanceTracker.endTiming('Total AI Code Review');
        performanceTracker.generateReport();
        
        return;
      } catch (devError) {
        logger.error('MAIN', `Development mode review failed: ${devError}`);
        throw devError;
      }
    }

    // Clean previous output files only for full pipeline runs (not development mode)
    if (isLocal) {
      logger.info('MAIN', 'Full pipeline mode: Cleaning previous output files for fresh start');
      OutputSaver.cleanAllAnalyses();
    }

    // Log mode (isLocal already defined above)
    logger.info('MAIN', `Running in ${isLocal ? 'LOCAL TESTING' : 'PRODUCTION'} mode`);

    performanceTracker.startTiming('Setup');

    // Install Claude Code CLI (only in production or when explicitly needed)
    if (!isLocal) {
      logger.info('MAIN', 'Installing Claude Code CLI...');
      await exec.exec('npm', ['install', '-g', '@anthropic-ai/claude-code'], { silent: true });
      logger.info('MAIN', 'Claude Code CLI installed successfully');

      // Initialize Claude CLI configuration to avoid JSON config errors
      logger.info('MAIN', 'Initializing Claude CLI configuration...');
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
      logger.info('MAIN', 'Claude CLI configuration initialized');
    } else {
      logger.info('MAIN', 'Skipping Claude CLI installation in local testing mode');
    }

    performanceTracker.endTiming('Setup');

    logger.info('MAIN', 'Starting AI code review analysis...');

    // Initialize services based on environment
    const gitService: IGitService = isLocal 
      ? new LocalGitService(inputs.anthropicApiKey)
      : new GitService(inputs.githubToken || '', inputs.anthropicApiKey);

    // Initialize theme service with AI-driven expansion
    const themeService = new ThemeService(inputs.anthropicApiKey);

    logger.info('MAIN', 'Using AI-driven theme expansion for natural hierarchy depth');

    performanceTracker.startTiming('Git Operations');
    
    // Get PR context and changed files
    const prContext = await gitService.getPullRequestContext();
    const changedFiles = await gitService.getChangedFiles();

    performanceTracker.endTiming('Git Operations');

    // Log mode-specific info
    if (isLocal) {
      if (gitService instanceof LocalGitService) {
        const modeInfo = gitService.getCurrentMode();
        logger.info('MAIN', `Local testing mode: ${modeInfo.name} - ${modeInfo.description}`);
      }
    } else if (prContext && prContext.number === 0) {
      logger.info('MAIN', 
        `Dev mode: Comparing ${prContext.headBranch} against ${prContext.baseBranch}`
      );
      logger.info('MAIN', `Base SHA: ${prContext.baseSha.substring(0, 8)}`);
      logger.info('MAIN', `Head SHA: ${prContext.headSha.substring(0, 8)}`);
    }

    logger.info('MAIN', `Found ${changedFiles.length} changed files`);

    if (changedFiles.length === 0) {
      const message = isLocal 
        ? 'No uncommitted changes found, skipping analysis'
        : 'No files changed in this PR, skipping analysis';
      logger.info('MAIN', message);
      core.setOutput('themes', JSON.stringify([]));
      core.setOutput('summary', message);
      return;
    }

    // Analyze themes
    performanceTracker.startTiming('Theme Analysis');
    logger.info('MAIN', 'Analyzing code themes...');
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

      // TODO: Remove production output writing (debugging only)
      // logger.debug('MAIN', 'Setting outputs...');
      // core.setOutput('themes', detailedThemes);
      // core.setOutput('summary', safeSummary);
      // logger.debug('MAIN', 'Outputs set successfully');

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
          logger.info('MAIN', `Analysis saved to: ${savedPath}`);
        } catch (saveError) {
          logger.warn('MAIN', `Failed to save analysis: ${saveError}`);
        }
      }

      // TODO: Remove production output logging (debugging only)
      // logInfo(`Set outputs - ${themeAnalysis.totalThemes} themes processed`);

      // Log expansion statistics if available
      if (themeAnalysis.expansionStats) {
        logger.info('MAIN',
          `Expansion: ${themeAnalysis.expansionStats.expandedThemes} themes expanded, max depth: ${themeAnalysis.expansionStats.maxDepth}`
        );
      }
    } catch (error) {
      logger.error('MAIN', `Error in output formatting: ${error}`);
      if (error instanceof Error && error.stack) {
        logger.debug('MAIN', `Error stack: ${error.stack}`);
      }
      logger.error('MAIN', `Failed to set outputs: ${error}`);
      // TODO: Remove production output writing (debugging only)
      // core.setOutput('themes', 'No themes found');
      // core.setOutput('summary', 'Output generation failed');
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

    // Phase 2: Code Review (production mode only - development mode already returned)
    const shouldRunReview = !isDevelopmentReviewMode;
    if (shouldRunReview) {
      performanceTracker.startTiming('Phase 2 Review');
      
      try {
        logger.info('MAIN', 'Starting Phase 2: AI Code Review...');
        
        const reviewService = new ReviewService(inputs.anthropicApiKey);
        const reviewResult = await reviewService.reviewThemes(themeAnalysis.themes);
        
        logger.info('MAIN', `Review completed: ${reviewResult.overallRecommendation} (${reviewResult.nodeReviews.length} nodes reviewed)`);
        logger.info('MAIN', reviewResult.summary);
        
        // Handle output based on environment
        if (isLocal && gitService instanceof LocalGitService) {
          // Local testing: Save to files
          try {
            const modeInfo = gitService.getCurrentMode();
            const savedPath = await OutputSaver.saveReviewResults(
              reviewResult,
              modeInfo.name
            );
            logger.info('MAIN', `Review results saved to: ${savedPath}`);
          } catch (saveError) {
            logger.warn('MAIN', `Failed to save review results: ${saveError}`);
          }
        } else {
          // Production: Post to PR comments
          try {
            logger.info('MAIN', 'Posting review results to PR comments...');
            
            const commentService = new GitHubCommentService(inputs.githubToken || '');
            
            // Post main review comment
            await commentService.postMainReviewComment(reviewResult);
            
            // Post detailed comments for significant issues
            await commentService.postDetailedNodeComments(reviewResult);
            
            // Post action items summary if there are critical/major issues
            if (reviewResult.overallRecommendation !== 'approve') {
              await commentService.postActionItemsSummary(reviewResult);
            }
            
            logger.info('MAIN', 'PR comments posted successfully');
            
          } catch (commentError) {
            logger.error('MAIN', `Failed to post PR comments: ${commentError}`);
            // Don't fail the pipeline for comment errors
          }
        }
        
      } catch (reviewError) {
        logger.error('MAIN', `Phase 2 review failed: ${reviewError}`);
        // Continue execution - review failure shouldn't break the pipeline
      }
      
      performanceTracker.endTiming('Phase 2 Review');
    }
    // Note: Development mode already executed and returned early, so no else clause needed

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
