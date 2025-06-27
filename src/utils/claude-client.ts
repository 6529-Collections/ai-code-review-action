import * as exec from '@actions/exec';
import { SecureFileNamer } from './secure-file-namer';

/**
 * Simple Claude client for making AI calls
 */
export class ClaudeClient {
  constructor(private readonly anthropicApiKey: string) {
    // Set the API key for Claude CLI
    process.env.ANTHROPIC_API_KEY = this.anthropicApiKey;
  }

  async callClaude(prompt: string): Promise<string> {
    let tempFile: string | null = null;

    try {
      // Create secure temporary file for this request
      const { filePath, cleanup } = SecureFileNamer.createSecureTempFile(
        'claude-prompt',
        prompt
      );
      tempFile = filePath;

      let output = '';
      try {
        await exec.exec('bash', ['-c', `cat "${tempFile}" | claude --print`], {
          listeners: {
            stdout: (data: Buffer) => {
              output += data.toString();
            },
          },
        });

        return output.trim();
      } finally {
        cleanup(); // Use secure cleanup
      }
    } catch (error) {
      throw new Error(`Claude API call failed: ${error}`);
    }
  }
}
