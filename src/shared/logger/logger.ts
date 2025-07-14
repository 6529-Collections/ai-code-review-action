/**
 * Logging utility with configurable levels
 */
import * as fs from 'fs';

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4,
}

export class Logger {
  private static level: LogLevel = Logger.parseLogLevel(
    process.env.LOG_LEVEL || 'INFO'
  );
  private static logFileStream: fs.WriteStream | null = null;
  private static logHistory: string[] = [];
  private static readonly MAX_HISTORY_SIZE = 10000;

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

  static initializeLiveLogging(logFilePath: string): void {
    try {
      Logger.logFileStream = fs.createWriteStream(logFilePath, { flags: 'a' });
      Logger.logHistory = []; // Reset history when starting new log file
    } catch (error) {
      console.error(`Failed to initialize log file: ${error}`);
      Logger.logFileStream = null;
    }
  }

  static flushLiveLogging(): void {
    if (Logger.logFileStream) {
      try {
        // Force immediate write without waiting for buffer
        Logger.logFileStream.write('');
        // Use callback version to ensure it's written
        Logger.logFileStream.once('drain', () => {
          // Stream is ready, data has been written
        });
      } catch (error) {
        // Ignore flush errors - don't break logging
      }
    }
  }

  static closeLiveLogging(): void {
    if (Logger.logFileStream) {
      Logger.logFileStream.end();
      Logger.logFileStream = null;
    }
  }

  static getLogHistory(): string {
    return Logger.logHistory.join('\n');
  }

  static clearLogHistory(): void {
    Logger.logHistory = [];
  }

  private static writeToLog(formattedMessage: string): void {
    // Add to history buffer
    Logger.logHistory.push(formattedMessage);
    
    // Maintain history size limit
    if (Logger.logHistory.length > Logger.MAX_HISTORY_SIZE) {
      Logger.logHistory.shift();
    }

    // Write to live log file if available
    if (Logger.logFileStream) {
      try {
        Logger.logFileStream.write(formattedMessage + '\n');
      } catch (error) {
        console.error(`Failed to write to log file: ${error}`);
      }
    }
  }

  static error(service: string, message: string): void {
    if (Logger.level >= LogLevel.ERROR) {
      const formatted = Logger.formatMessage('ERROR', service, message);
      console.error(formatted);
      Logger.writeToLog(formatted);
      Logger.flushLiveLogging(); // Force flush errors immediately
    }
  }

  static warn(service: string, message: string): void {
    if (Logger.level >= LogLevel.WARN) {
      const formatted = Logger.formatMessage('WARN', service, message);
      console.warn(formatted);
      Logger.writeToLog(formatted);
    }
  }

  static info(service: string, message: string): void {
    if (Logger.level >= LogLevel.INFO) {
      const formatted = Logger.formatMessage('INFO', service, message);
      console.log(formatted);
      Logger.writeToLog(formatted);
    }
  }

  static debug(service: string, message: string): void {
    if (Logger.level >= LogLevel.DEBUG) {
      const formatted = Logger.formatMessage('DEBUG', service, message);
      console.log(formatted);
      Logger.writeToLog(formatted);
    }
  }

  static trace(service: string, message: string): void {
    if (Logger.level >= LogLevel.TRACE) {
      const formatted = Logger.formatMessage('TRACE', service, message);
      console.log(formatted);
      Logger.writeToLog(formatted);
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
};
