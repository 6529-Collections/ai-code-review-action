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
    'cross-level-dedup-threshold': 'CROSS_LEVEL_DEDUP_THRESHOLD',
    'allow-overlap-merging': 'ALLOW_OVERLAP_MERGING',
    'min-themes-for-batch-dedup': 'MIN_THEMES_FOR_BATCH_DEDUP',
    'min-themes-for-second-pass-dedup': 'MIN_THEMES_FOR_SECOND_PASS_DEDUP',
    'min-themes-for-cross-level-dedup': 'MIN_THEMES_FOR_CROSS_LEVEL_DEDUP',
    'verbose-dedup-logging': 'VERBOSE_DEDUP_LOGGING',
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
