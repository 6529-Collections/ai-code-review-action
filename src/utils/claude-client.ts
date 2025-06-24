import * as exec from '@actions/exec';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

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
      // Create unique temporary file for this request
      tempFile = path.join(
        os.tmpdir(),
        `claude-prompt-${Date.now()}-${Math.random().toString(36).substring(2)}.txt`
      );
      fs.writeFileSync(tempFile, prompt);

      let output = '';
      await exec.exec('bash', ['-c', `cat "${tempFile}" | claude`], {
        listeners: {
          stdout: (data: Buffer) => {
            output += data.toString();
          },
        },
      });

      return output.trim();
    } catch (error) {
      throw new Error(`Claude API call failed: ${error}`);
    } finally {
      // Clean up temporary file
      if (tempFile) {
        try {
          if (fs.existsSync(tempFile)) {
            fs.unlinkSync(tempFile);
          }
        } catch (cleanupError) {
          console.warn(
            `Failed to cleanup temp file ${tempFile}:`,
            cleanupError
          );
        }
      }
    }
  }
}
