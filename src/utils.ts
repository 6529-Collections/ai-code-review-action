import * as core from '@actions/core';

export function handleError(error: unknown): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  core.error(`Action failed: ${errorMessage}`);
  core.setFailed(errorMessage);
}

export function logInfo(message: string): void {
  core.info(message);
}

export function setOutput(name: string, value: string): void {
  core.setOutput(name, value);
}
