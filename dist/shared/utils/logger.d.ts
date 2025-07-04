/**
 * Logging utility with configurable levels
 */
export declare enum LogLevel {
    ERROR = 0,
    WARN = 1,
    INFO = 2,
    DEBUG = 3,
    TRACE = 4
}
export declare class Logger {
    private static level;
    private static parseLogLevel;
    private static formatMessage;
    static error(service: string, message: string): void;
    static warn(service: string, message: string): void;
    static info(service: string, message: string): void;
    static debug(service: string, message: string): void;
    static trace(service: string, message: string): void;
    static setLevel(level: LogLevel): void;
    static getLevel(): LogLevel;
}
export declare const logger: {
    error: (service: string, message: string) => void;
    warn: (service: string, message: string) => void;
    info: (service: string, message: string) => void;
    debug: (service: string, message: string) => void;
    trace: (service: string, message: string) => void;
};
