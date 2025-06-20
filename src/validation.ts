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

  return {
    githubToken,
    anthropicApiKey,
  };
}
