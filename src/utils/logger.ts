/**
 * Logging utility with configurable levels
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4
}

export class Logger {
  private static level: LogLevel = Logger.parseLogLevel(process.env.LOG_LEVEL || 'INFO');

  private static parseLogLevel(level: string): LogLevel {
    switch (level.toUpperCase()) {
      case 'ERROR': return LogLevel.ERROR;
      case 'WARN': return LogLevel.WARN;
      case 'INFO': return LogLevel.INFO;
      case 'DEBUG': return LogLevel.DEBUG;
      case 'TRACE': return LogLevel.TRACE;
      default: return LogLevel.INFO;
    }
  }

  private static formatMessage(level: string, service: string, message: string): string {
    const timestamp = process.env.LOG_TIMESTAMPS === 'true' 
      ? `[${new Date().toISOString()}] ` 
      : '';
    return `${timestamp}[${level}] [${service}] ${message}`;
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
}

// Export convenience functions
export const logger = {
  error: (service: string, message: string) => Logger.error(service, message),
  warn: (service: string, message: string) => Logger.warn(service, message),
  info: (service: string, message: string) => Logger.info(service, message),
  debug: (service: string, message: string) => Logger.debug(service, message),
  trace: (service: string, message: string) => Logger.trace(service, message)
};