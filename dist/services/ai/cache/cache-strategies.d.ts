import { PromptType } from '../prompt-types';
/**
 * Cache key generation strategies for different prompt types
 */
export interface CacheKeyGenerator {
    generate(promptType: PromptType, inputs: any): string;
}
export interface CacheStrategy {
    ttl: number;
    maxSize: number;
    keyGenerator: CacheKeyGenerator;
    shouldCache: (response: any) => boolean;
    adaptiveTTL?: (response: any) => number;
}
/**
 * Default cache key generator using SHA256 hash
 */
export declare class DefaultCacheKeyGenerator implements CacheKeyGenerator {
    generate(promptType: PromptType, inputs: any): string;
    private sortObject;
}
/**
 * Specialized cache key generators for specific prompt types
 */
export declare class SimilarityCacheKeyGenerator implements CacheKeyGenerator {
    generate(promptType: PromptType, inputs: any): string;
}
export declare class CodeAnalysisCacheKeyGenerator implements CacheKeyGenerator {
    generate(promptType: PromptType, inputs: any): string;
}
/**
 * Factory for creating cache strategies
 */
export declare class CacheStrategyFactory {
    private static readonly strategies;
    static getStrategy(promptType: PromptType): CacheStrategy;
    static shouldCache(promptType: PromptType): boolean;
}
