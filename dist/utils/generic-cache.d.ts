/**
 * Generic cache utility for storing any type of data with expiration
 */
export declare class GenericCache {
    private cache;
    private defaultTtlMs;
    constructor(defaultTtlMs?: number);
    get<T = unknown>(key: string): T | null;
    set(key: string, data: unknown, ttlMs?: number): void;
    delete(key: string): boolean;
    clear(): void;
    size(): number;
    has(key: string): boolean;
    /**
     * Get all keys with a specific prefix
     * Used for semantic cache operations
     */
    getKeysWithPrefix(prefix: string): string[];
}
