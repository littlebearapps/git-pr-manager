import { APICache, globalCache } from '../../src/utils/cache';

describe('APICache', () => {
  let cache: APICache;

  beforeEach(() => {
    cache = new APICache();
  });

  describe('Constructor', () => {
    it('should initialize with default options', () => {
      const stats = cache.getStats();

      expect(stats.max).toBe(100);
      expect(stats.ttl).toBe(5 * 60 * 1000); // 5 minutes
      expect(stats.size).toBe(0);
    });

    it('should initialize with custom max', () => {
      const customCache = new APICache({ max: 50 });
      const stats = customCache.getStats();

      expect(stats.max).toBe(50);
    });

    it('should initialize with custom ttl', () => {
      const customCache = new APICache({ ttl: 10000 });
      const stats = customCache.getStats();

      expect(stats.ttl).toBe(10000);
    });

    it('should initialize with custom max and ttl', () => {
      const customCache = new APICache({ max: 200, ttl: 30000 });
      const stats = customCache.getStats();

      expect(stats.max).toBe(200);
      expect(stats.ttl).toBe(30000);
    });
  });

  describe('Basic Operations', () => {
    describe('set and has', () => {
      it('should set a value and confirm it exists', () => {
        cache.set('key1', { data: 'value1' });

        expect(cache.has('key1')).toBe(true);
      });

      it('should return false for non-existent key', () => {
        expect(cache.has('nonexistent')).toBe(false);
      });

      it('should set value with etag', () => {
        cache.set('key1', { data: 'value1' }, 'etag123');

        expect(cache.has('key1')).toBe(true);
      });

      it('should set value with custom ttl', () => {
        cache.set('key1', { data: 'value1' }, undefined, 1000);

        expect(cache.has('key1')).toBe(true);
      });
    });

    describe('delete', () => {
      it('should delete existing key', () => {
        cache.set('key1', { data: 'value1' });

        const result = cache.delete('key1');

        expect(result).toBe(true);
        expect(cache.has('key1')).toBe(false);
      });

      it('should return false when deleting non-existent key', () => {
        const result = cache.delete('nonexistent');

        expect(result).toBe(false);
      });
    });

    describe('clear', () => {
      it('should clear all cache entries', () => {
        cache.set('key1', { data: 'value1' });
        cache.set('key2', { data: 'value2' });
        cache.set('key3', { data: 'value3' });

        cache.clear();

        expect(cache.getStats().size).toBe(0);
        expect(cache.has('key1')).toBe(false);
        expect(cache.has('key2')).toBe(false);
        expect(cache.has('key3')).toBe(false);
      });

      it('should handle clearing empty cache', () => {
        cache.clear();

        expect(cache.getStats().size).toBe(0);
      });
    });
  });

  describe('get method', () => {
    it('should call fetcher on cache miss', async () => {
      const fetcher = jest.fn().mockResolvedValue({ data: 'fetched' });

      const result = await cache.get('key1', fetcher);

      expect(fetcher).toHaveBeenCalled();
      expect(result).toEqual({ data: 'fetched' });
    });

    it('should return cached data on cache hit', async () => {
      const fetcher = jest.fn().mockResolvedValue({ data: 'fetched' });

      // First call - cache miss
      await cache.get('key1', fetcher);

      // Second call - cache hit
      const result = await cache.get('key1', fetcher);

      expect(fetcher).toHaveBeenCalledTimes(1); // Only called once
      expect(result).toEqual({ data: 'fetched' });
    });

    it('should cache the fetched data', async () => {
      const fetcher = jest.fn().mockResolvedValue({ data: 'fetched' });

      await cache.get('key1', fetcher);

      expect(cache.has('key1')).toBe(true);
    });

    it('should handle custom ttl', async () => {
      const fetcher = jest.fn().mockResolvedValue({ data: 'fetched' });

      await cache.get('key1', fetcher, 1000);

      expect(cache.has('key1')).toBe(true);
    });

    it('should refetch when custom ttl expires', async () => {
      jest.useFakeTimers();
      const fetcher = jest.fn()
        .mockResolvedValueOnce({ data: 'first' })
        .mockResolvedValueOnce({ data: 'second' });

      // First fetch
      const result1 = await cache.get('key1', fetcher, 1000);
      expect(result1).toEqual({ data: 'first' });

      // Advance time past TTL
      jest.advanceTimersByTime(1001);

      // Second fetch - should refetch because stale
      const result2 = await cache.get('key1', fetcher, 1000);
      expect(result2).toEqual({ data: 'second' });
      expect(fetcher).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });

    it('should not refetch when within TTL', async () => {
      jest.useFakeTimers();
      const fetcher = jest.fn().mockResolvedValue({ data: 'fetched' });

      // First fetch
      await cache.get('key1', fetcher, 5000);

      // Advance time but stay within TTL
      jest.advanceTimersByTime(2000);

      // Second fetch - should use cache
      const result = await cache.get('key1', fetcher, 5000);
      expect(result).toEqual({ data: 'fetched' });
      expect(fetcher).toHaveBeenCalledTimes(1);

      jest.useRealTimers();
    });
  });

  describe('getWithETag method', () => {
    it('should fetch on first request (no cached etag)', async () => {
      const fetcher = jest.fn().mockResolvedValue({
        data: { result: 'data' },
        etag: 'etag123',
        status: 200
      });

      const result = await cache.getWithETag('key1', fetcher);

      expect(fetcher).toHaveBeenCalledWith(undefined);
      expect(result).toEqual({ result: 'data' });
    });

    it('should pass cached etag on subsequent request', async () => {
      const fetcher = jest.fn()
        .mockResolvedValueOnce({
          data: { result: 'data' },
          etag: 'etag123',
          status: 200
        })
        .mockResolvedValueOnce({
          data: null,
          etag: 'etag123',
          status: 304
        });

      // First request
      await cache.getWithETag('key1', fetcher);

      // Second request
      await cache.getWithETag('key1', fetcher);

      expect(fetcher).toHaveBeenNthCalledWith(1, undefined);
      expect(fetcher).toHaveBeenNthCalledWith(2, 'etag123');
    });

    it('should return cached data on 304 Not Modified', async () => {
      const fetcher = jest.fn()
        .mockResolvedValueOnce({
          data: { result: 'original' },
          etag: 'etag123',
          status: 200
        })
        .mockResolvedValueOnce({
          data: null,
          etag: 'etag123',
          status: 304
        });

      // First request - get and cache
      const result1 = await cache.getWithETag('key1', fetcher);
      expect(result1).toEqual({ result: 'original' });

      // Second request - 304 Not Modified
      const result2 = await cache.getWithETag('key1', fetcher);
      expect(result2).toEqual({ result: 'original' });
    });

    it('should update cache on 200 OK', async () => {
      const fetcher = jest.fn()
        .mockResolvedValueOnce({
          data: { result: 'original' },
          etag: 'etag123',
          status: 200
        })
        .mockResolvedValueOnce({
          data: { result: 'updated' },
          etag: 'etag456',
          status: 200
        });

      // First request
      const result1 = await cache.getWithETag('key1', fetcher);
      expect(result1).toEqual({ result: 'original' });

      // Second request - new data
      const result2 = await cache.getWithETag('key1', fetcher);
      expect(result2).toEqual({ result: 'updated' });
    });

    it('should cache the new etag', async () => {
      const fetcher = jest.fn()
        .mockResolvedValueOnce({
          data: { result: 'data' },
          etag: 'etag123',
          status: 200
        })
        .mockResolvedValueOnce({
          data: null,
          etag: 'etag123',
          status: 304
        })
        .mockResolvedValueOnce({
          data: null,
          etag: 'etag123',
          status: 304
        });

      await cache.getWithETag('key1', fetcher);
      await cache.getWithETag('key1', fetcher);
      await cache.getWithETag('key1', fetcher);

      // All requests should use the cached etag
      expect(fetcher).toHaveBeenNthCalledWith(2, 'etag123');
      expect(fetcher).toHaveBeenNthCalledWith(3, 'etag123');
    });
  });

  describe('getStats method', () => {
    it('should return initial stats', () => {
      const stats = cache.getStats();

      expect(stats).toEqual({
        size: 0,
        max: 100,
        ttl: 5 * 60 * 1000
      });
    });

    it('should return updated size after adding entries', () => {
      cache.set('key1', { data: 'value1' });
      cache.set('key2', { data: 'value2' });
      cache.set('key3', { data: 'value3' });

      const stats = cache.getStats();

      expect(stats.size).toBe(3);
    });

    it('should return updated size after deleting entries', () => {
      cache.set('key1', { data: 'value1' });
      cache.set('key2', { data: 'value2' });
      cache.delete('key1');

      const stats = cache.getStats();

      expect(stats.size).toBe(1);
    });

    it('should return custom max and ttl', () => {
      const customCache = new APICache({ max: 50, ttl: 10000 });
      const stats = customCache.getStats();

      expect(stats).toEqual({
        size: 0,
        max: 50,
        ttl: 10000
      });
    });
  });

  describe('LRU Eviction', () => {
    it('should evict least recently used entry when cache is full', () => {
      const smallCache = new APICache({ max: 3 });

      smallCache.set('key1', { data: 'value1' });
      smallCache.set('key2', { data: 'value2' });
      smallCache.set('key3', { data: 'value3' });

      expect(smallCache.has('key1')).toBe(true);

      // Adding 4th entry should evict key1 (LRU)
      smallCache.set('key4', { data: 'value4' });

      expect(smallCache.has('key1')).toBe(false);
      expect(smallCache.has('key2')).toBe(true);
      expect(smallCache.has('key3')).toBe(true);
      expect(smallCache.has('key4')).toBe(true);
    });

    it('should update LRU order on access', async () => {
      const smallCache = new APICache({ max: 3 });
      const fetcher = jest.fn().mockResolvedValue({ data: 'value' });

      smallCache.set('key1', { data: 'value1' });
      smallCache.set('key2', { data: 'value2' });
      smallCache.set('key3', { data: 'value3' });

      // Access key1 (makes it most recently used)
      await smallCache.get('key1', fetcher);

      // Add key4 - should evict key2 (not key1)
      smallCache.set('key4', { data: 'value4' });

      expect(smallCache.has('key1')).toBe(true);
      expect(smallCache.has('key2')).toBe(false);
      expect(smallCache.has('key3')).toBe(true);
      expect(smallCache.has('key4')).toBe(true);
    });
  });

  describe('TTL Expiration', () => {
    it('should accept custom TTL in constructor', () => {
      const shortTtlCache = new APICache({ ttl: 1000 });
      const stats = shortTtlCache.getStats();

      expect(stats.ttl).toBe(1000);
    });

    it('should accept custom TTL in set method', () => {
      const cache = new APICache();

      // set() accepts custom TTL as 4th parameter
      cache.set('key1', { data: 'value' }, undefined, 2000);

      expect(cache.has('key1')).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle fetcher throwing error', async () => {
      const fetcher = jest.fn().mockRejectedValue(new Error('Fetch failed'));

      await expect(cache.get('key1', fetcher)).rejects.toThrow('Fetch failed');
    });

    it('should handle getWithETag fetcher throwing error', async () => {
      const fetcher = jest.fn().mockRejectedValue(new Error('Fetch failed'));

      await expect(cache.getWithETag('key1', fetcher)).rejects.toThrow('Fetch failed');
    });

    it('should handle setting null data', () => {
      cache.set('key1', null);

      expect(cache.has('key1')).toBe(true);
    });

    it('should handle setting undefined data', () => {
      cache.set('key1', undefined);

      expect(cache.has('key1')).toBe(true);
    });
  });

  describe('Global Cache Instance', () => {
    it('should export a global cache instance', () => {
      expect(globalCache).toBeDefined();
      expect(globalCache).toBeInstanceOf(APICache);
    });

    it('should have default configuration', () => {
      const stats = globalCache.getStats();

      expect(stats.max).toBe(100);
      expect(stats.ttl).toBe(5 * 60 * 1000);
    });
  });
});
