import * as core from '@actions/core';
import * as exec from '@actions/exec';
import { validateInputs } from './validation';
import { handleError, logInfo } from './utils';
import { GitService } from './services/git-service';
import { ThemeService } from './services/theme-service';
import { ThemeFormatter } from './utils/theme-formatter';
import { logger } from './utils/logger';

export async function run(): Promise<void> {
  try {
    const inputs = validateInputs();

    // Set Anthropic API key for Claude CLI
    process.env.ANTHROPIC_API_KEY = inputs.anthropicApiKey;

    // Install Claude Code CLI
    logInfo('Installing Claude Code CLI...');
    await exec.exec('npm', ['install', '-g', '@anthropic-ai/claude-code']);
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
    ]);
    logInfo('Claude CLI configuration initialized');

    logInfo('Starting AI code review analysis...');

    // Initialize services with AI code analysis
    const gitService = new GitService(
      inputs.githubToken || '',
      inputs.anthropicApiKey
    );

    // Initialize theme service with AI-driven expansion
    const themeService = new ThemeService(inputs.anthropicApiKey);

    logInfo('Using AI-driven theme expansion for natural hierarchy depth');

    // Get PR context and changed files
    const prContext = await gitService.getPullRequestContext();
    const changedFiles = await gitService.getChangedFiles();

    // Log dev mode info
    if (prContext && prContext.number === 0) {
      logInfo(
        `Dev mode: Comparing ${prContext.headBranch} against ${prContext.baseBranch}`
      );
      logInfo(`Base SHA: ${prContext.baseSha.substring(0, 8)}`);
      logInfo(`Head SHA: ${prContext.headSha.substring(0, 8)}`);
    }

    logInfo(`Found ${changedFiles.length} changed files`);

    if (changedFiles.length === 0) {
      logInfo('No files changed, skipping analysis');
      core.setOutput('themes', JSON.stringify([]));
      core.setOutput('summary', 'No files changed in this PR');
      return;
    }

    // Analyze themes
    logInfo('Analyzing code themes...');
    const themeAnalysis =
      await themeService.analyzeThemesWithEnhancedContext(gitService);

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

    // Generate performance summary report
    await generatePerformanceSummary(themeService, themeAnalysis);
  } catch (error) {
    handleError(error);
  }
}

/**
 * Generate comprehensive performance summary report
 */
async function generatePerformanceSummary(
  themeService: ThemeService, 
  themeAnalysis: any
): Promise<void> {
  try {
    logger.info('PERFORMANCE', '=== AI Code Review Performance Summary ===');
    
    // Get metrics from theme service components
    const similarityMetrics = themeService.getSimilarityEffectiveness?.() || null;
    const expansionMetrics = themeService.getExpansionEffectiveness?.() || null;
    const hierarchicalMetrics = themeService.getHierarchicalEffectiveness?.() || null;
    
    // Overall processing metrics
    logger.info('PERFORMANCE', `Total Processing Time: ${themeAnalysis.processingTime || 'N/A'}ms`);
    logger.info('PERFORMANCE', `Total Themes Found: ${themeAnalysis.totalThemes || 0}`);
    
    // AI Call metrics (from various services)
    let totalAICalls = 0;
    let totalAITime = 0;
    
    if (similarityMetrics) {
      totalAICalls += similarityMetrics.aiCallsUsed;
      totalAITime += similarityMetrics.processingTime;
      logger.info('PERFORMANCE', `Similarity Analysis: ${similarityMetrics.pairsAnalyzed} pairs, ${similarityMetrics.mergesDecided} merges (${similarityMetrics.mergeRate.toFixed(1)}% rate)`);
      logger.info('PERFORMANCE', `  - AI Calls: ${similarityMetrics.aiCallsUsed}, Time: ${similarityMetrics.processingTime}ms`);
    }
    
    if (expansionMetrics) {
      totalAICalls += expansionMetrics.aiCallsUsed;
      totalAITime += expansionMetrics.processingTime;
      logger.info('PERFORMANCE', `Theme Expansion: ${expansionMetrics.themesEvaluated} evaluated, ${expansionMetrics.themesExpanded} expanded (${expansionMetrics.expansionRate.toFixed(1)}% rate)`);
      logger.info('PERFORMANCE', `  - Max Depth: ${expansionMetrics.maxDepthReached}, Atomic Themes: ${expansionMetrics.atomicThemesIdentified}`);
      logger.info('PERFORMANCE', `  - AI Calls: ${expansionMetrics.aiCallsUsed}, Time: ${expansionMetrics.processingTime}ms`);
    }
    
    if (hierarchicalMetrics) {
      totalAICalls += hierarchicalMetrics.aiCallsUsed;
      totalAITime += hierarchicalMetrics.processingTime;
      logger.info('PERFORMANCE', `Hierarchical Analysis: ${hierarchicalMetrics.crossLevelComparisonsGenerated} comparisons (${hierarchicalMetrics.filteringReduction.toFixed(1)}% filtered)`);
      logger.info('PERFORMANCE', `  - Duplicates Found: ${hierarchicalMetrics.duplicatesFound}, Overlaps Resolved: ${hierarchicalMetrics.overlapsResolved}`);
      logger.info('PERFORMANCE', `  - AI Calls: ${hierarchicalMetrics.aiCallsUsed}, Time: ${hierarchicalMetrics.processingTime}ms`);
    }
    
    // Summary totals
    logger.info('PERFORMANCE', `Total AI Calls: ${totalAICalls}`);
    if (totalAICalls > 0) {
      logger.info('PERFORMANCE', `Average AI Call Time: ${(totalAITime / totalAICalls).toFixed(1)}ms`);
    }
    
    // Performance insights
    if (totalAICalls > 100) {
      logger.warn('PERFORMANCE', `High AI usage detected (${totalAICalls} calls) - consider optimizing batch sizes or filtering`);
    }
    
    if (themeAnalysis.processingTime > 120000) { // 2 minutes
      logger.warn('PERFORMANCE', `Long processing time detected (${(themeAnalysis.processingTime / 1000).toFixed(1)}s) - consider reducing complexity`);
    }
    
    logger.info('PERFORMANCE', '=== End Performance Summary ===');
    
  } catch (error) {
    logger.error('PERFORMANCE', `Failed to generate performance summary: ${error}`);
  }
}

if (require.main === module) {
  run();
}
