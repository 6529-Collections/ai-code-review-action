/**
 * Comprehensive error handling utilities for AI service failures
 */

import { logInfo } from '../../utils';

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffFactor: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  backoffFactor: 2,
};

export interface ErrorContext {
  operation: string;
  input?: unknown;
  attempt?: number;
  totalAttempts?: number;
  originalError?: Error;
}

export class AIServiceError extends Error {
  public readonly context: ErrorContext;
  public readonly isRetryable: boolean;

  constructor(message: string, context: ErrorContext, isRetryable = true) {
    super(message);
    this.name = 'AIServiceError';
    this.context = context;
    this.isRetryable = isRetryable;
  }
}

export class ErrorHandler {
  /**
   * Execute function with exponential backoff retry
   */
  static async retryWithBackoff<T>(
    operation: () => Promise<T>,
    operationName: string,
    config: Partial<RetryConfig> = {},
    input?: unknown
  ): Promise<T> {
    const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
    let lastError: Error;

    for (let attempt = 1; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        const result = await operation();

        if (attempt > 1) {
          logInfo(`${operationName} succeeded on attempt ${attempt}`);
        }

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        const context: ErrorContext = {
          operation: operationName,
          input,
          attempt,
          totalAttempts: retryConfig.maxRetries,
          originalError: lastError,
        };

        // Check if error is retryable
        const isRetryable = this.isRetryableError(lastError);

        if (!isRetryable || attempt === retryConfig.maxRetries) {
          logInfo(
            `${operationName} failed after ${attempt} attempts: ${lastError.message}`
          );
          throw new AIServiceError(
            `${operationName} failed: ${lastError.message}`,
            context,
            isRetryable
          );
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          retryConfig.baseDelayMs *
            Math.pow(retryConfig.backoffFactor, attempt - 1),
          retryConfig.maxDelayMs
        );

        logInfo(
          `${operationName} failed on attempt ${attempt}, retrying in ${delay}ms: ${lastError.message}`
        );

        await this.sleep(delay);
      }
    }

