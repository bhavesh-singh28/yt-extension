/**
 * Cache and Statistics Management
 * Handles in-memory session cache and persistent chrome.storage.local with TTL
 */

(function () {
  window.YTStudyFilter = window.YTStudyFilter || {};

  class CacheManager {
    constructor() {
      this.config = window.YTStudyFilter.CONFIG;
      this.sessionCache = new Map();
      this.persistentCache = {};
      this.settings = { ...this.config.DEFAULT_SETTINGS };
      this.stats = {
        videosAnalyzed: 0,
        educationalVideos: 0,
        nonEducationalVideos: 0,
        manuallyRevealedVideos: 0
      };
      this.isInitialized = false;
      this._saveDebounceTimer = null;
      this._pendingCacheWrites = {};
    }

    /**
     * Initialize cache and load data from chrome.storage.local
     */
    async init() {
      try {
        const keys = [
          this.config.STORAGE_KEYS.SETTINGS,
          this.config.STORAGE_KEYS.CACHE,
          this.config.STORAGE_KEYS.STATS
        ];

        const data = await chrome.storage.local.get(keys);

        if (data[this.config.STORAGE_KEYS.SETTINGS]) {
          this.settings = { ...this.settings, ...data[this.config.STORAGE_KEYS.SETTINGS] };
        }

        if (data[this.config.STORAGE_KEYS.CACHE]) {
          this.persistentCache = data[this.config.STORAGE_KEYS.CACHE] || {};
          // Prune expired or fallback error entries
          this._pruneExpiredAndErrors();
        }

        if (data[this.config.STORAGE_KEYS.STATS]) {
          this.stats = { ...this.stats, ...data[this.config.STORAGE_KEYS.STATS] };
        }

        this.isInitialized = true;
        console.log(
          '%c[YT Study Filter:Cache] ⚡ Initialized with ' + Object.keys(this.persistentCache).length + ' cached classifications',
          'color: #6366f1; font-weight: bold;'
        );
      } catch (err) {
        console.warn('[YTStudyFilter:Cache] Failed to load storage:', err);
        this.isInitialized = true;
      }
    }

    /**
     * Remove entries older than TTL or entries cached as transient errors
     */
    _pruneExpiredAndErrors() {
      const now = Date.now();
      const ttl = this.settings.cacheTtlMs || this.config.DEFAULT_SETTINGS.cacheTtlMs;
      let hasPruned = false;
      let prunedErrors = 0;

      for (const [id, item] of Object.entries(this.persistentCache)) {
        const isExpired = !item.timestamp || (now - item.timestamp > ttl);
        // Clear out any old error fallbacks so they can be freshly classified
        const isErrorFallback = item.reason && (
          item.reason.includes('Fallback') ||
          item.reason.includes('error') ||
          item.reason.includes('404') ||
          item.reason.includes('unavailable')
        );

        if (isExpired || isErrorFallback) {
          delete this.persistentCache[id];
          hasPruned = true;
          if (isErrorFallback) prunedErrors++;
        }
      }

      if (hasPruned) {
        if (prunedErrors > 0) {
          console.log(`%c[YT Study Filter:Cache] 🧹 Cleaned ${prunedErrors} stale error entries from cache`, 'color: #f59e0b;');
        }
        chrome.storage.local.set({
          [this.config.STORAGE_KEYS.CACHE]: this.persistentCache
        }).catch(() => {});
      }
    }

    /**
     * Check if a video ID is cached and valid
     * @param {string} videoId
     * @returns {object|null} Classification object or null
     */
    get(videoId) {
      if (!videoId) return null;

      // 1. Check in-memory session cache first
      if (this.sessionCache.has(videoId)) {
        return this.sessionCache.get(videoId);
      }

      // 2. Check persistent cache
      const cached = this.persistentCache[videoId];
      if (cached) {
        const now = Date.now();
        const ttl = this.settings.cacheTtlMs || this.config.DEFAULT_SETTINGS.cacheTtlMs;
        if (!cached.timestamp || (now - cached.timestamp <= ttl)) {
          this.sessionCache.set(videoId, cached);
          return cached;
        } else {
          delete this.persistentCache[videoId];
        }
      }

      return null;
    }

    /**
     * Store a classification result in both session cache and persistent storage
     * @param {string} videoId
     * @param {object} classificationData
     */
    set(videoId, classificationData) {
      if (!videoId || !classificationData) return;

      const record = {
        classification: classificationData.classification,
        confidence: classificationData.confidence || 0.9,
        reason: classificationData.reason || '',
        timestamp: Date.now()
      };

      // Set in-memory session cache immediately
      this.sessionCache.set(videoId, record);

      // Do NOT persist transient server errors to long-term storage
      const isTransientError = record.reason && (
        record.reason.includes('Fallback') ||
        record.reason.includes('error') ||
        record.reason.includes('unavailable')
      );

      if (isTransientError) {
        return;
      }

      this.persistentCache[videoId] = record;
      this._pendingCacheWrites[videoId] = record;

      if (this._saveDebounceTimer) {
        clearTimeout(this._saveDebounceTimer);
      }

      this._saveDebounceTimer = setTimeout(async () => {
        try {
          await chrome.storage.local.set({
            [this.config.STORAGE_KEYS.CACHE]: this.persistentCache
          });
          this._pendingCacheWrites = {};
        } catch (err) {
          console.warn('[YTStudyFilter:Cache] Failed to save persistent cache:', err);
        }
      }, 500);
    }

    /**
     * Increment specific stat counters in storage
     * @param {'videosAnalyzed'|'educationalVideos'|'nonEducationalVideos'|'manuallyRevealedVideos'} statKey
     * @param {number} [count=1]
     */
    async incrementStat(statKey, count = 1) {
      if (typeof this.stats[statKey] !== 'number') return;
      this.stats[statKey] += count;

      try {
        await chrome.storage.local.set({
          [this.config.STORAGE_KEYS.STATS]: this.stats
        });
      } catch (err) {
        // Ignored gracefully
      }
    }

    /**
     * Clear all cached items
     */
    async clear() {
      this.sessionCache.clear();
      this.persistentCache = {};
      this._pendingCacheWrites = {};
      try {
        await chrome.storage.local.remove([this.config.STORAGE_KEYS.CACHE]);
        console.log('%c[YT Study Filter:Cache] 🗑️ All cache cleared!', 'color: #10b981; font-weight: bold;');
      } catch (err) {
        console.warn('[YTStudyFilter:Cache] Failed to clear storage cache:', err);
      }
    }
  }

  window.YTStudyFilter.cache = new CacheManager();
})();
