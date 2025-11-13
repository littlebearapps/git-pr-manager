import { LRUCache } from 'lru-cache';

/**
 * Cache entry with ETag support
 */
interface CacheEntry {
  data: any;
  etag: string | null;
  timestamp: number;
}

/**
 * APICache - LRU cache for API responses with ETag support
 *
 * Provides intelligent caching with:
 * - TTL-based expiration
 * - ETag conditional requests
 * - LRU eviction policy
 * - Configurable size limits
 */
export class APICache {
  private cache: LRUCache<string, CacheEntry>;

  constructor(options?: {
    max?: number;
    ttl?: number;
  }) {
    this.cache = new LRUCache<string, CacheEntry>({
      max: options?.max ?? 100,
      ttl: options?.ttl ?? 5 * 60 * 1000, // 5 minutes default
    });
  }

  /**
   * Get cached data or fetch if missing/stale
   *
   * @param key - Unique cache key
   * @param fetcher - Function to fetch data if cache miss
   * @param ttl - Optional TTL override (milliseconds)
   * @returns Cached or fresh data
   */
  async get<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = this.cache.get(key);

    if (cached && !this.isStale(cached, ttl)) {
      return cached.data as T;
    }

    const data = await fetcher();
    this.cache.set(
      key,
      { data, etag: null, timestamp: Date.now() },
      { ttl }
    );

    return data;
  }

  /**
   * Get with ETag support for conditional requests
   *
   * @param key - Unique cache key
   * @param fetcher - Function that accepts etag and returns response
   * @returns Cached or fresh data
   */
  async getWithETag<T>(
    key: string,
    fetcher: (etag?: string) => Promise<{
      data: T;
      etag: string;
      status: number
    }>
  ): Promise<T> {
    const cached = this.cache.get(key);
    const etag = cached?.etag ?? undefined;

    const response = await fetcher(etag);

    // 304 Not Modified - use cached data
    if (response.status === 304 && cached) {
      return cached.data as T;
    }

    // New data - update cache
    this.cache.set(key, {
      data: response.data,
      etag: response.etag,
      timestamp: Date.now()
    });

    return response.data;
  }

  /**
   * Manually set a cache entry
   */
  set(key: string, data: any, etag?: string, ttl?: number): void {
    this.cache.set(
      key,
      { data, etag: etag ?? null, timestamp: Date.now() },
      { ttl }
    );
  }

  /**
   * Check if a cached entry exists
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Delete a cache entry
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    max: number;
    ttl: number;
  } {
    return {
      size: this.cache.size,
      max: this.cache.max,
      ttl: this.cache.ttl ?? 0
    };
  }

  /**
   * Check if a cache entry is stale
   */
  private isStale(entry: CacheEntry, customTtl?: number): boolean {
    if (!customTtl) return false;

    const age = Date.now() - entry.timestamp;
    return age > customTtl;
  }
}

/**
 * Global cache instance for shared use
 */
export const globalCache = new APICache({
  max: 100,
  ttl: 5 * 60 * 1000 // 5 minutes
});
