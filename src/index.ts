import * as core from '@actions/core';
import * as exec from '@actions/exec';
import { validateInputs } from './validation';
import { handleError, logInfo } from './utils';
import { GitService } from './services/git-service';
import { ThemeService } from './services/theme-service';

export async function run(): Promise<void> {
  try {
    const inputs = validateInputs();

    // Set Anthropic API key for Claude CLI
    process.env.ANTHROPIC_API_KEY = inputs.anthropicApiKey;

    // Install Claude Code CLI
    logInfo('Installing Claude Code CLI...');
    await exec.exec('npm', ['install', '-g', '@anthropic-ai/claude-code']);
    logInfo('Claude Code CLI installed successfully');

    logInfo('Starting AI code review analysis...');

    // Initialize services
    const gitService = new GitService(inputs.githubToken || '');
    const themeService = new ThemeService(inputs.anthropicApiKey);

    // Get PR context and changed files
    await gitService.getPullRequestContext();
    const changedFiles = await gitService.getChangedFiles();
    
    logInfo(`Found ${changedFiles.length} changed files`);

    if (changedFiles.length === 0) {
      logInfo('No files changed, skipping analysis');
      core.setOutput('themes', JSON.stringify([]));
      core.setOutput('summary', 'No files changed in this PR');
      return;
    }

    // Analyze themes
    logInfo('Analyzing code themes...');
    const themeAnalysis = await themeService.analyzeThemes(changedFiles);

    // Output results
    core.setOutput('themes', JSON.stringify(themeAnalysis.themes));
    core.setOutput('summary', themeAnalysis.summary);

    logInfo(`Analysis complete: Found ${themeAnalysis.totalThemes} themes`);
    logInfo(`Processing time: ${themeAnalysis.processingTime}ms`);

  } catch (error) {
    handleError(error);
  }
}

if (require.main === module) {
  run();
}
