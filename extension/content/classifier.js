/**
 * Title Classifier Module
 * Binary classification: isEducational (true = normal, false = blur)
 */

(function () {
  window.YTStudyFilter = window.YTStudyFilter || {};

  class Classifier {
    constructor() {
      this.config = window.YTStudyFilter.CONFIG;

      this.educationalPatterns = [
        /\b(tutorial|course|lecture|lectures|crash\s+course)\b/i,
        /\b(calculus|algebra|geometry|physics|chemistry|biology|neuroscience)\b/i,
        /\b(data\s+structures|algorithms?|leetcode|system\s+design)\b/i,
        /\b(python|javascript|typescript|c\+\+|golang|rust|react(\.js)?|vue|angular|sql|docker|kubernetes)\s+(course|tutorial|guide|explained|full|mastery)\b/i,
        /\b(cs50|mit\s+opencourseware|stanford\s+online|khan\s+academy|freecodecamp)\b/i,
        /\b(how\s+computers\s+work|operating\s+systems?|computer\s+networking)\b/i,
        /\b(exam\s+prep|sat\s+math|ielts|toefl|mcat|gre|gmat|upsc)\b/i
      ];

      this.nonEducationalPatterns = [
        /\b(vlog|prank|pranks|reacts?|reaction|reactions)\b/i,
        /\b(try\s+not\s+to\s+laugh|funny\s+moments|bloopers|fails\s+compilation)\b/i,
        /\b(celebrity\s+gossip|drama|spill\s+the\s+tea|red\s+carpet)\b/i,
        /\b(gameplay\s+walkthrough|fortnite\s+live|minecraft\s+smp|warzone\s+victory)\b/i,
        /\b(unboxing\s+haul|room\s+tour|what\s+i\s+eat\s+in\s+a\s+day|mukbang)\b/i,
        /\b(official\s+music\s+video|official\s+audio|lyrics\s+video|remix)\b/i,
        /\b(i\s+spent\s+24\s+hours|i\s+survived\s+\d+\s+days|extreme\s+challenge)\b/i
      ];
    }

    /**
     * Fast local heuristic match -> { isEducational: true | false } | null
     */
    classifyLocally(title) {
      if (!title) return null;

      for (const pattern of this.educationalPatterns) {
        if (pattern.test(title)) {
          return { isEducational: true };
        }
      }

      for (const pattern of this.nonEducationalPatterns) {
        if (pattern.test(title)) {
          return { isEducational: false };
        }
      }

      return null;
    }

    /**
     * Classify batch via background service worker proxy
     * @param {string} backendUrl
     * @param {Array<{ videoId: string, title: string }>} videos
     * @returns {Promise<Map<string, { isEducational: boolean }>>}
     */
    async classifyBatch(backendUrl, videos) {
      const results = new Map();
      if (!videos || videos.length === 0) return results;

      console.log(
        `%c[YT Study Filter:Classifier] 🚀 Checking ${videos.length} video(s) via backend...`,
        'color: #8b5cf6; font-weight: bold;'
      );

      // 1. Primary: Extension background service worker
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        try {
          const response = await new Promise((resolve) => {
            chrome.runtime.sendMessage({
              action: 'CLASSIFY_BATCH',
              backendUrl,
              videos
            }, (res) => {
              if (chrome.runtime.lastError) {
                resolve(null);
              } else {
                resolve(res);
              }
            });
          });

          if (response && response.success && Array.isArray(response.results)) {
            for (const item of response.results) {
              if (item && item.videoId) {
                const isEdu = item.isEducational === true;
                results.set(item.videoId, { isEducational: isEdu });
              }
            }
            return results;
          }
        } catch (err) {
          console.warn('[YT Study Filter:Classifier] Message passing failed:', err);
        }
      }

      // 2. Direct fallback
      const url = `${backendUrl.replace(/\/+$/, '')}/api/classify-batch`;
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videos }),
          signal: AbortSignal.timeout(this.config.TIMINGS.API_TIMEOUT_MS)
        });

        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data.results)) {
            for (const item of data.results) {
              if (item && item.videoId) {
                results.set(item.videoId, { isEducational: item.isEducational === true });
              }
            }
          }
        }
      } catch (err) {
        console.warn(`[YT Study Filter:Classifier] Fetch error: ${err.message}`);
      }

      return results;
    }

    /**
     * Classify single video title
     */
    async classifySingle(backendUrl, videoId, title) {
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        try {
          const response = await new Promise((resolve) => {
            chrome.runtime.sendMessage({
              action: 'CLASSIFY_SINGLE',
              backendUrl,
              videoId,
              title
            }, (res) => resolve(res));
          });

          if (response && response.success && response.data) {
            return {
              videoId,
              isEducational: response.data.isEducational === true
            };
          }
        } catch (err) {
          // ignore
        }
      }

      const url = `${backendUrl.replace(/\/+$/, '')}/api/classify`;
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoId, title }),
          signal: AbortSignal.timeout(this.config.TIMINGS.API_TIMEOUT_MS)
        });
        if (response.ok) {
          const data = await response.json();
          return { videoId, isEducational: data.isEducational === true };
        }
      } catch (err) {
        // ignore
      }
      return null;
    }
  }

  window.YTStudyFilter.classifier = new Classifier();
})();
