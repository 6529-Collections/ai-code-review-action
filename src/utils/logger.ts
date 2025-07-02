/**
 * Enhanced logging utility with structured levels and operation context tracking
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4,
}

export interface OperationContext {
  operation: string;
  startTime: number;
  parentContext?: OperationContext;
  metadata?: Record<string, unknown>;
}

export interface PerformanceMetrics {
  operation: string;
  duration: number;
  success: boolean;
  metadata?: Record<string, unknown>;
}

export interface ProgressInfo {
  current: number;
  total: number;
  message: string;
  context?: string;
}

export class Logger {
  private static level: LogLevel = Logger.parseLogLevel(
    process.env.LOG_LEVEL || 'INFO'
  );
  private static contextStack: OperationContext[] = [];
  private static performanceMetrics: PerformanceMetrics[] = [];

  private static parseLogLevel(level: string): LogLevel {
    switch (level.toUpperCase()) {
      case 'ERROR':
        return LogLevel.ERROR;
      case 'WARN':
        return LogLevel.WARN;
      case 'INFO':
        return LogLevel.INFO;
      case 'DEBUG':
        return LogLevel.DEBUG;
      case 'TRACE':
        return LogLevel.TRACE;
      default:
        return LogLevel.INFO;
    }
  }

  private static formatMessage(
    level: string,
    service: string,
    message: string
  ): string {
    const timestamp =
      process.env.LOG_TIMESTAMPS === 'true'
        ? `[${new Date().toISOString()}] `
        : '';
    return `${timestamp}[${level}] [${service}] ${message}`;
  }

  private static getCurrentContext(): string {
    if (Logger.contextStack.length === 0) return '';
    const context = Logger.contextStack[Logger.contextStack.length - 1];
    const contextPath = Logger.buildContextPath(context);
    return contextPath ? ` (${contextPath})` : '';
  }

  private static buildContextPath(context: OperationContext): string {
    const parts: string[] = [];
    let current: OperationContext | undefined = context;
    while (current) {
      parts.unshift(current.operation);
      current = current.parentContext;
    }
    return parts.join(' > ');
  }

  static error(service: string, message: string): void {
    if (Logger.level >= LogLevel.ERROR) {
      console.error(Logger.formatMessage('ERROR', service, message));
    }
  }

  static warn(service: string, message: string): void {
    if (Logger.level >= LogLevel.WARN) {
      console.warn(Logger.formatMessage('WARN', service, message));
    }
  }

  static info(service: string, message: string): void {
    if (Logger.level >= LogLevel.INFO) {
      console.log(Logger.formatMessage('INFO', service, message));
    }
  }

  static debug(service: string, message: string): void {
    if (Logger.level >= LogLevel.DEBUG) {
      console.log(Logger.formatMessage('DEBUG', service, message));
    }
  }

  static trace(service: string, message: string): void {
    if (Logger.level >= LogLevel.TRACE) {
      console.log(Logger.formatMessage('TRACE', service, message));
    }
  }

  static setLevel(level: LogLevel): void {
    Logger.level = level;
  }

  static getLevel(): LogLevel {
    return Logger.level;
  }

  // New structured logging methods
  static logProcess(message: string, metadata?: Record<string, unknown>): void {
    if (Logger.level >= LogLevel.INFO) {
      const context = Logger.getCurrentContext();
      const metaStr = metadata ? ` ${JSON.stringify(metadata)}` : '';
      console.log(`[PROCESS] ${message}${context}${metaStr}`);
    }
  }

  static logProgress(info: ProgressInfo): void {
    if (Logger.level >= LogLevel.INFO) {
      const percentage = Math.round((info.current / info.total) * 100);
      const context = info.context ? ` (${info.context})` : '';
      console.log(
        `[PROGRESS] ${info.message} [${info.current}/${info.total} - ${percentage}%]${context}`
      );
    }
  }

  static logPerformance(metrics: PerformanceMetrics): void {
    if (Logger.level >= LogLevel.INFO) {
      Logger.performanceMetrics.push(metrics);
      const status = metrics.success ? '✓' : '✗';
      const metaStr = metrics.metadata
        ? ` ${JSON.stringify(metrics.metadata)}`
        : '';
      console.log(
        `[PERFORMANCE] ${metrics.operation} ${status} ${metrics.duration}ms${metaStr}`
      );
    }
  }

  static logError(
    context: string,
    error: Error | string,
    additionalInfo?: Record<string, unknown>
  ): void {
    if (Logger.level >= LogLevel.ERROR) {
      const currentContext = Logger.getCurrentContext();
      const errorMsg = error instanceof Error ? error.message : error;
      const infoStr = additionalInfo
        ? `\nAdditional info: ${JSON.stringify(additionalInfo, null, 2)}`
        : '';
      console.error(
        `[ERROR] ${context}${currentContext}\nError: ${errorMsg}${infoStr}`
      );

      if (error instanceof Error && error.stack) {
        console.error(`Stack trace: ${error.stack}`);
      }
    }
  }

  static logMetrics(title: string, metrics: Record<string, unknown>): void {
    if (Logger.level >= LogLevel.INFO) {
      console.log(`[METRICS] ${title}`);
      Object.entries(metrics).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
      });
    }
  }

  // Context management methods
  static startOperation(
    operation: string,
    metadata?: Record<string, unknown>
  ): OperationContext {
    const parentContext =
      Logger.contextStack.length > 0
        ? Logger.contextStack[Logger.contextStack.length - 1]
        : undefined;

    const context: OperationContext = {
      operation,
      startTime: Date.now(),
      parentContext,
      metadata,
    };

    Logger.contextStack.push(context);
    return context;
  }

  static endOperation(
    context: OperationContext,
    success: boolean = true,
    metadata?: Record<string, unknown>
  ): void {
    const duration = Date.now() - context.startTime;

    // Remove from context stack
    const index = Logger.contextStack.indexOf(context);
    if (index >= 0) {
      Logger.contextStack.splice(index, 1);
    }

    // Log performance metrics
    Logger.logPerformance({
      operation: context.operation,
      duration,
      success,
      metadata: { ...context.metadata, ...metadata },
    });
  }

  static getPerformanceMetrics(): PerformanceMetrics[] {
    return [...Logger.performanceMetrics];
  }

  static clearMetrics(): void {
    Logger.performanceMetrics = [];
  }
}

// Export convenience functions with enhanced structured logging
export const logger = {
  // Legacy methods
  error: (service: string, message: string): void =>
    Logger.error(service, message),
  warn: (service: string, message: string): void =>
    Logger.warn(service, message),
  info: (service: string, message: string): void =>
    Logger.info(service, message),
  debug: (service: string, message: string): void =>
    Logger.debug(service, message),
  trace: (service: string, message: string): void =>
    Logger.trace(service, message),

  // New structured logging methods
  logProcess: (message: string, metadata?: Record<string, unknown>): void =>
    Logger.logProcess(message, metadata),
  logProgress: (info: ProgressInfo): void => Logger.logProgress(info),
  logPerformance: (metrics: PerformanceMetrics): void =>
    Logger.logPerformance(metrics),
  logError: (
    context: string,
    error: Error | string,
    additionalInfo?: Record<string, unknown>
  ): void => Logger.logError(context, error, additionalInfo),
  logMetrics: (title: string, metrics: Record<string, unknown>): void =>
    Logger.logMetrics(title, metrics),

  // Context management
  startOperation: (
    operation: string,
    metadata?: Record<string, unknown>
  ): OperationContext => Logger.startOperation(operation, metadata),
  endOperation: (
    context: OperationContext,
    success?: boolean,
    metadata?: Record<string, unknown>
  ): void => Logger.endOperation(context, success, metadata),

  // Metrics management
  getPerformanceMetrics: (): PerformanceMetrics[] =>
    Logger.getPerformanceMetrics(),
  clearMetrics: (): void => Logger.clearMetrics(),
};
