/**
 * Configuration and selector constants for YouTube Study Filter
 */

(function () {
  console.log(
    '%c[YouTube Study Filter] 🎓 Extension Content Script Loaded! Target: ' + window.location.href,
    'background: #6366f1; color: white; padding: 4px 10px; font-weight: bold; border-radius: 4px; font-size: 12px;'
  );

  window.YTStudyFilter = window.YTStudyFilter || {};

  window.YTStudyFilter.CONFIG = {
    // Selectors for YouTube DOM elements
    SELECTORS: {
      // Containers representing individual video items across different pages
      CARD_CONTAINERS: [
        'ytd-rich-item-renderer',      // Home feed grid items
        'ytd-video-renderer',          // Search results
        'ytd-compact-video-renderer',  // Watch page sidebar / recommended
        'ytd-grid-video-renderer',     // Channel videos tab / grid
        'ytd-reel-item-renderer',      // Shorts shelf item
        'ytd-rich-grid-media'          // Modern nested home feed media
      ],

      // Selectors to find the title element inside a card
      TITLE_ELEMENTS: [
        '#video-title',
        '#video-title-link',
        'a#video-title-link yt-formatted-string',
        'a#video-title yt-formatted-string',
        'h3 a',
        '#title',
        'yt-formatted-string.ytd-video-renderer',
        'yt-formatted-string#video-title',
        'span#video-title'
      ],

      // Selectors to find video link inside a card (for videoId extraction)
      VIDEO_LINKS: [
        'a#thumbnail',
        'a#video-title-link',
        'a#video-title',
        'a[href*="/watch?v="]',
        'a[href*="/shorts/"]'
      ],

      // Selectors for thumbnail elements to apply overlay or blur
      THUMBNAIL_CONTAINERS: [
        'ytd-thumbnail',
        '#thumbnail',
        'a#thumbnail',
        '.ytd-thumbnail',
        'div#thumbnail'
      ]
    },

    // Storage keys for chrome.storage.local
    STORAGE_KEYS: {
      SETTINGS: 'yt_study_filter_settings',
      CACHE: 'yt_study_filter_cache',
      STATS: 'yt_study_filter_stats'
    },

    // Default configuration
    DEFAULT_SETTINGS: {
      enabled: true,
      strictness: 'balanced', // 'relaxed' | 'balanced' | 'strict'
      blurEnabled: true,
      revealEnabled: true,
      backendUrl: 'http://localhost:3000',
      localClassifierEnabled: true,
      cacheTtlMs: 7 * 24 * 60 * 60 * 1000 // 7 days
    },

    // Batching and debounce timings
    TIMINGS: {
      MUTATION_DEBOUNCE_MS: 150,
      BATCH_DEBOUNCE_MS: 200,
      API_TIMEOUT_MS: 8000
    },

    // CSS class names
    CLASSES: {
      BLURRED: 'yt-study-filter-blurred',
      OVERLAY: 'yt-study-filter-overlay',
      REVEAL_BTN: 'yt-study-filter-reveal-btn',
      REVEALED: 'yt-study-filter-revealed',
      PROCESSED: 'yt-study-filter-processed'
    }
  };
})();
