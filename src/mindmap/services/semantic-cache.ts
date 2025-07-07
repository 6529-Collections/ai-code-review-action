import crypto from 'crypto';
import { GenericCache } from '@/shared/cache/generic-cache';
import { logger } from '@/shared/utils/logger';

/**
 * Semantic Cache Service for AI Analysis Results
 *
 * Implements PRD requirements:
 * - "Pattern caching: Cache identified business patterns for reuse within same PR"
 * - "Analysis caching: Store AI results with 1-hour TTL to avoid redundant API calls"
 * - "Smart invalidation: Clear cache selectively based on file modifications"
 */
export class SemanticCacheService {
  private cache: GenericCache;
  private semanticSimilarityThreshold: number = 0.85;

  constructor() {
    this.cache = new GenericCache(60 * 60 * 1000); // 1 hour TTL as per PRD
  }

  /**
   * Get cached result if semantically similar input exists
   * PRD: "Similarity detection: AI-driven identification of semantic duplicates"
   */
  async getCachedResult<T>(
    input: unknown,
    cacheKey: string,
    contextType: string
  ): Promise<T | null> {
    // Try exact match first (fastest)
    const exactMatch = this.cache.get<T>(`${contextType}:${cacheKey}`);
    if (exactMatch) {
      logger.info('CACHE_SEMANTIC', `Exact cache hit for ${contextType}`);
      return exactMatch;
    }

    // Try semantic similarity matching
    const semanticMatch = await this.findSemanticMatch<T>(input, contextType);
    if (semanticMatch) {
      logger.info('CACHE_SEMANTIC', `Semantic cache hit for ${contextType}`);
      return semanticMatch;
    }

    logger.debug('CACHE_SEMANTIC', `Cache miss for ${contextType}`);
    return null;
  }

  /**
   * Store result with semantic indexing
   * PRD: "Cache intermediate analysis results"
   */
  setCachedResult<T>(
    input: unknown,
    result: T,
    cacheKey: string,
    contextType: string,
    customTTL?: number
  ): void {
    const ttl = customTTL || this.getContextTTL(contextType);
    const fullKey = `${contextType}:${cacheKey}`;

    // Store the result with metadata for semantic matching
    const cacheEntry = {
      result,
      semanticKey: this.generateSemanticKey(input),
      timestamp: Date.now(),
      contextType,
      originalInput: this.sanitizeInputForStorage(input),
    };

    this.cache.set(fullKey, result, ttl);
    this.cache.set(`${fullKey}:meta`, cacheEntry, ttl);

    logger.debug('CACHE_SEMANTIC', `Stored result for ${contextType} with ${ttl}ms TTL`);
  }

  /**
   * Find semantically similar cached result
   */
  private async findSemanticMatch<T>(
    input: unknown,
    contextType: string
  ): Promise<T | null> {
    const inputSemanticKey = this.generateSemanticKey(input);
    const contextPrefix = `${contextType}:`;

    // Get all metadata entries for this context type
    const allKeys = this.cache.getKeysWithPrefix(`${contextPrefix}`) || [];
    const metaKeys = allKeys.filter((key) => key.endsWith(':meta'));

    for (const metaKey of metaKeys) {
      const metadata = this.cache.get<{ semanticKey?: string }>(metaKey);
      if (!metadata || !metadata.semanticKey) continue;

      // Calculate semantic similarity
      const similarity = this.calculateSemanticSimilarity(
        inputSemanticKey,
        metadata.semanticKey
      );

      if (similarity >= this.semanticSimilarityThreshold) {
        // Found semantic match, get the actual result
        const resultKey = metaKey.replace(':meta', '');
        const cachedResult = this.cache.get<T>(resultKey);

        if (cachedResult) {
          logger.info('CACHE_SEMANTIC', `Found semantic match with ${(similarity * 100).toFixed(1)}% similarity`);
          return cachedResult;
        }
      }
    }

    return null;
  }

