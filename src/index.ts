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
    const themeAnalysis = await themeService.analyzeThemes(changedFiles);

    // Output results (GitHub Actions will log these)
    try {
      // Create detailed theme output
      const themeCount = themeAnalysis.themes.length;
      
      let detailedThemes = `Found ${themeCount} themes:\\n`;
      themeAnalysis.themes.forEach((theme, index) => {
        const confidence = (theme.confidence * 100).toFixed(0);
        const files = theme.affectedFiles.slice(0, 3).join(', ');
        const moreFiles = theme.affectedFiles.length > 3 ? ` (+${theme.affectedFiles.length - 3} more)` : '';
        
        detailedThemes += `\\n${index + 1}. **${theme.name}** (${confidence}% confidence)`;
        detailedThemes += `\\n   - Files: ${files}${moreFiles}`;
        detailedThemes += `\\n   - ${theme.description.replace(/[\r\n]/g, ' ').trim()}`;
        
        // Show consolidation info
        if (theme.consolidationMethod === 'merge') {
          detailedThemes += `\\n   - 🔄 Merged from ${theme.sourceThemes.length} similar themes`;
        }
        
        // Show child themes in detail
        if (theme.childThemes && theme.childThemes.length > 0) {
          detailedThemes += `\\n   - 📁 Contains ${theme.childThemes.length} sub-themes:`;
          
          theme.childThemes.forEach((child, childIndex) => {
            const childConfidence = (child.confidence * 100).toFixed(0);
            const childFiles = child.affectedFiles.slice(0, 2).join(', ');
            const moreChildFiles = child.affectedFiles.length > 2 ? ` (+${child.affectedFiles.length - 2})` : '';
            
            detailedThemes += `\\n     ${childIndex + 1}. **${child.name}** (${childConfidence}%)`;
            detailedThemes += `\\n        - Files: ${childFiles}${moreChildFiles}`;
            detailedThemes += `\\n        - ${child.description.replace(/[\r\n]/g, ' ').trim()}`;
            
            if (child.consolidationMethod === 'merge') {
              detailedThemes += `\\n        - 🔄 Merged from ${child.sourceThemes.length} themes`;
            }
          });
        }
      });
      
      const safeSummary = themeAnalysis.summary.replace(/[\r\n]/g, ' ').trim();
      
      core.setOutput('themes', detailedThemes);
      core.setOutput('summary', safeSummary);
      
      logInfo(`Set outputs - ${themeCount} themes with details`);
    } catch (error) {
      logInfo(`Failed to set outputs: ${error}`);
      core.setOutput('themes', 'No themes found');
      core.setOutput('summary', 'Output generation failed');
    }

    logInfo(`Analysis complete: Found ${themeAnalysis.totalThemes} themes`);
    logInfo(`Processing time: ${themeAnalysis.processingTime}ms`);

    // Log theme names only (not full JSON)
    if (themeAnalysis.themes.length > 0) {
      const themeNames = themeAnalysis.themes.map((t) => t.name).join(', ');
      logInfo(`Themes: ${themeNames}`);
    }
  } catch (error) {
    handleError(error);
  }
}

if (require.main === module) {
  run();
}
