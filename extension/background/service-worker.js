/**
 * YouTube Study Filter - Background Service Worker
 * Pure client-side direct calls to Google Gemini API (BYOK - Bring Your Own Key)
 */

console.log('[YT Study Filter:SW] 🚀 Background Service Worker initialized');

const SYSTEM_INSTRUCTION = `You are a binary filter for YouTube study mode.
Determine if each video title is EDUCATIONAL (true) or NON-EDUCATIONAL (false).
Only judge based on the video title text.

isEducational: true -> Learning, coding, science, mathematics, engineering, tutorials, lectures, academics, courses, exam preparation, skills.
isEducational: false -> Entertainment, gaming, vlogs, memes, comedy, music, reactions, sports highlights, drama, pranks, clickbait.

Return strict JSON only. No explanations.`;

const DIRECT_FALLBACK_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash'
];

/**
 * Call Google Gemini API directly using user's API Key
 */
async function callDirectGemini(prompt, apiKey, preferredModel = 'gemini-2.5-flash') {
  const modelsToTry = [
    preferredModel,
    ...DIRECT_FALLBACK_MODELS.filter(m => m !== preferredModel)
  ];

  let lastError = null;

  for (const model of modelsToTry) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const requestBody = {
      contents: [{ parts: [{ text: prompt }] }],
      systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.0,
        maxOutputTokens: 512
      }
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        if (response.status === 404) {
          lastError = new Error(`Model ${model} returned 404`);
          continue;
        }
        throw new Error(`Gemini API HTTP ${response.status}: ${errorText || response.statusText}`);
      }

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) throw new Error('Empty response from Gemini API');

      // Clean possible code blocks
      const cleanJson = rawText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
      return { data: JSON.parse(cleanJson), modelUsed: model };
    } catch (err) {
      lastError = err;
      if (err.message && err.message.includes('404')) continue;
      throw err;
    }
  }

  throw lastError || new Error('All Gemini models failed');
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.action) return false;

  const {
    action,
    geminiApiKey = '',
    geminiModel = 'gemini-2.5-flash'
  } = message;

  // 1. Direct Gemini API Key Validation Test
  if (action === 'CHECK_GEMINI_KEY') {
    (async () => {
      try {
        const cleanKey = (geminiApiKey || '').trim();
        if (!cleanKey) {
          sendResponse({ success: false, error: 'Please enter an API key.' });
          return;
        }

        const prompt = `Classify this video title:
Video ID: "test"
Title: "Introduction to Python Programming Tutorial"

Return JSON:
{
  "videoId": "test",
  "isEducational": true
}`;
        const { modelUsed } = await callDirectGemini(prompt, cleanKey, geminiModel);
        sendResponse({ success: true, model: modelUsed });
      } catch (err) {
        console.warn('[YT Study Filter:SW] ❌ Key check failed:', err.message);
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  // 2. Batch Classification
  if (action === 'CLASSIFY_BATCH') {
    (async () => {
      try {
        const videos = message.videos || [];
        if (videos.length === 0) {
          sendResponse({ success: true, results: [] });
          return;
        }

        const cleanKey = (geminiApiKey || '').trim();
        if (!cleanKey) {
          sendResponse({ success: false, error: 'Direct Gemini API key not configured' });
          return;
        }

        console.log(`[YT Study Filter:SW] ⚡ Calling Gemini API directly for ${videos.length} titles...`);
        const prompt = `Classify whether each video title is educational (true) or non-educational (false):
${JSON.stringify(videos, null, 2)}

Return strict JSON:
{
  "results": [
    {
      "videoId": "string",
      "isEducational": true or false
    }
  ]
}`;
        const { data } = await callDirectGemini(prompt, cleanKey, geminiModel);
        const results = Array.isArray(data.results) ? data.results : [];
        console.log(`[YT Study Filter:SW] ✅ Direct Gemini returned ${results.length} classifications`);
        sendResponse({ success: true, results });
      } catch (err) {
        console.error('[YT Study Filter:SW] ❌ Batch classification failed:', err.message);
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  // 3. Single Classification
  if (action === 'CLASSIFY_SINGLE') {
    (async () => {
      try {
        const { videoId, title } = message;
        const cleanKey = (geminiApiKey || '').trim();
        if (!cleanKey) {
          sendResponse({ success: false, error: 'Direct Gemini API key not configured' });
          return;
        }

        const prompt = `Classify this video title:
Video ID: "${videoId}"
Title: "${title}"

Return JSON:
{
  "videoId": "${videoId}",
  "isEducational": true or false
}`;
        const { data } = await callDirectGemini(prompt, cleanKey, geminiModel);
        sendResponse({
          success: true,
          data: {
            videoId,
            isEducational: data.isEducational === true
          }
        });
      } catch (err) {
        console.error('[YT Study Filter:SW] ❌ Single classification failed:', err.message);
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  return false;
});