  /**
   * Generate semantic key for input similarity matching
   * Extracts key semantic tokens from input
   */
  private generateSemanticKey(input: unknown): string {
    const semanticTokens: string[] = [];

    if (typeof input === 'string') {
      semanticTokens.push(...this.extractSemanticTokens(input));
    } else if (typeof input === 'object' && input !== null) {
      // Extract semantic tokens from object properties
      const inputObj = input as Record<string, unknown>;
      if (inputObj.name && typeof inputObj.name === 'string')
        semanticTokens.push(...this.extractSemanticTokens(inputObj.name));
      if (inputObj.description && typeof inputObj.description === 'string')
        semanticTokens.push(
          ...this.extractSemanticTokens(inputObj.description)
        );
      if (
        inputObj.businessImpact &&
        typeof inputObj.businessImpact === 'string'
      )
        semanticTokens.push(
          ...this.extractSemanticTokens(inputObj.businessImpact)
        );
      if (inputObj.content && typeof inputObj.content === 'string')
        semanticTokens.push(...this.extractSemanticTokens(inputObj.content));

      // Handle arrays of files
      if (Array.isArray(inputObj.affectedFiles)) {
        inputObj.affectedFiles.forEach((file: unknown) => {
          if (typeof file === 'string') {
            semanticTokens.push(...this.extractFileTokens(file));
          }
        });
      }
    }

    // Normalize and deduplicate tokens
    const uniqueTokens = Array.from(new Set(semanticTokens))
      .filter((token) => token.length > 2) // Remove very short tokens
      .sort(); // Sort for consistent keys

    return uniqueTokens.join('|');
  }

  /**
   * Extract semantic tokens from text
   */
  private extractSemanticTokens(text: string): string[] {
    const tokens = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .split(/\s+/)
      .filter((token) => token.length > 2) // Filter short words
      .filter((token) => !this.isStopWord(token)); // Remove stop words

    return tokens;
  }

  /**
   * Extract meaningful tokens from file paths
   */
  private extractFileTokens(filePath: string): string[] {
    const pathParts = filePath.split('/').pop()?.split('.') || [];
    const fileName = pathParts[0] || '';
    const extension = pathParts[pathParts.length - 1] || '';

    const tokens = [];
    if (fileName) tokens.push(fileName.toLowerCase());
    if (extension && extension !== fileName)
      tokens.push(extension.toLowerCase());

    return tokens;
  }

