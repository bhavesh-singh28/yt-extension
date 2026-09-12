/**
 * DOM Manipulation and Overlay Manager
 * Handles non-destructive card blurring and session-based reveal button overlays
 */

(function () {
  window.YTStudyFilter = window.YTStudyFilter || {};

  class DOMManager {
    constructor() {
      this.config = window.YTStudyFilter.CONFIG;
      this.revealedSessionIds = new Set();
    }

    /**
     * Determines whether a video should be blurred based on classification and strictness
     * @param {string} classification
     * @param {number} confidence
     * @param {string} strictnessMode - 'relaxed' | 'balanced' | 'strict'
     * @returns {boolean}
     */
    shouldBlur(classification, confidence, strictnessMode = 'balanced') {
      if (classification === 'NON_EDUCATIONAL') {
        if (strictnessMode === 'relaxed') {
          return confidence >= 0.75;
        }
        return true;
      }

      if (classification === 'UNCERTAIN') {
        // In strict mode, blur uncertain content
        return strictnessMode === 'strict';
      }

      // EDUCATIONAL is never blurred
      return false;
    }

    /**
     * Apply study filter action to a video element
     * @param {HTMLElement} cardElement
     * @param {string} videoId
     * @param {{ classification: string, confidence: number, reason?: string }} classificationData
     * @param {object} settings
     * @param {string} [title=""]
     */
    applyFilter(cardElement, videoId, classificationData, settings, title = '') {
      if (!cardElement || !videoId) return;

      cardElement.classList.add(this.config.CLASSES.PROCESSED);
      cardElement.dataset.ytStudyFilterVideoId = videoId;
      cardElement.dataset.ytStudyFilterClassification = classificationData.classification;

      // If filter is globally disabled or blur is disabled
      if (!settings.enabled || !settings.blurEnabled) {
        this.removeBlur(cardElement);
        return;
      }

      // If user has already revealed this video during this session
      if (this.revealedSessionIds.has(videoId)) {
        this.removeBlur(cardElement);
        return;
      }

      const mustBlur = this.shouldBlur(
        classificationData.classification,
        classificationData.confidence,
        settings.strictness
      );

      if (mustBlur) {
        console.log(
          `%c[YT Study Filter:DOM] 🔒 BLURRED: [${videoId}] "${title || 'video'}" (${classificationData.classification}, conf: ${classificationData.confidence})`,
          'color: #f43f5e; font-weight: bold;'
        );
        this.blurCard(cardElement, videoId, settings);
      } else {
        console.log(
          `%c[YT Study Filter:DOM] 🎓 UNBLURRED: [${videoId}] "${title || 'video'}" (${classificationData.classification})`,
          'color: #10b981;'
        );
        this.removeBlur(cardElement);
      }
    }

    /**
     * Blurs a video card and injects the reveal button overlay
     * @param {HTMLElement} cardElement
     * @param {string} videoId
     * @param {object} settings
     */
    blurCard(cardElement, videoId, settings) {
      cardElement.classList.add(this.config.CLASSES.BLURRED);

      if (!settings.revealEnabled) {
        const existingOverlay = cardElement.querySelector(`.${this.config.CLASSES.OVERLAY}`);
        if (existingOverlay) existingOverlay.remove();
        return;
      }

      // Locate thumbnail container
      let thumbContainer = window.YTStudyFilter.youtube.findThumbnailContainer(cardElement);
      if (!thumbContainer) {
        thumbContainer = cardElement.querySelector('ytd-thumbnail, #thumbnail, a#thumbnail, .ytd-thumbnail') || cardElement;
      }

      // Ensure container has relative positioning so overlay covers it cleanly
      const computedPos = window.getComputedStyle(thumbContainer).position;
      if (computedPos === 'static') {
        thumbContainer.style.position = 'relative';
      }

      // Check if overlay already exists
      let overlay = thumbContainer.querySelector(`.${this.config.CLASSES.OVERLAY}`);
      if (!overlay) {
        overlay = this.createRevealOverlay(videoId, cardElement);
        thumbContainer.appendChild(overlay);
      } else {
        overlay.style.display = 'flex';
      }
    }

    /**
     * Creates the glassmorphism overlay element with Show button
     * @param {string} videoId
     * @param {HTMLElement} cardElement
     * @returns {HTMLElement}
     */
    createRevealOverlay(videoId, cardElement) {
      const overlay = document.createElement('div');
      overlay.className = this.config.CLASSES.OVERLAY;

      const content = document.createElement('div');
      content.className = 'yt-study-filter-overlay-content';

      const badge = document.createElement('div');
      badge.className = 'yt-study-filter-badge';
      badge.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
        </svg>
        <span>Non-educational</span>
      `;

      const showBtn = document.createElement('button');
      showBtn.type = 'button';
      showBtn.className = this.config.CLASSES.REVEAL_BTN;
      showBtn.textContent = 'Show';
      showBtn.setAttribute('title', 'Reveal video for this session');

      // Click listener on Show button
      showBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        console.log(`%c[YT Study Filter:DOM] 🔓 User revealed video [${videoId}] for session`, 'color: #f59e0b; font-weight: bold;');
        this.revealedSessionIds.add(videoId);
        this.removeBlur(cardElement);

        if (window.YTStudyFilter.cache) {
          window.YTStudyFilter.cache.incrementStat('manuallyRevealedVideos');
        }
      });

      // Prevent entire overlay from triggering YouTube player navigation
      overlay.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });

      content.appendChild(badge);
      content.appendChild(showBtn);
      overlay.appendChild(content);

      return overlay;
    }

    /**
     * Removes blur and hides overlay from a video card
     * @param {HTMLElement} cardElement
     */
    removeBlur(cardElement) {
      if (!cardElement) return;
      cardElement.classList.remove(this.config.CLASSES.BLURRED);

      const overlay = cardElement.querySelector(`.${this.config.CLASSES.OVERLAY}`);
      if (overlay) {
        overlay.remove();
      }
    }

    /**
     * Unblur all processed cards currently in the DOM
     */
    unblurAll() {
      const blurred = document.querySelectorAll(`.${this.config.CLASSES.BLURRED}`);
      console.log(`%c[YT Study Filter:DOM] 👁️ Unblurring all ${blurred.length} cards`, 'color: #94a3b8;');
      blurred.forEach(card => this.removeBlur(card));
    }
  }

  window.YTStudyFilter.dom = new DOMManager();
})();
