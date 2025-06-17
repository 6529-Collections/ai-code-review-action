import * as core from '@actions/core';

export function validateInputs(): {
  greeting: string;
  githubToken: string;
  anthropicApiKey: string;
} {
  const greeting = core.getInput('greeting') || 'Hello';
  const githubToken = core.getInput('github-token');
  const anthropicApiKey = core.getInput('anthropic-api-key');

  if (!greeting.trim()) {
    throw new Error('Greeting cannot be empty');
  }

  if (!anthropicApiKey.trim()) {
    throw new Error('Anthropic API key is required');
  }

  return {
    greeting: greeting.trim(),
    githubToken,
    anthropicApiKey,
  };
}
