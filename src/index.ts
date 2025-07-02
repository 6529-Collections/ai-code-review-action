import * as core from '@actions/core';
import * as exec from '@actions/exec';
import { validateInputs } from './validation';
import { handleError, logInfo } from './utils';
import { GitService } from './services/git-service';
import { ThemeService } from './services/theme-service';
import { ThemeFormatter } from './utils/theme-formatter';
import { logger } from './utils/logger';
import { performanceTracker } from './utils/performance-tracker';

export async function run(): Promise<void> {
  const mainContext = logger.startOperation('AI Code Review');
  
  try {
    logger.logProcess('Starting AI Code Review analysis');
    
    // Reset performance tracker for this run
    performanceTracker.reset();
    performanceTracker.startTiming('Total AI Code Review');

    const inputs = validateInputs();

    // Set Anthropic API key for Claude CLI
    process.env.ANTHROPIC_API_KEY = inputs.anthropicApiKey;

    logger.logProcess('Step 1/5: Setting up environment');
    const setupContext = logger.startOperation('Environment Setup');
    performanceTracker.startTiming('Setup');

    // Install Claude Code CLI
    logger.logProgress({ current: 1, total: 3, message: 'Installing Claude Code CLI' });
    await exec.exec('npm', ['install', '-g', '@anthropic-ai/claude-code'], { silent: true });

    // Initialize Claude CLI configuration to avoid JSON config errors
    logger.logProgress({ current: 2, total: 3, message: 'Initializing Claude CLI configuration' });
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

    logger.logProgress({ current: 3, total: 3, message: 'Environment setup complete' });
    performanceTracker.endTiming('Setup');
    logger.endOperation(setupContext, true);

    logger.logProcess('Step 2/5: Fetching changed files');
    const gitContext = logger.startOperation('Git Operations');
    
    // Initialize services with AI code analysis
    const gitService = new GitService(
      inputs.githubToken || '',
      inputs.anthropicApiKey
    );

    // Initialize theme service with AI-driven expansion
    const themeService = new ThemeService(inputs.anthropicApiKey);

    performanceTracker.startTiming('Git Operations');
    
    // Get PR context and changed files
    const prContext = await gitService.getPullRequestContext();
    const changedFiles = await gitService.getChangedFiles();

    performanceTracker.endTiming('Git Operations');
    logger.endOperation(gitContext, true, { filesFound: changedFiles.length });

    // Log dev mode info
    if (prContext && prContext.number === 0) {
      logger.logProcess(`Dev mode: Comparing ${prContext.headBranch} against ${prContext.baseBranch}`, {
        baseSha: prContext.baseSha.substring(0, 8),
        headSha: prContext.headSha.substring(0, 8)
      });
    }

    logger.logProcess(`Found ${changedFiles.length} changed files`);

    if (changedFiles.length === 0) {
      logger.logProcess('No files changed, skipping analysis');
      core.setOutput('themes', JSON.stringify([]));
      core.setOutput('summary', 'No files changed in this PR');
      logger.endOperation(mainContext, true);
      return;
    }

    // Analyze themes with comprehensive process logging
    logger.logProcess('Step 3/5: Analyzing code themes');
    const themeContext = logger.startOperation('Theme Analysis');
    performanceTracker.startTiming('Theme Analysis');
    
    const themeAnalysis =
      await themeService.analyzeThemesWithEnhancedContext(gitService);
    
    performanceTracker.endTiming('Theme Analysis');
    logger.endOperation(themeContext, true, { 
      themesFound: themeAnalysis.totalThemes,
      processingTime: themeAnalysis.processingTime 
    });


    // Output results using enhanced formatter
    logger.logProcess('Step 4/5: Generating output');
    const outputContext = logger.startOperation('Output Generation');
    performanceTracker.startTiming('Output Generation');
    
    try {
      // Use the new ThemeFormatter for better hierarchical display
      const detailedThemes = ThemeFormatter.formatThemesForOutput(
        themeAnalysis.themes
      );

      const safeSummary = ThemeFormatter.createThemeSummary(
        themeAnalysis.themes
      );

      core.setOutput('themes', detailedThemes);
      core.setOutput('summary', safeSummary);

      logger.endOperation(outputContext, true, { 
        themesProcessed: themeAnalysis.totalThemes 
      });

      // Log expansion statistics if available
      if (themeAnalysis.expansionStats) {
        logger.logMetrics('Theme Expansion Statistics', {
          'Themes Expanded': themeAnalysis.expansionStats.expandedThemes,
          'Max Depth Reached': themeAnalysis.expansionStats.maxDepth,
          'Total Themes': themeAnalysis.totalThemes
        });
      }
    } catch (error) {
      logger.logError('Output Generation', error as Error, {
        themesFound: themeAnalysis.totalThemes,
        hasThemes: !!themeAnalysis.themes
      });
      logger.endOperation(outputContext, false);
      core.setOutput('themes', 'No themes found');
      core.setOutput('summary', 'Output generation failed');
    }
    performanceTracker.endTiming('Output Generation');

    // Final summary and cleanup
    logger.logProcess('Step 5/5: Analysis complete');
    
    // Log final metrics
    logger.logMetrics('Final Analysis Results', {
      'Total Themes': themeAnalysis.totalThemes,
      'Processing Time': `${themeAnalysis.processingTime}ms`,
      'Files Analyzed': changedFiles.length
    });

    // Log theme names for reference
    if (themeAnalysis.themes.length > 0) {
      const themeNames = themeAnalysis.themes.map((t) => t.name).join(', ');
      logger.logProcess(`Theme names: ${themeNames}`);
    }

    // End total timing and generate comprehensive performance report
    performanceTracker.endTiming('Total AI Code Review');
    performanceTracker.generateReport();
    
    logger.endOperation(mainContext, true, {
      totalThemes: themeAnalysis.totalThemes,
      processingTime: themeAnalysis.processingTime
    });

  } catch (error) {
    logger.logError('AI Code Review', error as Error);
    logger.endOperation(mainContext, false);
    handleError(error);
  }
}


if (require.main === module) {
  run();
}
