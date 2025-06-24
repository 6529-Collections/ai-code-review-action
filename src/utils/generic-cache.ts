/**
 * Generic cache utility for storing any type of data with expiration
 */
export class GenericCache {
  private cache: Map<string, { data: unknown; timestamp: Date }> = new Map();
  private defaultTtlMs: number;

  constructor(defaultTtlMs: number = 3600000) {
    // Default 1 hour TTL
    this.defaultTtlMs = defaultTtlMs;
  }

  get(key: string): unknown | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    // Check if cache has expired
    const ageMs = Date.now() - cached.timestamp.getTime();
    if (ageMs > this.defaultTtlMs) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  set(key: string, data: unknown, ttlMs?: number): void {
    this.cache.set(key, {
      data,
      timestamp: new Date(),
    });

    // If custom TTL is provided, set a timeout to clear this specific entry
    if (ttlMs && ttlMs !== this.defaultTtlMs) {
      setTimeout(() => {
        this.cache.delete(key);
      }, ttlMs);
    }
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  has(key: string): boolean {
    const cached = this.cache.get(key);
    if (!cached) return false;

    // Check if cache has expired
    const ageMs = Date.now() - cached.timestamp.getTime();
    if (ageMs > this.defaultTtlMs) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }
}
