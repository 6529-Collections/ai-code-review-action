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
    const prContext = await gitService.getPullRequestContext();
    const changedFiles = await gitService.getChangedFiles();
    
    // Log dev mode info
    if (prContext && prContext.number === 0) {
      logInfo(`Dev mode: Comparing ${prContext.headBranch} against ${prContext.baseBranch}`);
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
    const themeAnalysis = await themeService.analyzeThemes(changedFiles);

    // Output results (GitHub Actions will log these)
    core.setOutput('themes', JSON.stringify(themeAnalysis.themes));
    core.setOutput('summary', themeAnalysis.summary);

    logInfo(`Analysis complete: Found ${themeAnalysis.totalThemes} themes`);
    logInfo(`Processing time: ${themeAnalysis.processingTime}ms`);
    
    // Log theme names only (not full JSON)
    if (themeAnalysis.themes.length > 0) {
      const themeNames = themeAnalysis.themes.map(t => t.name).join(', ');
      logInfo(`Themes: ${themeNames}`);
    }

  } catch (error) {
    handleError(error);
  }
}

if (require.main === module) {
  run();
}
