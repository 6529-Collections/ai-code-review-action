import * as fs from 'fs';
import * as path from 'path';
import { ChangedFile } from '../services/git-service';
import { Theme } from '../services/theme-service';

export interface ClaudeCall {
  filename: string;
  prompt: string;
  response: string;
  success: boolean;
  error?: string;
}

export class AnalysisLogger {
  private diffs: ChangedFile[] = [];
  private claudeCalls: ClaudeCall[] = [];
  private themes: Theme[] = [];
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  logDiff(file: ChangedFile): void {
    this.diffs.push(file);
  }

  logClaudeCall(call: ClaudeCall): void {
    this.claudeCalls.push(call);
  }

  logResult(themes: Theme[]): void {
    this.themes = themes;
  }

  generateReport(): void {
    const processingTime = Date.now() - this.startTime;
    const report = this.buildReport(processingTime);

    // Try multiple possible locations to ensure the file is accessible on host
    const possiblePaths = [
      process.env.GITHUB_WORKSPACE,
      process.env.RUNNER_WORKSPACE,
      '/github/workspace',
      process.cwd(),
      '.',
    ].filter(Boolean);

    // Try each path until one works
    let logPath = '';
    for (const basePath of possiblePaths) {
      try {
        logPath = path.join(basePath as string, 'analysis-log.txt');
        fs.writeFileSync(logPath, report);
        console.log(`Analysis log saved to: ${logPath}`);
        break;
      } catch (error) {
        console.warn(`Failed to write to ${logPath}:`, error);
        continue;
      }
    }
  }

  getReportContent(): string {
    const processingTime = Date.now() - this.startTime;
    return this.buildReport(processingTime);
  }

  private buildReport(processingTime: number): string {
    const timestamp = new Date().toISOString();
    const fileCount = this.diffs.length;

    let report = `=== AI Code Review Analysis ===\n`;
    report += `Date: ${timestamp}\n`;
    report += `Files: ${fileCount} changed, Time: ${processingTime}ms\n\n`;

    // Diffs section
    report += `=== DIFFS ===\n`;
    for (const file of this.diffs) {
      report += `${file.filename}: +${file.additions}/-${file.deletions} lines\n`;
      if (file.patch) {
        report += `${file.patch}\n\n`;
      }
    }

    // Claude interactions section
    report += `=== CLAUDE INTERACTIONS ===\n`;
    this.claudeCalls.forEach((call, index) => {
      report += `Call ${index + 1} (${call.filename}):\n`;
      report += `PROMPT: ${call.prompt.substring(0, 200)}...\n`;
      report += `RESPONSE: ${call.response}\n`;
      report += `STATUS: ${call.success ? '✅ Success' : '❌ Failed'}\n`;
      if (call.error) {
        report += `ERROR: ${call.error}\n`;
      }
      report += `\n`;
    });

    // Results section
    report += `=== RESULTS ===\n`;
    report += `Themes: ${this.themes.length} detected\n`;
    for (const theme of this.themes) {
      report += `- ${theme.name} (${theme.confidence})\n`;
    }

    const successful = this.claudeCalls.filter((c) => c.success).length;
    const total = this.claudeCalls.length;
    report += `API: ${successful}/${total} successful\n`;

    return report;
  }
}
