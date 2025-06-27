import { PromptType, PromptResponse } from '../prompt-types';
import { CacheStrategy, CacheStrategyFactory } from './cache-strategies';
import { CacheMetricsCollector } from './cache-metrics';

interface CacheEntry<T> {
  key: string;
  value: PromptResponse<T>;
  timestamp: number;
  expiresAt: number;
  size: number; // Approximate size in bytes
  accessCount: number;
  lastAccessed: number;
}

/**
 * LRU (Least Recently Used) cache implementation for AI responses
 */
export class AIResponseCache {
  private static instance: AIResponseCache;
  private caches: Map<PromptType, Map<string, CacheEntry<any>>> = new Map();
  private metricsCollector: CacheMetricsCollector = new CacheMetricsCollector();
  private totalMemoryUsage: number = 0;
  private maxMemoryUsage: number = 100 * 1024 * 1024; // 100MB default

  private constructor() {
    this.initializeCaches();
    this.startCleanupInterval();
  }

  static getInstance(): AIResponseCache {
    if (!AIResponseCache.instance) {
      AIResponseCache.instance = new AIResponseCache();
    }
    return AIResponseCache.instance;
  }

  /**
   * Get cached response if available
   */
  get<T>(promptType: PromptType, inputs: any): PromptResponse<T> | null {
    if (!CacheStrategyFactory.shouldCache(promptType)) {
      return null;
    }

    const strategy = CacheStrategyFactory.getStrategy(promptType);
    const key = strategy.keyGenerator.generate(promptType, inputs);
    const cache = this.caches.get(promptType);

    if (!cache) {
      this.metricsCollector.recordMiss(promptType);
      return null;
    }

    const entry = cache.get(key);
    if (!entry) {
      this.metricsCollector.recordMiss(promptType);
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      cache.delete(key);
      this.updateMemoryUsage(-entry.size);
      this.metricsCollector.recordMiss(promptType);
      return null;
    }

    // Update access info
    entry.accessCount++;
    entry.lastAccessed = Date.now();

    // Record hit with age
    const age = Date.now() - entry.timestamp;
    this.metricsCollector.recordHit(promptType, age);

    // Return cached response with cache flag
    return {
      ...entry.value,
      cached: true,
    };
  }

  /**
   * Store response in cache
   */
  set<T>(
    promptType: PromptType,
    inputs: any,
    response: PromptResponse<T>
  ): void {
    if (!CacheStrategyFactory.shouldCache(promptType)) {
      return;
    }

    const strategy = CacheStrategyFactory.getStrategy(promptType);

    // Check if response should be cached based on strategy
    if (!strategy.shouldCache(response)) {
      return;
    }

    const key = strategy.keyGenerator.generate(promptType, inputs);
    let cache = this.caches.get(promptType);

    if (!cache) {
      cache = new Map();
      this.caches.set(promptType, cache);
    }

    // Calculate entry size
    const size = this.estimateSize(response);

    // Check memory limit
    if (this.totalMemoryUsage + size > this.maxMemoryUsage) {
      this.evictEntries(size);
    }

    // Check cache size limit
    if (cache.size >= strategy.maxSize) {
      this.evictLRU(promptType);
    }

    // Calculate TTL using adaptive strategy if available
    const adaptiveTTL = strategy.adaptiveTTL ? 
      strategy.adaptiveTTL(response) : 
      strategy.ttl;

    const entry: CacheEntry<T> = {
      key,
      value: response,
      timestamp: Date.now(),
      expiresAt: Date.now() + adaptiveTTL,
      size,
      accessCount: 0,
      lastAccessed: Date.now(),
    };

    cache.set(key, entry);
    this.updateMemoryUsage(size);
  }

