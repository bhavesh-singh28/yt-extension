/**
 * YouTube Study Filter - Content Script Orchestrator
 * Connects DOM observer, deduplication queue, batching, caching, and UI blurring
 */

(function () {
  const { CONFIG, cache, youtube, classifier, dom } = window.YTStudyFilter;

  // Track in-flight API requests by videoId -> array of { element, title }
  const pendingRequests = new Map();

  // Queue of { videoId, title, element } waiting for batch classification
  let batchQueue = [];
  let batchTimer = null;

  // Debounce timer for MutationObserver
  let mutationDebounceTimer = null;

  // Active settings cached locally
  let currentSettings = { ...CONFIG.DEFAULT_SETTINGS };

  /**
   * Main processor for video cards
   */
  async function processVideoCards() {
    if (!currentSettings.enabled) return;

    const cards = youtube.findAllVideoCards();
    if (cards.length === 0) {
      console.log('%c[YT Study Filter:Core] ⏳ No video cards found yet on this scan (DOM may still be hydrating).', 'color: #94a3b8;');
      return;
    }

    let newlyQueued = 0;
    let cacheHits = 0;
    let localHits = 0;

    for (const card of cards) {
      const videoData = youtube.extractVideoData(card);
      if (!videoData) continue; // Skeleton or unhydrated card

      const { videoId, title, element } = videoData;

      // 1. Check if classification already exists in cache
      const cached = cache.get(videoId);
      if (cached) {
        cacheHits++;
        dom.applyFilter(element, videoId, cached, currentSettings, title);
        continue;
      }

      // 2. Check if this videoId is already waiting in pending requests
      if (pendingRequests.has(videoId)) {
        const list = pendingRequests.get(videoId);
        if (!list.some(item => item.element === element)) {
          list.push({ element, title });
        }
        continue;
      }

      // 3. Fast local heuristic classification for obvious titles
      if (currentSettings.localClassifierEnabled) {
        const localResult = classifier.classifyLocally(title);
        if (localResult) {
          localHits++;
          console.log(
            `%c[YT Study Filter:Core] 🧠 Local match [${videoId}] "${title}" -> isEducational: ${localResult.isEducational}`,
            'color: #38bdf8; font-weight: bold;'
          );
          cache.set(videoId, localResult);
          cache.incrementStat('videosAnalyzed');
          if (localResult.isEducational) {
            cache.incrementStat('educationalVideos');
          } else {
            cache.incrementStat('nonEducationalVideos');
          }

          dom.applyFilter(element, videoId, localResult, currentSettings, title);
          continue;
        }
      }

      // 4. Queue for batch Gemini classification
      newlyQueued++;
      pendingRequests.set(videoId, [{ element, title }]);
      batchQueue.push({ videoId, title });

      console.log(`%c[YT Study Filter:Core] ⏳ Queued for Gemini AI: [${videoId}] "${title}"`, 'color: #94a3b8;');

      // Reset batch schedule
      if (batchTimer) clearTimeout(batchTimer);
      batchTimer = setTimeout(flushBatchQueue, CONFIG.TIMINGS.BATCH_DEBOUNCE_MS);
    }

    console.log(
      `%c[YT Study Filter:Core] 📊 DOM Scan: ${cards.length} cards found | ${cacheHits} cached | ${localHits} local | ${newlyQueued} queued for AI`,
      'color: #6366f1; font-weight: bold;'
    );
  }

  /**
   * Flushes the queued videos and sends a single batch classification request
   */
  async function flushBatchQueue() {
    if (batchQueue.length === 0) return;

    // Deduplicate queued items by videoId
    const uniqueMap = new Map();
    for (const item of batchQueue) {
      if (!uniqueMap.has(item.videoId)) {
        uniqueMap.set(item.videoId, item.title);
      }
    }
    batchQueue = [];

    const itemsToClassify = Array.from(uniqueMap.entries()).map(([videoId, title]) => ({
      videoId,
      title
    }));

    console.log(
      `%c[YT Study Filter:Core] 📤 Sending batch request for ${itemsToClassify.length} titles to backend...`,
      'color: #8b5cf6; font-weight: bold;'
    );

    // Call backend batch endpoint
    const results = await classifier.classifyBatch(
      currentSettings.backendUrl,
      itemsToClassify
    );

    // Apply results to DOM elements and update cache
    for (const item of itemsToClassify) {
      const { videoId, title } = item;
      const elementRecords = pendingRequests.get(videoId) || [];
      pendingRequests.delete(videoId);

      const classificationData = results.get(videoId) || {
        isEducational: false
      };

      // Store in cache
      cache.set(videoId, classificationData);

      // Update statistics
      cache.incrementStat('videosAnalyzed');
      if (classificationData.isEducational) {
        cache.incrementStat('educationalVideos');
      } else {
        cache.incrementStat('nonEducationalVideos');
      }

      // Apply filter to all associated elements
      for (const rec of elementRecords) {
        dom.applyFilter(rec.element, videoId, classificationData, currentSettings, rec.title || title);
      }
    }
  }

  /**
   * Debounced wrapper for DOM mutation updates
   */
  function scheduleScan() {
    if (mutationDebounceTimer) clearTimeout(mutationDebounceTimer);
    mutationDebounceTimer = setTimeout(() => {
      requestAnimationFrame(() => {
        processVideoCards();
      });
    }, CONFIG.TIMINGS.MUTATION_DEBOUNCE_MS);
  }

  /**
   * Run scans on schedule to catch lazily loaded titles
   */
  function scheduleHydrationScans() {
    [150, 450, 900, 1800, 3000].forEach(delay => {
      setTimeout(() => {
        requestAnimationFrame(() => {
          processVideoCards();
        });
      }, delay);
    });
  }

  /**
   * Set up MutationObserver to react to YouTube dynamic DOM updates
   */
  function setupMutationObserver() {
    const targetNode = document.querySelector('ytd-app') || document.body;

    const observer = new MutationObserver(() => {
      scheduleScan();
    });

    observer.observe(targetNode, {
      childList: true,
      subtree: true
    });

    console.log('%c[YT Study Filter:Core] 👁️ MutationObserver attached to YouTube DOM', 'color: #10b981;');
  }

  /**
   * Re-evaluates all currently processed video elements when settings change
   */
  function reevaluateProcessedCards() {
    console.log('%c[YT Study Filter:Core] 🔄 Re-evaluating cards with updated settings:', 'color: #f59e0b;', currentSettings);
    if (!currentSettings.enabled || !currentSettings.blurEnabled) {
      dom.unblurAll();
      return;
    }

    const cards = document.querySelectorAll(`.${CONFIG.CLASSES.PROCESSED}`);
    cards.forEach(card => {
      const videoId = card.dataset.ytStudyFilterVideoId;
      if (videoId) {
        const cached = cache.get(videoId);
        if (cached) {
          dom.applyFilter(card, videoId, cached, currentSettings);
        }
      }
    });
  }

  /**
   * Listen for settings, cache, and stats updates from popup via chrome.storage and runtime messages
   */
  function setupStorageListener() {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local') {
        // Settings changed
        if (changes[CONFIG.STORAGE_KEYS.SETTINGS]) {
          const newSettings = changes[CONFIG.STORAGE_KEYS.SETTINGS].newValue;
          if (newSettings) {
            currentSettings = { ...currentSettings, ...newSettings };
            cache.settings = currentSettings;
            reevaluateProcessedCards();
            if (currentSettings.enabled) {
              scheduleScan();
            }
          }
        }

        // Cache was cleared from popup
        if (changes[CONFIG.STORAGE_KEYS.CACHE] && !changes[CONFIG.STORAGE_KEYS.CACHE].newValue) {
          cache.sessionCache.clear();
          cache.persistentCache = {};
          console.log('%c[YT Study Filter:Core] 🧹 In-memory session cache cleared', 'color: #10b981;');
        }

        // Stats were reset to zero from popup
        if (changes[CONFIG.STORAGE_KEYS.STATS] && changes[CONFIG.STORAGE_KEYS.STATS].newValue) {
          cache.stats = { ...changes[CONFIG.STORAGE_KEYS.STATS].newValue };
        }
      }
    });

    // Listen for direct broadcast to clear caches and re-evaluate
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg && msg.action === 'CLEAR_CACHE_AND_STATS') {
        cache.sessionCache.clear();
        cache.persistentCache = {};
        cache.stats = {
          videosAnalyzed: 0,
          educationalVideos: 0,
          nonEducationalVideos: 0,
          manuallyRevealedVideos: 0
        };
        console.log('%c[YT Study Filter:Core] 🧹 State cleared and re-scanning YouTube cards', 'color: #10b981;');
        scheduleScan();
      }
    });
  }

  /**
   * Initialize extension
   */
  async function init() {
    console.log(
      '%c=============================================\n' +
      '🎓 YouTube Study Filter Active!\n' +
      'Version: 1.0.0\n' +
      'Open DevTools to observe real-time classification logs.\n' +
      '=============================================',
      'color: #6366f1; font-weight: bold; font-size: 13px;'
    );

    await cache.init();
    currentSettings = { ...currentSettings, ...cache.settings };

    // Setup YouTube SPA navigation triggers
    youtube.onNavigation(() => {
      console.log('%c[YT Study Filter:Core] 🧭 SPA navigation: triggering hydration scan', 'color: #3b82f6;');
      scheduleHydrationScans();
    });

    // Setup storage changes listener
    setupStorageListener();

    // Setup MutationObserver
    setupMutationObserver();

    // Initial scans
    scheduleHydrationScans();
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
