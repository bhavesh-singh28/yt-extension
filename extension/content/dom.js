/**
 * DOM Manipulation and Overlay Manager
 * Handles non-destructive card blurring and session-based reveal button overlays
 */

(function () {
  window.YTStudyFilter = window.YTStudyFilter || {};

  class DOMManager {
    constructor() {
      this.config = window.YTStudyFilter.CONFIG;
      // Tracks videos revealed by the user during this session
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
          // In relaxed mode, only blur with strong confidence
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
     */
    applyFilter(cardElement, videoId, classificationData, settings) {
      if (!cardElement || !videoId) return;

      // Mark element as processed by the study filter
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
        this.blurCard(cardElement, videoId, settings);
      } else {
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
        // If reveal overlay is disabled in settings, just blur
        const existingOverlay = cardElement.querySelector(`.${this.config.CLASSES.OVERLAY}`);
        if (existingOverlay) existingOverlay.remove();
        return;
      }

      // Find suitable container for overlay (thumbnail container preferred to keep video layout)
      const thumbContainer = window.YTStudyFilter.youtube.findThumbnailContainer(cardElement) || cardElement;

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

      // Click listener with event stop to prevent navigating to YouTube video
      showBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Mark as revealed for session
        this.revealedSessionIds.add(videoId);

        // Remove blur and hide overlay
        this.removeBlur(cardElement);

        // Record statistic in cache manager
        if (window.YTStudyFilter.cache) {
          window.YTStudyFilter.cache.incrementStat('manuallyRevealedVideos');
        }
      });

      // Prevent entire overlay from triggering YouTube player click
      overlay.addEventListener('click', (e) => {
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
     * Unblur all processed cards currently in the DOM (e.g. when disabled via popup)
     */
    unblurAll() {
      const blurred = document.querySelectorAll(`.${this.config.CLASSES.BLURRED}`);
      blurred.forEach(card => this.removeBlur(card));
    }
  }

  window.YTStudyFilter.dom = new DOMManager();
})();