  /**
   * Get multiple responses from cache in parallel
   */
  getBatch<T>(
    promptType: PromptType,
    inputsArray: any[]
  ): Array<PromptResponse<T> | null> {
    if (!CacheStrategyFactory.shouldCache(promptType)) {
      return new Array(inputsArray.length).fill(null);
    }

    const strategy = CacheStrategyFactory.getStrategy(promptType);
    const cache = this.caches.get(promptType);
    
    if (!cache) {
      return new Array(inputsArray.length).fill(null);
    }

    // Parallel cache lookups
    const results: Array<PromptResponse<T> | null> = inputsArray.map(inputs => {
      const key = strategy.keyGenerator.generate(promptType, inputs);
      const entry = cache.get(key);
      
      if (!entry) {
        return null;
      }

      // Check TTL
      if (Date.now() > entry.expiresAt) {
        cache.delete(key);
        return null;
      }

      // Update last accessed for LRU
      entry.lastAccessed = Date.now();
      entry.accessCount++;
      
      // Update metrics
      const ageMs = Date.now() - entry.timestamp;
      this.metricsCollector.recordHit(promptType, ageMs);
      
      return entry.value as PromptResponse<T>;
    });

    return results;
  }

  /**
   * Store multiple responses in cache efficiently
   */
  setBatch<T>(
    promptType: PromptType,
    inputsArray: any[],
    responses: Array<PromptResponse<T> | null>
  ): void {
    if (!CacheStrategyFactory.shouldCache(promptType) || 
        inputsArray.length !== responses.length) {
      return;
    }

    const strategy = CacheStrategyFactory.getStrategy(promptType);
    let cache = this.caches.get(promptType);

    if (!cache) {
      cache = new Map();
      this.caches.set(promptType, cache);
    }

    // Batch cache updates
    for (let i = 0; i < inputsArray.length; i++) {
      const response = responses[i];
      
      if (!response || !strategy.shouldCache(response)) {
        continue;
      }

      const key = strategy.keyGenerator.generate(promptType, inputsArray[i]);
      const size = this.estimateSize(response);
      
      // Check memory limits before adding
      if (this.totalMemoryUsage + size > this.maxMemoryUsage) {
        this.evictEntries(size);
      }

      // Calculate adaptive TTL for batch entry
      const adaptiveTTL = strategy.adaptiveTTL ? 
        strategy.adaptiveTTL(response) : 
        strategy.ttl;

      const entry: CacheEntry<T> = {
        key,
        value: response,
        timestamp: Date.now(),
        expiresAt: Date.now() + adaptiveTTL,
        size,
        accessCount: 0,
        lastAccessed: Date.now(),
      };

      cache.set(key, entry);
      this.totalMemoryUsage += size;
    }
  }

  /**
   * Clear cache for specific prompt type or all
   */
  clear(promptType?: PromptType): void {
    if (promptType) {
      const cache = this.caches.get(promptType);
      if (cache) {
        const size = this.getCacheSize(cache);
        cache.clear();
        this.updateMemoryUsage(-size);
      }
    } else {
      this.caches.clear();
      this.totalMemoryUsage = 0;
      this.initializeCaches();
    }
  }

  /**
   * Get cache metrics
   */
  getMetrics() {
    return this.metricsCollector.getMetrics();
  }

  /**
   * Get cache efficiency report
   */
  getEfficiencyReport(): string {
    return this.metricsCollector.getEfficiencyReport();
  }

  /**
   * Warm cache with predicted entries
   */
  async warmCache(
    promptType: PromptType,
    predictedInputs: Array<any>,
    executor: (inputs: any) => Promise<PromptResponse<any>>
  ): Promise<void> {
    const strategy = CacheStrategyFactory.getStrategy(promptType);

    for (const inputs of predictedInputs) {
      const key = strategy.keyGenerator.generate(promptType, inputs);
      const cache = this.caches.get(promptType);

      if (!cache || !cache.has(key)) {
        try {
          const response = await executor(inputs);
          this.set(promptType, inputs, response);
        } catch (error) {
          console.warn(`Cache warming failed for ${promptType}:`, error);
        }
      }
    }
  }

  /**
   * Initialize cache maps
   */
  private initializeCaches(): void {
    for (const promptType of Object.values(PromptType)) {
      if (CacheStrategyFactory.shouldCache(promptType as PromptType)) {
        this.caches.set(promptType as PromptType, new Map());
      }
    }
  }

