import * as core from '@actions/core';

async function run(): Promise<void> {
  try {
    const greeting: string = core.getInput('greeting') || 'Hello';
    
    if (!greeting.trim()) {
      throw new Error('Greeting cannot be empty');
    }
    
    core.info(`Processing greeting: ${greeting}`);
    const message: string = `${greeting} from GitHub Actions!`;
    
    core.info(`Generated message: ${message}`);
    core.setOutput('message', message);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    core.error(`Action failed: ${errorMessage}`);
    core.setFailed(errorMessage);
  }
}

run();