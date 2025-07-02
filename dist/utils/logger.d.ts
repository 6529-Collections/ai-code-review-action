/**
 * Enhanced logging utility with structured levels and operation context tracking
 */
export declare enum LogLevel {
    ERROR = 0,
    WARN = 1,
    INFO = 2,
    DEBUG = 3,
    TRACE = 4
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
export declare class Logger {
    private static level;
    private static contextStack;
    private static performanceMetrics;
    private static parseLogLevel;
    private static formatMessage;
    private static getCurrentContext;
    private static buildContextPath;
    static error(service: string, message: string): void;
    static warn(service: string, message: string): void;
    static info(service: string, message: string): void;
    static debug(service: string, message: string): void;
    static trace(service: string, message: string): void;
    static setLevel(level: LogLevel): void;
    static getLevel(): LogLevel;
    static logProcess(message: string, metadata?: Record<string, unknown>): void;
    static logProgress(info: ProgressInfo): void;
    static logPerformance(metrics: PerformanceMetrics): void;
    static logError(context: string, error: Error | string, additionalInfo?: Record<string, unknown>): void;
    static logMetrics(title: string, metrics: Record<string, unknown>): void;
    static startOperation(operation: string, metadata?: Record<string, unknown>): OperationContext;
    static endOperation(context: OperationContext, success?: boolean, metadata?: Record<string, unknown>): void;
    static getPerformanceMetrics(): PerformanceMetrics[];
    static clearMetrics(): void;
}
export declare const logger: {
    error: (service: string, message: string) => void;
    warn: (service: string, message: string) => void;
    info: (service: string, message: string) => void;
    debug: (service: string, message: string) => void;
    trace: (service: string, message: string) => void;
    logProcess: (message: string, metadata?: Record<string, unknown>) => void;
    logProgress: (info: ProgressInfo) => void;
    logPerformance: (metrics: PerformanceMetrics) => void;
    logError: (context: string, error: Error | string, additionalInfo?: Record<string, unknown>) => void;
    logMetrics: (title: string, metrics: Record<string, unknown>) => void;
    startOperation: (operation: string, metadata?: Record<string, unknown>) => OperationContext;
    endOperation: (context: OperationContext, success?: boolean, metadata?: Record<string, unknown>) => void;
    getPerformanceMetrics: () => PerformanceMetrics[];
    clearMetrics: () => void;
};
