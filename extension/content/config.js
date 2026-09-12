/**
 * Configuration and selector constants for YouTube Study Filter
 */

(function () {
  console.log(
    '%c[YouTube Study Filter] 🎓 Content Script loaded on: ' + window.location.href,
    'background: #6366f1; color: white; padding: 4px 10px; font-weight: bold; border-radius: 4px; font-size: 12px;'
  );

  window.YTStudyFilter = window.YTStudyFilter || {};

  window.YTStudyFilter.CONFIG = {
    // Selectors for YouTube DOM elements
    SELECTORS: {
      // Containers representing individual video items across different pages (including modern 2025/2026 ViewModels)
      CARD_CONTAINERS: [
        'ytd-rich-item-renderer',      // Home feed grid items
        'yt-lockup-view-model',        // Modern 2026 YouTube Lockup ViewModel
        '[class*="yt-lockup-view-model"]',
        'ytd-video-renderer',          // Search results
        'ytd-compact-video-renderer',  // Watch page sidebar / recommended
        'ytd-grid-video-renderer',     // Channel videos tab / grid
        'ytd-reel-item-renderer',      // Shorts shelf item
        'ytd-rich-grid-media'          // Modern nested home feed media
      ],

      // Selectors to find the title element inside a card
      TITLE_ELEMENTS: [
        'h3.ytLockupMetadataViewModelHeadingReset',          // Modern 2026 YouTube Title heading
        '.ytLockupMetadataViewModelHeadingReset',
        '[class*="ytLockupMetadataViewModelHeadingReset"]',
        'yt-lockup-metadata-view-model h3',
        '[class*="yt-lockup-metadata-view-model"] h3',
        '[class*="ytLockupMetadataViewModel"] h3',
        'h3[class*="HeadingReset"]',
        'h3 a',
        '#video-title',                                      // Classic YouTube titles
        '#video-title-link',
        'a#video-title-link yt-formatted-string',
        'a#video-title yt-formatted-string',
        'yt-formatted-string.ytd-video-renderer',
        'yt-formatted-string#video-title',
        'span#video-title',
        '#title'
      ],

      // Selectors to find video link inside a card (for videoId extraction)
      VIDEO_LINKS: [
        'a[href*="/watch?v="]',
        'a[href*="/shorts/"]',
        'a#thumbnail',
        'a.yt-thumbnail-view-model__anchor',
        '[class*="ThumbnailViewModel"] a',
        'h3 a',
        'a#video-title-link',
        'a#video-title'
      ],

      // Selectors for thumbnail elements to apply overlay or blur
      THUMBNAIL_CONTAINERS: [
        '.ytThumbnailViewModelImage',                        // Modern 2026 YouTube thumbnail image
        '[class*="ytThumbnailViewModelImage"]',
        'yt-thumbnail-view-model',                           // Modern thumbnail container
        '[class*="yt-thumbnail-view-model"]',
        '[class*="yt-lockup-view-model-wiz__image"]',
        'ytd-thumbnail',                                     // Classic thumbnail containers
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
      aiEngine: 'nano', // 'nano' (Chrome Built-in) | 'direct' (Gemini BYOK)
      geminiApiKey: '',
      geminiModel: 'gemini-2.5-flash',
      strictness: 'balanced', // 'relaxed' | 'balanced' | 'strict'
      blurEnabled: true,
      revealEnabled: true,
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
