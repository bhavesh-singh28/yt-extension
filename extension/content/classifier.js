/**
 * Title Classifier Module
 * Binary classification: isEducational (true = normal, false = blur)
 * Supports:
 * - Chrome Built-in AI (Prompt API / Gemini Nano) on-device
 * - Direct Google Gemini API (BYOK) via Background Service Worker
 * - Custom Cloud Backend API (Lambda / Cloudflare / Localhost)
 * - Fast local regex heuristic for immediate instant matches
 */

(function () {
  window.YTStudyFilter = window.YTStudyFilter || {};

  class Classifier {
    constructor() {
      this.config = window.YTStudyFilter.CONFIG;
      this.nanoSession = null;
      this.nanoStatus = 'untested'; // 'ready' | 'downloading' | 'unavailable' | 'untested'

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
     * Fast local heuristic match based purely on video title
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
     * Initialize or retrieve Chrome's Built-in Gemini Nano session
     */
    async getOrInitNanoSession() {
      if (this.nanoSession) return this.nanoSession;

      const aiObj = window.ai || globalThis.ai;
      if (!aiObj || !aiObj.languageModel) {
        this.nanoStatus = 'unavailable';
        return null;
      }

      try {
        let availableState = 'no';
        if (typeof aiObj.languageModel.capabilities === 'function') {
          const caps = await aiObj.languageModel.capabilities();
          availableState = caps.available;
        } else if (typeof aiObj.languageModel.availability === 'function') {
          availableState = await aiObj.languageModel.availability();
        }

        if (availableState !== 'readily') {
          console.log(`[YT Study Filter:Nano] Gemini Nano status: ${availableState}`);
          this.nanoStatus = availableState === 'after-download' ? 'downloading' : 'unavailable';
          return null;
        }

        this.nanoSession = await aiObj.languageModel.create({
          systemPrompt: `You are a binary filter for YouTube study mode.
Determine whether each video title is EDUCATIONAL (true) or NON-EDUCATIONAL (false).
Only judge based on the video title text.
isEducational: true -> Learning, programming, science, mathematics, tutorials, lectures, academics, courses, study skills.
isEducational: false -> Entertainment, gaming, vlogs, comedy, music, reactions, celebrity gossip, drama, clickbait.
Return ONLY valid JSON: {"isEducational": true} or {"isEducational": false}. No explanations.`
        });

        this.nanoStatus = 'ready';
        console.log('%c[YT Study Filter:Nano] 🧠 Local Gemini Nano session initialized!', 'color: #10b981; font-weight: bold;');
        return this.nanoSession;
      } catch (err) {
        console.warn('[YT Study Filter:Nano] Session initialization failed:', err);
        this.nanoStatus = 'unavailable';
        this.nanoSession = null;
        return null;
      }
    }

    /**
     * Classify a single title using Chrome's on-device Gemini Nano
     */
    async classifyWithNano(title) {
      const session = await this.getOrInitNanoSession();
      if (!session) return null;

      try {
        const prompt = `Title: "${title}"\nJSON:`;
        const raw = await session.prompt(prompt);
        const clean = raw.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
        const parsed = JSON.parse(clean);
        if (typeof parsed.isEducational === 'boolean') {
          return parsed.isEducational;
        }
      } catch (err) {
        console.warn(`[YT Study Filter:Nano] Failed to classify "${title}":`, err.message);
      }
      return null;
    }

    /**
     * Classify a batch of video titles based on user settings
     * @param {Object|string} settingsOrUrl
     * @param {Array<{ videoId: string, title: string }>} videos
     * @returns {Promise<Map<string, { isEducational: boolean }>>}
     */
    async classifyBatch(settingsOrUrl, videos) {
      const results = new Map();
      if (!videos || videos.length === 0) return results;

      // Normalize settings
      const settings = typeof settingsOrUrl === 'object' && settingsOrUrl !== null
        ? settingsOrUrl
        : {
            aiEngine: 'nano',
            geminiApiKey: '',
            geminiModel: 'gemini-2.5-flash'
          };

      const aiEngine = settings.aiEngine || 'nano';

      console.log(
        `%c[YT Study Filter:Classifier] 🚀 Processing ${videos.length} title(s) via engine: [${aiEngine}]`,
        'color: #8b5cf6; font-weight: bold;'
      );

      // --- ENGINE 1: CHROME BUILT-IN AI (GEMINI NANO) ---
      if (aiEngine === 'nano') {
        const remainingVideos = [];

        for (const item of videos) {
          const isEdu = await this.classifyWithNano(item.title);
          if (isEdu !== null) {
            results.set(item.videoId, { isEducational: isEdu });
            console.log(
              `%c[YT Study Filter:Nano] 🧠 [${item.videoId}] "${item.title}" -> ${isEdu ? '🎓 EDUCATIONAL' : '🔒 BLUR'}`,
              isEdu ? 'color: #10b981;' : 'color: #f43f5e;'
            );
          } else {
            remainingVideos.push(item);
          }
        }

        // If all resolved with Nano, return immediately
        if (remainingVideos.length === 0) {
          return results;
        }

        // If Nano is unavailable, check if user provided a Direct Gemini Key to fall back on
        if (!settings.geminiApiKey) {
          return results;
        }

        console.log(`[YT Study Filter:Classifier] ${remainingVideos.length} title(s) falling back from Nano to Direct Gemini API...`);
        videos = remainingVideos;
      }

      // --- ENGINE 2: DIRECT GEMINI API (SERVICE WORKER) ---
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage && settings.geminiApiKey) {
        try {
          const response = await new Promise((resolve) => {
            chrome.runtime.sendMessage({
              action: 'CLASSIFY_BATCH',
              geminiApiKey: settings.geminiApiKey.trim(),
              geminiModel: settings.geminiModel || 'gemini-2.5-flash',
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
                results.set(item.videoId, { isEducational: item.isEducational === true });
              }
            }
            return results;
          }
        } catch (err) {
          console.warn('[YT Study Filter:Classifier] Direct Gemini SW message failed:', err);
        }
      }

      return results;
    }
  }

  window.YTStudyFilter.classifier = new Classifier();
})();
