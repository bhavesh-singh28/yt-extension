/**
 * Cache and Statistics Management
 * Stores simple { isEducational: true | false } with TTL
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
    }

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
          this._pruneExpired();
        }

        if (data[this.config.STORAGE_KEYS.STATS]) {
          this.stats = { ...this.stats, ...data[this.config.STORAGE_KEYS.STATS] };
        }

        this.isInitialized = true;
      } catch (err) {
        this.isInitialized = true;
      }
    }

    _pruneExpired() {
      const now = Date.now();
      const ttl = this.settings.cacheTtlMs || this.config.DEFAULT_SETTINGS.cacheTtlMs;
      let hasPruned = false;

      for (const [id, item] of Object.entries(this.persistentCache)) {
        if (!item.timestamp || (now - item.timestamp > ttl)) {
          delete this.persistentCache[id];
          hasPruned = true;
        }
      }

      if (hasPruned) {
        chrome.storage.local.set({
          [this.config.STORAGE_KEYS.CACHE]: this.persistentCache
        }).catch(() => {});
      }
    }

    get(videoId) {
      if (!videoId) return null;

      if (this.sessionCache.has(videoId)) {
        return this.sessionCache.get(videoId);
      }

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

    set(videoId, classificationData) {
      if (!videoId || !classificationData) return;

      const record = {
        isEducational: classificationData.isEducational === true,
        timestamp: Date.now()
      };

      this.sessionCache.set(videoId, record);
      this.persistentCache[videoId] = record;

      if (this._saveDebounceTimer) clearTimeout(this._saveDebounceTimer);
      this._saveDebounceTimer = setTimeout(async () => {
        try {
          await chrome.storage.local.set({
            [this.config.STORAGE_KEYS.CACHE]: this.persistentCache
          });
        } catch (err) {
          // ignore
        }
      }, 500);
    }

    async incrementStat(statKey, count = 1) {
      if (typeof this.stats[statKey] !== 'number') return;
      this.stats[statKey] += count;

      try {
        await chrome.storage.local.set({
          [this.config.STORAGE_KEYS.STATS]: this.stats
        });
      } catch (err) {
        // ignore
      }
    }

    async clear() {
      this.sessionCache.clear();
      this.persistentCache = {};
      try {
        await chrome.storage.local.remove([this.config.STORAGE_KEYS.CACHE]);
        console.log('%c[YT Study Filter:Cache] 🗑️ Cache cleared!', 'color: #10b981; font-weight: bold;');
      } catch (err) {
        // ignore
      }
    }
  }

  window.YTStudyFilter.cache = new CacheManager();
})();
