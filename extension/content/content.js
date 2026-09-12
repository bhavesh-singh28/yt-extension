/**
 * YouTube Study Filter - Content Script Orchestrator
 * Connects DOM observer, deduplication queue, batching, caching, and UI blurring
 */

(function () {
  const { CONFIG, cache, youtube, classifier, dom } = window.YTStudyFilter;

  // Track in-flight API requests by videoId -> array of card elements
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
    if (cards.length === 0) return;

    for (const card of cards) {
      const videoData = youtube.extractVideoData(card);
      if (!videoData) continue;

      const { videoId, title, element } = videoData;

      // 1. Check if classification already exists in cache
      const cached = cache.get(videoId);
      if (cached) {
        dom.applyFilter(element, videoId, cached, currentSettings);
        continue;
      }

      // 2. Check if this videoId is already waiting in pending requests
      if (pendingRequests.has(videoId)) {
        const elements = pendingRequests.get(videoId);
        if (!elements.includes(element)) {
          elements.push(element);
        }
        continue;
      }

      // 3. Fast local heuristic classification for obvious titles
      if (currentSettings.localClassifierEnabled) {
        const localResult = classifier.classifyLocally(title);
        if (localResult) {
          cache.set(videoId, localResult);
          cache.incrementStat('videosAnalyzed');
          if (localResult.classification === 'EDUCATIONAL') {
            cache.incrementStat('educationalVideos');
          } else {
            cache.incrementStat('nonEducationalVideos');
          }

          dom.applyFilter(element, videoId, localResult, currentSettings);
          continue;
        }
      }

      // 4. Queue for batch Gemini classification
      pendingRequests.set(videoId, [element]);
      batchQueue.push({ videoId, title });

      // Reset batch schedule
      if (batchTimer) clearTimeout(batchTimer);
      batchTimer = setTimeout(flushBatchQueue, CONFIG.TIMINGS.BATCH_DEBOUNCE_MS);
    }
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

    // Call backend batch endpoint
    const results = await classifier.classifyBatch(
      currentSettings.backendUrl,
      itemsToClassify
    );

    // Apply results to DOM elements and update cache
    for (const item of itemsToClassify) {
      const { videoId } = item;
      const elements = pendingRequests.get(videoId) || [];
      pendingRequests.delete(videoId);

      const classificationData = results.get(videoId) || {
        classification: 'UNCERTAIN',
        confidence: 0.5,
        reason: 'Backend unavailable or unclassified'
      };

      // Store in cache
      cache.set(videoId, classificationData);

      // Update statistics
      cache.incrementStat('videosAnalyzed');
      if (classificationData.classification === 'EDUCATIONAL') {
        cache.incrementStat('educationalVideos');
      } else if (classificationData.classification === 'NON_EDUCATIONAL') {
        cache.incrementStat('nonEducationalVideos');
      }

      // Apply filter to all associated elements
      for (const el of elements) {
        dom.applyFilter(el, videoId, classificationData, currentSettings);
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
   * Set up MutationObserver to react to YouTube dynamic DOM updates
   */
  function setupMutationObserver() {
    const targetNode = document.querySelector('ytd-app') || document.body;

    const observer = new MutationObserver((mutations) => {
      let shouldProcess = false;

      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const tag = node.tagName ? node.tagName.toLowerCase() : '';
              // Check if added node is a video card or container
              if (
                tag.startsWith('ytd-') ||
                node.querySelector?.(CONFIG.SELECTORS.CARD_CONTAINERS.join(','))
              ) {
                shouldProcess = true;
                break;
              }
            }
          }
        }
        if (shouldProcess) break;
      }

      if (shouldProcess) {
        scheduleScan();
      }
    });

    observer.observe(targetNode, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Re-evaluates all currently processed video elements when settings change
   */
  function reevaluateProcessedCards() {
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
   * Listen for settings updates from popup via chrome.storage
   */
  function setupStorageListener() {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes[CONFIG.STORAGE_KEYS.SETTINGS]) {
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
    });
  }

  /**
   * Initialize extension
   */
  async function init() {
    await cache.init();
    currentSettings = { ...currentSettings, ...cache.settings };

    // Setup YouTube SPA navigation triggers
    youtube.onNavigation(() => {
      scheduleScan();
    });

    // Setup storage changes listener
    setupStorageListener();

    // Setup MutationObserver
    setupMutationObserver();

    // Initial DOM scan
    scheduleScan();
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
