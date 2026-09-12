/**
 * Title Classifier Module
 * Combines fast local heuristics with backend Gemini batch/single classification via background service worker
 */

(function () {
  window.YTStudyFilter = window.YTStudyFilter || {};

  class Classifier {
    constructor() {
      this.config = window.YTStudyFilter.CONFIG;

      // Obvious educational patterns
      this.educationalPatterns = [
        /\b(tutorial|course|lecture|lectures|crash\s+course)\b/i,
        /\b(calculus|algebra|geometry|physics|chemistry|biology|neuroscience)\b/i,
        /\b(data\s+structures|algorithms?|leetcode|system\s+design)\b/i,
        /\b(python|javascript|typescript|c\+\+|golang|rust|react(\.js)?|vue|angular|sql|docker|kubernetes)\s+(course|tutorial|guide|explained|full|mastery)\b/i,
        /\b(cs50|mit\s+opencourseware|stanford\s+online|khan\s+academy|freecodecamp)\b/i,
        /\b(how\s+computers\s+work|operating\s+systems?|computer\s+networking)\b/i,
        /\b(exam\s+prep|sat\s+math|ielts|toefl|mcat|gre|gmat|upsc)\b/i
      ];

      // Obvious entertainment / non-educational patterns
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
     * Fast local heuristic classification to save network roundtrips for obvious titles
     * @param {string} title
     * @returns {{ classification: 'EDUCATIONAL'|'NON_EDUCATIONAL', confidence: number, reason: string } | null}
     */
    classifyLocally(title) {
      if (!title) return null;

      for (const pattern of this.educationalPatterns) {
        if (pattern.test(title)) {
          return {
            classification: 'EDUCATIONAL',
            confidence: 0.95,
            reason: 'Local educational heuristic match'
          };
        }
      }

      for (const pattern of this.nonEducationalPatterns) {
        if (pattern.test(title)) {
          return {
            classification: 'NON_EDUCATIONAL',
            confidence: 0.95,
            reason: 'Local entertainment heuristic match'
          };
        }
      }

      return null;
    }

    /**
     * Classify a batch of videos via background service worker to prevent Mixed Content / CSP blocking
     * @param {string} backendUrl
     * @param {Array<{ videoId: string, title: string }>} videos
     * @returns {Promise<Map<string, { classification: string, confidence: number, reason: string }>>}
     */
    async classifyBatch(backendUrl, videos) {
      const results = new Map();
      if (!videos || videos.length === 0) return results;

      console.log(
        `%c[YT Study Filter:Classifier] 🚀 Sending batch of ${videos.length} videos to background proxy...`,
        'color: #8b5cf6; font-weight: bold;'
      );

      // 1. Primary: Use background service worker (bypasses Mixed Content and YouTube CSP)
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        try {
          const response = await new Promise((resolve) => {
            chrome.runtime.sendMessage({
              action: 'CLASSIFY_BATCH',
              backendUrl,
              videos
            }, (res) => {
              if (chrome.runtime.lastError) {
                console.warn('[YT Study Filter:Classifier] Chrome runtime error:', chrome.runtime.lastError.message);
                resolve(null);
              } else {
                resolve(res);
              }
            });
          });

          if (response && response.success && Array.isArray(response.results)) {
            for (const item of response.results) {
              if (item && item.videoId) {
                results.set(item.videoId, {
                  classification: item.classification || 'UNCERTAIN',
                  confidence: item.confidence || 0.5,
                  reason: item.reason || ''
                });
              }
            }
            console.log(
              `%c[YT Study Filter:Classifier] ✅ Received ${results.size} classifications via background proxy!`,
              'color: #10b981; font-weight: bold;'
            );
            return results;
          } else if (response && !response.success) {
            console.warn(`%c[YT Study Filter:Classifier] ⚠️ Background proxy error: ${response.error}`, 'color: #f59e0b;');
          }
        } catch (err) {
          console.warn('[YT Study Filter:Classifier] Message passing failed:', err.message);
        }
      }

      // 2. Fallback: Direct fetch (works if running under localhost or HTTPS)
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
                results.set(item.videoId, {
                  classification: item.classification || 'UNCERTAIN',
                  confidence: item.confidence || 0.5,
                  reason: item.reason || ''
                });
              }
            }
          }
        }
      } catch (err) {
        console.warn(`%c[YT Study Filter:Classifier] ❌ Direct fetch also failed: ${err.message}`, 'color: #ef4444;');
      }

      return results;
    }

    /**
     * Classify a single video title
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
            return response.data;
          }
        } catch (err) {
          console.warn('[YT Study Filter:Classifier] Single message passing failed:', err);
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
        if (response.ok) return await response.json();
      } catch (err) {
        console.warn('[YT Study Filter:Classifier] Direct single fetch failed:', err);
      }
      return null;
    }
  }

  window.YTStudyFilter.classifier = new Classifier();
})();
