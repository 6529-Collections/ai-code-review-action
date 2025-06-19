import * as exec from '@actions/exec';
import { validateInputs } from './validation';
import { handleError, logInfo } from './utils';

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

    // TODO: Add actual code review logic here
  } catch (error) {
    handleError(error);
  }
}

if (require.main === module) {
  run();
}