    // This should never be reached, but TypeScript requires it
    throw lastError!;
  }

  /**
   * Execute operation with fallback when AI fails
   */
  static async executeWithFallback<T>(
    primaryOperation: () => Promise<T>,
    fallbackOperation: () => T | Promise<T>,
    operationName: string,
    input?: unknown
  ): Promise<T> {
    try {
      return await this.retryWithBackoff(
        primaryOperation,
        `${operationName} (AI)`,
        undefined,
        input
      );
    } catch (error) {
      logInfo(
        `AI ${operationName} failed, using fallback: ${
          error instanceof Error ? error.message : String(error)
        }`
      );

      try {
        const fallbackResult = await fallbackOperation();
        logInfo(`Fallback ${operationName} succeeded`);
        return fallbackResult;
      } catch (fallbackError) {
        const fallbackErrorMessage =
          fallbackError instanceof Error
            ? fallbackError.message
            : String(fallbackError);

        throw new AIServiceError(
          `Both AI and fallback ${operationName} failed. AI error: ${
            error instanceof Error ? error.message : String(error)
          }. Fallback error: ${fallbackErrorMessage}`,
          {
            operation: operationName,
            input,
            originalError:
              error instanceof Error ? error : new Error(String(error)),
          },
          false
        );
      }
    }
  }

  /**
   * Handle JSON parsing errors with detailed diagnostics
   */
  static handleJsonParsingError(
    response: string,
    operation: string,
    expectedSchema?: string
  ): AIServiceError {
    const truncatedResponse =
      response.length > 200 ? response.substring(0, 200) + '...' : response;

    let diagnostics = `JSON parsing failed for ${operation}.\n`;
    diagnostics += `Response preview: "${truncatedResponse}"\n`;
    diagnostics += `Response length: ${response.length} characters\n`;

    if (expectedSchema) {
      diagnostics += `Expected schema: ${expectedSchema}\n`;
    }

    // Analyze common issues
    if (response.includes('Based on') || response.includes('Here is')) {
      diagnostics += `Issue: Response contains explanatory text instead of pure JSON\n`;
    }

    if (response.includes('```')) {
      diagnostics += `Issue: Response contains markdown code blocks\n`;
    }

    if (!response.trim().startsWith('{') && !response.trim().startsWith('[')) {
      diagnostics += `Issue: Response doesn't start with JSON delimiter\n`;
    }

    const suggestions = [
      'Ensure Claude response is pure JSON without explanatory text',
      'Check prompt formatting and JSON requirements',
      'Verify API key and Claude CLI installation',
      'Consider using simpler prompts if complex ones fail',
    ];

    diagnostics += `Troubleshooting suggestions:\n${suggestions.map((s) => `- ${s}`).join('\n')}`;

    return new AIServiceError(diagnostics, {
      operation,
      input: response,
    });
  }

  /**
   * Handle process execution errors
   */
  static handleProcessError(
    error: Error,
    operation: string,
    command?: string
  ): AIServiceError {
    let message = `Process execution failed for ${operation}: ${error.message}`;

    if (command) {
      message += `\nCommand: ${command}`;
    }

    // Add specific troubleshooting for common issues
    if (error.message.includes('ANTHROPIC_API_KEY')) {
      message +=
        '\nTroubleshooting: Ensure ANTHROPIC_API_KEY environment variable is set';
    } else if (error.message.includes('claude')) {
      message +=
        '\nTroubleshooting: Ensure Claude CLI is installed and accessible in PATH';
    } else if (error.message.includes('timeout')) {
      message +=
        '\nTroubleshooting: Request timed out, consider reducing complexity or increasing timeout';
    }

    return new AIServiceError(message, {
      operation,
      originalError: error,
    });
  }

  /**
   * Create error for analysis failures with fallback recommendations
   */
  static createAnalysisError(
    operation: string,
    input: unknown,
    error: Error,
    fallbackAvailable = true
  ): AIServiceError {
    let message = `AI analysis failed for ${operation}: ${error.message}`;

    if (fallbackAvailable) {
      message += '\nFalling back to keyword-based analysis';
    } else {
      message += '\nNo fallback available, operation failed completely';
    }

    return new AIServiceError(
      message,
      {
        operation,
        input,
        originalError: error,
      },
      fallbackAvailable
    );
  }

  /**
   * Determine if an error is retryable
   */
  private static isRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();

    // Network/connection errors - retryable
    if (
      message.includes('network') ||
      message.includes('connection') ||
      message.includes('timeout') ||
      message.includes('econnreset') ||
      message.includes('enotfound')
    ) {
      return true;
    }

    // Rate limiting - retryable
    if (
      message.includes('rate limit') ||
      message.includes('too many requests') ||
      message.includes('429')
    ) {
      return true;
    }

    // Server errors - retryable
    if (
      message.includes('500') ||
      message.includes('502') ||
      message.includes('503') ||
      message.includes('504')
    ) {
      return true;
    }

    // JSON parsing errors - not retryable (issue with response format)
    if (
      message.includes('json') ||
      message.includes('parse') ||
      message.includes('syntax')
    ) {
      return false;
    }

    // CI environment errors - not retryable but fallback should be used
    if (
      message.includes('raw mode is not supported') ||
      message.includes('israwmodesupported') ||
      message.includes('configuration error') ||
      message.includes('ci environment')
    ) {
      return false;
    }

    // Authentication errors - not retryable
    if (
      message.includes('auth') ||
      message.includes('unauthorized') ||
      message.includes('forbidden') ||
      message.includes('401') ||
      message.includes('403')
    ) {
      return false;
    }

    // Default to retryable for unknown errors
    return true;
  }

  /**
   * Sleep utility for delays
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Log detailed error information for debugging
   */
  static logDetailedError(error: unknown, context?: string): void {
    const contextStr = context ? `[${context}] ` : '';

    if (error instanceof AIServiceError) {
      logInfo(`${contextStr}AIServiceError: ${error.message}`);
      logInfo(
        `${contextStr}Context: ${JSON.stringify(error.context, null, 2)}`
      );
      logInfo(`${contextStr}Retryable: ${error.isRetryable}`);

      if (error.context.originalError) {
        logInfo(
          `${contextStr}Original error: ${error.context.originalError.message}`
        );
      }
    } else if (error instanceof Error) {
      logInfo(`${contextStr}Error: ${error.message}`);
      logInfo(`${contextStr}Stack: ${error.stack}`);
    } else {
      logInfo(`${contextStr}Unknown error: ${String(error)}`);
    }
  }
}
