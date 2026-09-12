/**
 * YouTube DOM Extractor and SPA Navigation Handler
 * Supports YouTube's modern ViewModel design system (yt-lockup-view-model,
 * ytLockupMetadataViewModelHeadingReset, ytThumbnailViewModelImage) as well as classic layouts.
 */

(function () {
  window.YTStudyFilter = window.YTStudyFilter || {};

  class YouTubeManager {
    constructor() {
      this.config = window.YTStudyFilter.CONFIG;
    }

    /**
     * Extracts YouTube Video ID from a URL or link element
     * Supports standard /watch?v=ID, /shorts/ID, and embed URLs
     * @param {string} href
     * @returns {string|null}
     */
    extractVideoIdFromUrl(href) {
      if (!href || typeof href !== 'string') return null;

      try {
        const url = new URL(href, window.location.origin);

        // Standard watch URL: /watch?v=...
        const vParam = url.searchParams.get('v');
        if (vParam && /^[a-zA-Z0-9_-]{8,15}$/.test(vParam)) {
          return vParam;
        }

        // Shorts URL: /shorts/...
        const shortsMatch = url.pathname.match(/\/shorts\/([a-zA-Z0-9_-]{8,15})/);
        if (shortsMatch) {
          return shortsMatch[1];
        }

        // Live URL: /live/...
        const liveMatch = url.pathname.match(/\/live\/([a-zA-Z0-9_-]{8,15})/);
        if (liveMatch) {
          return liveMatch[1];
        }
      } catch (err) {
        // Fallback regex
        const regexMatch = href.match(/[?&]v=([a-zA-Z0-9_-]{8,15})|\/shorts\/([a-zA-Z0-9_-]{8,15})/);
        if (regexMatch) {
          return regexMatch[1] || regexMatch[2];
        }
      }

      return null;
    }

    /**
     * Extract video title, video ID, and container element from a YouTube video card
     * @param {HTMLElement} element
     * @returns {{ videoId: string, title: string, element: HTMLElement } | null}
     */
    extractVideoData(element) {
      if (!element || !(element instanceof HTMLElement)) return null;

      // 1. Find Video ID via anchor links inside the card
      let videoId = null;

      for (const selector of this.config.SELECTORS.VIDEO_LINKS) {
        const link = element.querySelector(selector);
        if (link && link.href) {
          videoId = this.extractVideoIdFromUrl(link.href);
          if (videoId) break;
        }
      }

      // If card itself is an anchor
      if (!videoId && element.tagName === 'A' && element.href) {
        videoId = this.extractVideoIdFromUrl(element.href);
      }

      if (!videoId) return null;

      // 2. Find video title inside the card
      let title = '';

      // Check Modern 2026 YouTube Heading first: h3.ytLockupMetadataViewModelHeadingReset
      const modernHeading = element.querySelector(
        'h3.ytLockupMetadataViewModelHeadingReset, [class*="ytLockupMetadataViewModelHeadingReset"], [class*="LockupMetadataViewModel"] h3, h3'
      );

      if (modernHeading) {
        const anchor = modernHeading.querySelector('a');
        const span = modernHeading.querySelector('span');

        title = (
          (anchor && (anchor.getAttribute('title') || anchor.getAttribute('aria-label'))) ||
          (span && (span.getAttribute('title') || span.getAttribute('aria-label'))) ||
          modernHeading.getAttribute('title') ||
          modernHeading.getAttribute('aria-label') ||
          (anchor && anchor.innerText) ||
          modernHeading.innerText ||
          modernHeading.textContent ||
          ''
        ).trim();
      }

      // If modern heading didn't produce title, check classic selectors
      if (!title) {
        for (const selector of this.config.SELECTORS.TITLE_ELEMENTS) {
          const titleEl = element.querySelector(selector);
          if (titleEl) {
            const attrTitle = titleEl.getAttribute('title') || titleEl.getAttribute('aria-label');
            if (attrTitle && attrTitle.trim().length > 0) {
              title = attrTitle.trim();
              break;
            }
            const text = (titleEl.textContent || titleEl.innerText || '').trim();
            if (text.length > 0) {
              title = text;
              break;
            }
          }
        }
      }

      // Fallback to thumbnail link aria-label if title element is still hydrating
      if (!title) {
        const thumbLink = element.querySelector('a[href*="/watch?v="][aria-label], a#thumbnail[aria-label]');
        if (thumbLink) {
          const rawAria = thumbLink.getAttribute('aria-label') || '';
          if (rawAria) {
            const byIndex = rawAria.indexOf(' by ');
            title = (byIndex > 0 ? rawAria.slice(0, byIndex) : rawAria).trim();
          }
        }
      }

      // Clean up whitespace
      title = title.replace(/\s+/g, ' ').trim();

      if (!title) return null;

      return {
        videoId,
        title,
        element
      };
    }

    /**
     * Find all video card elements under a root node
     * @param {Document|HTMLElement} [root=document]
     * @returns {HTMLElement[]}
     */
    findAllVideoCards(root = document) {
      const selector = this.config.SELECTORS.CARD_CONTAINERS.join(',');
      try {
        const nodeList = root.querySelectorAll(selector);
        const cards = Array.from(nodeList);

        // Filter out nested duplicates: if yt-lockup-view-model is inside ytd-rich-item-renderer,
        // keep the outer container to maintain clean card boundary
        const filtered = cards.filter(card => {
          if (card.tagName.toLowerCase() === 'yt-lockup-view-model' || card.classList.contains('yt-lockup-view-model')) {
            const parentRenderer = card.closest('ytd-rich-item-renderer');
            if (parentRenderer && cards.includes(parentRenderer)) {
              return false;
            }
          }
          if (card.tagName.toLowerCase() === 'ytd-rich-grid-media') {
            const parentRenderer = card.closest('ytd-rich-item-renderer');
            if (parentRenderer && cards.includes(parentRenderer)) {
              return false;
            }
          }
          return true;
        });

        return filtered;
      } catch (err) {
        console.warn('[YTStudyFilter:YouTube] Selector query failed:', err);
        return [];
      }
    }

    /**
     * Locate the thumbnail container inside a video card
     * Supports modern ytThumbnailViewModelImage and yt-thumbnail-view-model
     * @param {HTMLElement} cardElement
     * @returns {HTMLElement|null}
     */
    findThumbnailContainer(cardElement) {
      // 1. Check for Modern 2026 ViewModel thumbnail container
      const viewModelThumb = cardElement.querySelector(
        'yt-thumbnail-view-model, [class*="yt-thumbnail-view-model"], [class*="yt-lockup-view-model-wiz__image"]'
      );
      if (viewModelThumb) return viewModelThumb;

      // 2. Check for image with class ytThumbnailViewModelImage
      const thumbImg = cardElement.querySelector(
        '.ytThumbnailViewModelImage, [class*="ytThumbnailViewModelImage"]'
      );
      if (thumbImg) {
        // Return parent anchor or container
        return thumbImg.closest('a, yt-thumbnail-view-model, div') || thumbImg.parentElement;
      }

      // 3. Classic thumbnail selectors
      for (const selector of this.config.SELECTORS.THUMBNAIL_CONTAINERS) {
        const thumb = cardElement.querySelector(selector);
        if (thumb) return thumb;
      }

      return null;
    }

    /**
     * Register listeners for YouTube SPA navigation events
     * @param {() => void} callback
     */
    onNavigation(callback) {
      const events = [
        'yt-navigate-finish',
        'yt-page-data-updated',
        'spfdone',
        'popstate'
      ];

      events.forEach(eventName => {
        window.addEventListener(eventName, () => {
          console.log(`%c[YT Study Filter:Nav] 🧭 Event "${eventName}" detected: ${window.location.href}`, 'color: #3b82f6;');
          callback();
        }, { passive: true });
      });
    }
  }

  window.YTStudyFilter.youtube = new YouTubeManager();
})();