  /**
   * Start periodic cleanup of expired entries
   */
  private startCleanupInterval(): void {
    setInterval(() => {
      this.cleanupExpiredEntries();
    }, 60 * 1000); // Run every minute
  }

  /**
   * Remove expired entries
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now();

    for (const [promptType, cache] of this.caches.entries()) {
      const expiredKeys: string[] = [];

      for (const [key, entry] of cache.entries()) {
        if (now > entry.expiresAt) {
          expiredKeys.push(key);
        }
      }

      for (const key of expiredKeys) {
        const entry = cache.get(key);
        if (entry) {
          cache.delete(key);
          this.updateMemoryUsage(-entry.size);
          this.metricsCollector.recordEviction(promptType);
        }
      }
    }
  }

  /**
   * Evict least recently used entry from a specific cache
   */
  private evictLRU(promptType: PromptType): void {
    const cache = this.caches.get(promptType);
    if (!cache || cache.size === 0) return;

    let lruKey: string | null = null;
    let lruTime = Infinity;

    for (const [key, entry] of cache.entries()) {
      if (entry.lastAccessed < lruTime) {
        lruTime = entry.lastAccessed;
        lruKey = key;
      }
    }

    if (lruKey) {
      const entry = cache.get(lruKey);
      if (entry) {
        cache.delete(lruKey);
        this.updateMemoryUsage(-entry.size);
        this.metricsCollector.recordEviction(promptType);
      }
    }
  }

  /**
   * Evict entries to free up space
   */
  private evictEntries(requiredSpace: number): void {
    const entries: Array<{
      promptType: PromptType;
      key: string;
      entry: CacheEntry<any>;
    }> = [];

    // Collect all entries
    for (const [promptType, cache] of this.caches.entries()) {
      for (const [key, entry] of cache.entries()) {
        entries.push({ promptType, key, entry });
      }
    }

    // Sort by last accessed (LRU)
    entries.sort((a, b) => a.entry.lastAccessed - b.entry.lastAccessed);

    // Evict until we have enough space
    let freedSpace = 0;
    for (const { promptType, key, entry } of entries) {
      if (freedSpace >= requiredSpace) break;

      const cache = this.caches.get(promptType);
      if (cache) {
        cache.delete(key);
        freedSpace += entry.size;
        this.updateMemoryUsage(-entry.size);
        this.metricsCollector.recordEviction(promptType);
      }
    }
  }

  /**
   * Estimate size of a response in bytes
   */
  private estimateSize(response: PromptResponse<any>): number {
    const json = JSON.stringify(response);
    return json.length * 2; // Rough estimate (2 bytes per character)
  }

  /**
   * Get total size of a cache
   */
  private getCacheSize(cache: Map<string, CacheEntry<any>>): number {
    let size = 0;
    for (const entry of cache.values()) {
      size += entry.size;
    }
    return size;
  }

  /**
   * Update memory usage tracking
   */
  private updateMemoryUsage(delta: number): void {
    this.totalMemoryUsage += delta;

    // Update metrics for each prompt type
    for (const [promptType, cache] of this.caches.entries()) {
      const size = this.getCacheSize(cache);
      this.metricsCollector.updateMemoryUsage(promptType, size);
    }
  }

  /**
   * Get current memory usage
   */
  getMemoryUsage(): { used: number; max: number; percentage: number } {
    return {
      used: this.totalMemoryUsage,
      max: this.maxMemoryUsage,
      percentage: (this.totalMemoryUsage / this.maxMemoryUsage) * 100,
    };
  }

  /**
   * Set maximum memory usage
   */
  setMaxMemoryUsage(bytes: number): void {
    this.maxMemoryUsage = bytes;

    // Evict if currently over limit
    if (this.totalMemoryUsage > this.maxMemoryUsage) {
      this.evictEntries(this.totalMemoryUsage - this.maxMemoryUsage);
    }
  }
}
