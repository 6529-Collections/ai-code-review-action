/**
 * Generic cache utility for storing any type of data with expiration
 */
export declare class GenericCache {
    private cache;
    private defaultTtlMs;
    constructor(defaultTtlMs?: number);
    get(key: string): unknown | null;
    set(key: string, data: unknown, ttlMs?: number): void;
    delete(key: string): boolean;
    clear(): void;
    size(): number;
    has(key: string): boolean;
}