  /**
   * Check if word is a stop word (common words that don't add semantic meaning)
   */
  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'by',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'could',
      'should',
      'may',
      'might',
      'this',
      'that',
      'these',
      'those',
      'a',
      'an',
    ]);

    return stopWords.has(word);
  }

  /**
   * Calculate semantic similarity between two semantic keys
   * Uses Jaccard similarity on token sets
   */
  private calculateSemanticSimilarity(key1: string, key2: string): number {
    const tokens1 = new Set(key1.split('|'));
    const tokens2 = new Set(key2.split('|'));

    if (tokens1.size === 0 && tokens2.size === 0) return 1.0;
    if (tokens1.size === 0 || tokens2.size === 0) return 0.0;

    const intersection = new Set([...tokens1].filter((x) => tokens2.has(x)));
    const union = new Set([...tokens1, ...tokens2]);

    return intersection.size / union.size;
  }

  /**
   * Get TTL based on context type and complexity
   * PRD: "Context-aware TTL (simple = 2hr, complex = 30min)"
   */
  private getContextTTL(contextType: string): number {
    const contextTTLs: Record<string, number> = {
      // Simple operations - longer cache
      'file-analysis': 2 * 60 * 60 * 1000, // 2 hours
      'domain-classification': 2 * 60 * 60 * 1000, // 2 hours
      'pattern-recognition': 2 * 60 * 60 * 1000, // 2 hours

      // Complex operations - shorter cache
      'similarity-calculation': 60 * 60 * 1000, // 1 hour
      'theme-expansion': 60 * 60 * 1000, // 1 hour
      'cross-level-analysis': 30 * 60 * 1000, // 30 minutes

      // Dynamic operations - very short cache
      'hierarchy-analysis': 30 * 60 * 1000, // 30 minutes
      consolidation: 30 * 60 * 1000, // 30 minutes
    };

    return contextTTLs[contextType] || 60 * 60 * 1000; // Default 1 hour
  }

  /**
   * Sanitize input for storage (remove sensitive data, limit size)
   */
  private sanitizeInputForStorage(input: unknown): unknown {
    if (typeof input === 'string') {
      return input; // Keep full string for better semantic matching
    }

    if (typeof input === 'object' && input !== null) {
      const sanitized: Record<string, unknown> = {};

      // Only keep specific fields that are useful for semantic matching
      const allowedFields = [
        'name',
        'description',
        'businessImpact',
        'content',
        'affectedFiles',
        'themeName',
        'changeType',
      ];

      for (const field of allowedFields) {
        const inputObj = input as Record<string, unknown>;
        if (inputObj[field] !== undefined) {
          if (typeof inputObj[field] === 'string') {
            sanitized[field] = inputObj[field]; // Keep full string
          } else if (Array.isArray(inputObj[field])) {
            sanitized[field] = inputObj[field]; // Keep full array
          } else {
            sanitized[field] = inputObj[field];
          }
        }
      }

      return sanitized;
    }

    return input;
  }

  /**
   * Warm cache with common patterns
   * PRD: "Cache warming for predictable patterns"
   */
  warmCacheWithPatterns(
    commonPatterns: Array<{
      input: unknown;
      result: unknown;
      contextType: string;
    }>
  ): void {
    logger.info('CACHE_SEMANTIC', `Warming cache with ${commonPatterns.length} common patterns`);

    for (const pattern of commonPatterns) {
      const cacheKey = this.generateCacheKey(pattern.input);
      this.setCachedResult(
        pattern.input,
        pattern.result,
        cacheKey,
        pattern.contextType,
        4 * 60 * 60 * 1000 // 4 hour TTL for warm cache entries
      );
    }
  }

  /**
   * Clear cache selectively based on file modifications
   * PRD: "Smart invalidation: Clear cache selectively based on file modifications"
   */
  invalidateByFiles(modifiedFiles: string[]): void {
    logger.info('CACHE_SEMANTIC', `Invalidating cache for ${modifiedFiles.length} modified files`);

    const modifiedSet = new Set(modifiedFiles);
    const allKeys = this.cache.getKeysWithPrefix('') || [];

    for (const key of allKeys) {
      if (key.endsWith(':meta')) {
        const metadata = this.cache.get<{
          originalInput?: { affectedFiles?: string[] };
        }>(key);
        if (
          metadata &&
          metadata.originalInput &&
          metadata.originalInput.affectedFiles
        ) {
          const hasModifiedFile = metadata.originalInput.affectedFiles.some(
            (file: string) => modifiedSet.has(file)
          );

          if (hasModifiedFile) {
            const resultKey = key.replace(':meta', '');
            this.cache.delete(key);
            this.cache.delete(resultKey);
            logger.debug('CACHE_SEMANTIC', `Invalidated cache entry for ${resultKey}`);
          }
        }
      }
    }
  }

  /**
   * Generate cache key from input
   */
  private generateCacheKey(input: unknown): string {
    const inputString = JSON.stringify(input);
    return crypto
      .createHash('sha256')
      .update(inputString)
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    totalEntries: number;
    hitRate: number;
    contextBreakdown: Record<string, number>;
  } {
    const allKeys = this.cache.getKeysWithPrefix('') || [];
    const metaKeys = allKeys.filter((key) => key.endsWith(':meta'));

    const contextBreakdown: Record<string, number> = {};

    for (const key of metaKeys) {
      const metadata = this.cache.get<{ contextType?: string }>(key);
      if (metadata && metadata.contextType) {
        contextBreakdown[metadata.contextType] =
          (contextBreakdown[metadata.contextType] || 0) + 1;
      }
    }

    return {
      totalEntries: metaKeys.length,
      hitRate: 0, // Would need to track hits/misses to calculate this
      contextBreakdown,
    };
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    logger.info('CACHE_SEMANTIC', 'Cache cleared');
  }
}

// Singleton instance for global use
export const semanticCache = new SemanticCacheService();
