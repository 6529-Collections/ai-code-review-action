import * as core from '@actions/core';

export function validateInputs(): {
  githubToken: string;
  anthropicApiKey: string;
} {
  const githubToken = core.getInput('github-token');
  const anthropicApiKey = core.getInput('anthropic-api-key');

  if (!anthropicApiKey.trim()) {
    throw new Error('Anthropic API key is required');
  }

  // Set deduplication environment variables from inputs
  setDeduplicationEnvironmentVariables();

  return {
    githubToken,
    anthropicApiKey,
  };
}

function setDeduplicationEnvironmentVariables(): void {
  // Convert kebab-case input names to SCREAMING_SNAKE_CASE env var names
  const inputToEnvMap = {
    'skip-batch-dedup': 'SKIP_BATCH_DEDUP',
    'skip-second-pass-dedup': 'SKIP_SECOND_PASS_DEDUP', 
    'skip-cross-level-dedup': 'SKIP_CROSS_LEVEL_DEDUP',
      // PRD Compliance Controls
    're-evaluate-after-merge': 'RE_EVALUATE_AFTER_MERGE',
    'strict-atomic-limits': 'STRICT_ATOMIC_LIMITS'
  };

  for (const [inputName, envName] of Object.entries(inputToEnvMap)) {
    const inputValue = core.getInput(inputName);
    if (inputValue) {
      process.env[envName] = inputValue;
      core.info(`Set ${envName}=${inputValue} from input ${inputName}`);
    }
  }
}
