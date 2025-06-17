import * as core from '@actions/core';

export async function run(): Promise<void> {
  try {
    const greeting: string = core.getInput('greeting') || 'Hello';

    if (!greeting.trim()) {
      throw new Error('Greeting cannot be empty');
    }

    core.info(`Processing greeting: ${greeting}`);
    const message: string = `${greeting} from GitHub Actions!`;

    core.info(`Generated message: ${message}`);
    core.setOutput('message', message);

    // Add job summary (visible in Actions tab)
    await core.summary
      .addHeading('Code Review Results')
      .addRaw(`**Message:** ${message}`)
      .addSeparator()
      .addTable([
        ['File', 'Status', 'Issues'],
        ['src/index.ts', '✅ Clean', '0'],
        ['Example file', '⚠️ Warning', '1']
      ])
      .write();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    core.error(`Action failed: ${errorMessage}`);
    core.setFailed(errorMessage);
  }
}

if (require.main === module) {
  run();
}
