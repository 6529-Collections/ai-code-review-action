import * as exec from '@actions/exec';
import { SecureFileNamer } from './secure-file-namer';
import { performanceTracker } from './performance-tracker';

/**
 * Performance tracking for AI calls
 */
export interface AICallMetrics {
  totalCalls: number;
  totalTime: number;
  averageTime: number;
  errors: number;
  callsByContext: Map<string, number>;
  timeByContext: Map<string, number>;
  errorsByContext: Map<string, number>;
}

export interface AICallResult {
  response: string;
  duration: number;
  success: boolean;
}

/**
 * Enhanced Claude client with performance tracking
 */
export class ClaudeClient {
  private metrics: {
    totalCalls: number;
    totalTime: number;
    errors: number;
    callsByContext: Map<string, number>;
    timeByContext: Map<string, number>;
    errorsByContext: Map<string, number>;
  };

  constructor(private readonly anthropicApiKey: string) {
    // Set the API key for Claude CLI
    process.env.ANTHROPIC_API_KEY = this.anthropicApiKey;
    
    // Initialize metrics
    this.metrics = {
      totalCalls: 0,
      totalTime: 0,
      errors: 0,
      callsByContext: new Map(),
      timeByContext: new Map(),
      errorsByContext: new Map()
    };
  }

  async callClaude(prompt: string, context: string = 'unknown', operation?: string): Promise<string> {
    const startTime = Date.now();
    this.metrics.totalCalls++;
    this.updateContextCounter(this.metrics.callsByContext, context);

    try {
      const result = await this.executeClaudeCall(prompt);
      const duration = Date.now() - startTime;
      
      // Track successful call metrics
      this.metrics.totalTime += duration;
      this.updateContextCounter(this.metrics.timeByContext, context, duration);
      
      // Track with performance tracker
      performanceTracker.trackAICall(context, duration, operation);
      
      return result;
    } catch (error) {
      // Track error metrics
      this.metrics.errors++;
      this.updateContextCounter(this.metrics.errorsByContext, context);
      throw error;
    }
  }

  private async executeClaudeCall(prompt: string): Promise<string> {
    let tempFile: string | null = null;

    try {
      // Create secure temporary file for this request
      const { filePath, cleanup } = SecureFileNamer.createSecureTempFile(
        'claude-prompt',
        prompt
      );
      tempFile = filePath;
      performanceTracker.trackTempFile(true);

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
        performanceTracker.trackTempFile(false);
      }
    } catch (error) {
      throw new Error(`Claude API call failed: ${error}`);
    }
  }

  private updateContextCounter(map: Map<string, number>, context: string, value: number = 1): void {
    const current = map.get(context) || 0;
    map.set(context, current + value);
  }

  /**
   * Get current AI call metrics
   */
  getMetrics(): AICallMetrics {
    return {
      totalCalls: this.metrics.totalCalls,
      totalTime: this.metrics.totalTime,
      averageTime: this.metrics.totalCalls > 0 ? this.metrics.totalTime / this.metrics.totalCalls : 0,
      errors: this.metrics.errors,
      callsByContext: new Map(this.metrics.callsByContext),
      timeByContext: new Map(this.metrics.timeByContext),
      errorsByContext: new Map(this.metrics.errorsByContext)
    };
  }

  /**
   * Reset metrics (useful for testing or between runs)
   */
  resetMetrics(): void {
    this.metrics.totalCalls = 0;
    this.metrics.totalTime = 0;
    this.metrics.errors = 0;
    this.metrics.callsByContext.clear();
    this.metrics.timeByContext.clear();
    this.metrics.errorsByContext.clear();
  }
  }
}
