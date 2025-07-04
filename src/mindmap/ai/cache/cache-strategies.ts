import { PromptType } from '../prompt-types';
import crypto from 'crypto';

/**
 * Cache key generation strategies for different prompt types
 */
export interface CacheKeyGenerator {
  generate(promptType: PromptType, inputs: any): string;
}

export interface CacheStrategy {
  ttl: number; // Time to live in milliseconds (base TTL)
  maxSize: number; // Maximum number of entries
  keyGenerator: CacheKeyGenerator;
  shouldCache: (response: any) => boolean;
  adaptiveTTL?: (response: any) => number; // Optional adaptive TTL calculator
}

/**
 * Default cache key generator using SHA256 hash
 */
export class DefaultCacheKeyGenerator implements CacheKeyGenerator {
  generate(promptType: PromptType, inputs: any): string {
    // Sort object keys for consistent hashing
    const sortedInputs = this.sortObject(inputs);
    const inputString = JSON.stringify({
      type: promptType,
      inputs: sortedInputs,
    });

    return crypto
      .createHash('sha256')
      .update(inputString)
      .digest('hex')
      .substring(0, 16); // Use first 16 chars for readability
  }

  private sortObject(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sortObject(item));
    }

    const sortedKeys = Object.keys(obj).sort();
    const sortedObj: any = {};

    for (const key of sortedKeys) {
      sortedObj[key] = this.sortObject(obj[key]);
    }

    return sortedObj;
  }
}

/**
 * Specialized cache key generators for specific prompt types
 */
export class SimilarityCacheKeyGenerator implements CacheKeyGenerator {
  generate(promptType: PromptType, inputs: any): string {
    // For similarity checks, order doesn't matter (A-B same as B-A)
    const theme1 = inputs.theme1Name || '';
    const theme2 = inputs.theme2Name || '';
    const themes = [theme1, theme2].sort();

    return crypto
      .createHash('sha256')
      .update(`${promptType}:${themes[0]}:${themes[1]}`)
      .digest('hex')
      .substring(0, 16);
  }
}

export class CodeAnalysisCacheKeyGenerator implements CacheKeyGenerator {
  generate(promptType: PromptType, inputs: any): string {
    // For code analysis, use file path and content hash
    const filename = inputs.filename || '';
    const diffContent = inputs.diffContent || '';

    const contentHash = crypto
      .createHash('sha256')
      .update(diffContent)
      .digest('hex')
      .substring(0, 8);

    return `${promptType}:${filename}:${contentHash}`;
  }
}

/**
 * Factory for creating cache strategies
 */
export class CacheStrategyFactory {
  private static readonly strategies: Map<PromptType, CacheStrategy> = new Map([
    [
      PromptType.CODE_ANALYSIS,
      {
        ttl: 24 * 60 * 60 * 1000, // 24 hours
        maxSize: 1000,
        keyGenerator: new CodeAnalysisCacheKeyGenerator(),
        shouldCache: (response) => response.success === true,
      },
    ],

    [
      PromptType.SIMILARITY_CHECK,
      {
        ttl: 60 * 60 * 1000, // 1 hour (base TTL)
        maxSize: 500,
        keyGenerator: new SimilarityCacheKeyGenerator(),
        shouldCache: (response) =>
          response.success === true && response.confidence > 0.7,
        adaptiveTTL: (response) => {
          // High confidence = longer cache, low confidence = shorter cache
          const confidence =
            response.data?.confidence || response.confidence || 0.5;
          const baseTTL = 60 * 60 * 1000; // 1 hour

          if (confidence > 0.9) return baseTTL * 4; // 4 hours for very high confidence
          if (confidence > 0.8) return baseTTL * 2; // 2 hours for high confidence
          if (confidence > 0.6) return baseTTL; // 1 hour for medium confidence
          return baseTTL * 0.5; // 30 minutes for low confidence
        },
      },
    ],

    [
      PromptType.THEME_EXTRACTION,
      {
        ttl: 60 * 60 * 1000, // 1 hour (base TTL)
        maxSize: 500,
        keyGenerator: new DefaultCacheKeyGenerator(),
        shouldCache: (response) => response.success === true,
        adaptiveTTL: (response) => {
          const confidence =
            response.data?.confidence || response.confidence || 0.5;
          const baseTTL = 60 * 60 * 1000; // 1 hour

          // Theme extraction benefits from longer caching for high confidence themes
          if (confidence > 0.85) return baseTTL * 6; // 6 hours for very confident themes
          if (confidence > 0.7) return baseTTL * 2; // 2 hours for confident themes
          if (confidence > 0.5) return baseTTL; // 1 hour for medium confidence
          return baseTTL * 0.25; // 15 minutes for low confidence
        },
      },
    ],

    [
      PromptType.THEME_EXPANSION,
      {
        ttl: 30 * 60 * 1000, // 30 minutes
        maxSize: 200,
        keyGenerator: new DefaultCacheKeyGenerator(),
        shouldCache: (response) => response.success === true,
      },
    ],

    [
      PromptType.DOMAIN_EXTRACTION,
      {
        ttl: 30 * 60 * 1000, // 30 minutes
        maxSize: 100,
        keyGenerator: new DefaultCacheKeyGenerator(),
        shouldCache: (response) => response.success === true,
      },
    ],

    [
      PromptType.BATCH_SIMILARITY,
      {
        ttl: 60 * 60 * 1000, // 1 hour
        maxSize: 200,
        keyGenerator: new DefaultCacheKeyGenerator(),
        shouldCache: (response) => response.success === true,
      },
    ],

    [
      PromptType.CROSS_LEVEL_SIMILARITY,
      {
        ttl: 60 * 60 * 1000, // 1 hour
        maxSize: 200,
        keyGenerator: new DefaultCacheKeyGenerator(),
        shouldCache: (response) => response.success === true,
      },
    ],
  ]);

  static getStrategy(promptType: PromptType): CacheStrategy {
    const strategy = this.strategies.get(promptType);
    if (!strategy) {
      // Default strategy for unspecified types
      return {
        ttl: 30 * 60 * 1000, // 30 minutes
        maxSize: 100,
        keyGenerator: new DefaultCacheKeyGenerator(),
        shouldCache: (response) => response.success === true,
      };
    }
    return strategy;
  }

  static shouldCache(promptType: PromptType): boolean {
    // Theme naming should never be cached
    if (promptType === PromptType.THEME_NAMING) {
      return false;
    }
    return true;
  }
}
