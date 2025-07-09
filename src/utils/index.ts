import { Logger } from '../shared/logger/logger';

// Export logging functions with consistent interface
export const logError = (message: string): void => {
  Logger.error('ai-code-review', message);
};

export const logWarning = (message: string): void => {
  Logger.warn('ai-code-review', message);
};

export const logInfo = (message: string): void => {
  Logger.info('ai-code-review', message);
};

export const logDebug = (message: string): void => {
  Logger.debug('ai-code-review', message);
};

export const logTrace = (message: string): void => {
  Logger.trace('ai-code-review', message);
};
