/**
 * Title Classifier Module
 * Combines fast local heuristics with backend Gemini batch/single classification
 */

(function () {
  window.YTStudyFilter = window.YTStudyFilter || {};

  class Classifier {
    constructor() {
      this.config = window.YTStudyFilter.CONFIG;

      // Obvious educational patterns (high confidence)
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

      // Ambiguous title - defer to Gemini API
      return null;
    }

    /**
     * Classify a batch of videos via backend Gemini API
     * @param {string} backendUrl
     * @param {Array<{ videoId: string, title: string }>} videos
     * @returns {Promise<Map<string, { classification: string, confidence: number, reason: string }>>}
     */
    async classifyBatch(backendUrl, videos) {
      const results = new Map();
      if (!videos || videos.length === 0) return results;

      const url = `${backendUrl.replace(/\/+$/, '')}/api/classify-batch`;
      console.log(`%c[YT Study Filter:Classifier] 🚀 Calling backend ${url} for ${videos.length} videos...`, 'color: #8b5cf6; font-weight: bold;');

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ videos }),
          signal: AbortSignal.timeout(this.config.TIMINGS.API_TIMEOUT_MS)
        });

        if (!response.ok) {
          const errText = await response.text().catch(() => '');
          console.warn(`%c[YT Study Filter:Classifier] ⚠️ Backend HTTP ${response.status}: ${errText}`, 'color: #f59e0b;');
          return results;
        }

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
          console.log(`%c[YT Study Filter:Classifier] ✅ Received ${results.size} classifications from backend`, 'color: #10b981; font-weight: bold;');
        }
      } catch (err) {
        console.warn(`%c[YT Study Filter:Classifier] ❌ Backend request failed: ${err.message} (Failing open)`, 'color: #ef4444;');
      }

      return results;
    }

    /**
     * Classify a single video title via backend
     */
    async classifySingle(backendUrl, videoId, title) {
      const url = `${backendUrl.replace(/\/+$/, '')}/api/classify`;

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ videoId, title }),
          signal: AbortSignal.timeout(this.config.TIMINGS.API_TIMEOUT_MS)
        });

        if (!response.ok) return null;

        const data = await response.json();
        return {
          classification: data.classification || 'UNCERTAIN',
          confidence: data.confidence || 0.5,
          reason: data.reason || ''
        };
      } catch (err) {
        console.warn('[YTStudyFilter:Classifier] Single classification failed:', err.message);
        return null;
      }
    }
  }

  window.YTStudyFilter.classifier = new Classifier();
})();
