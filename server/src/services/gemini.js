/**
 * Service to interact with the Gemini API for simple binary video classification:
 * isEducational: true (leave normal) | false (blur)
 */

import { normalizeIsEducational } from '../utils/validation.js';

const SYSTEM_INSTRUCTION = `You are a binary filter for YouTube study mode.
Determine if each video title is EDUCATIONAL (true) or NON-EDUCATIONAL (false).

isEducational: true -> Learning, coding, science, mathematics, engineering, tutorials, lectures, academics, courses, exam preparation, skills.
isEducational: false -> Entertainment, gaming, vlogs, memes, comedy, music, reactions, sports highlights, drama, pranks, clickbait.

Return strict JSON only. No explanations.`;

const FALLBACK_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash'
];

/**
 * Call Gemini API with automatic model fallback
 */
async function callGeminiApi(prompt, apiKey, preferredModel) {
  const modelsToTry = [
    preferredModel,
    ...FALLBACK_MODELS.filter(m => m !== preferredModel)
  ];

  let lastError = null;

  for (const model of modelsToTry) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const requestBody = {
      contents: [{ parts: [{ text: prompt }] }],
      systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.0,
        maxOutputTokens: 1024
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
        if (response.status === 404) {
          lastError = new Error(`HTTP 404 for model ${model}`);
          continue;
        }
        const errorText = await response.text().catch(() => '');
        throw new Error(`Gemini API HTTP ${response.status}: ${errorText || response.statusText}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('Empty response from Gemini');

      return { text, modelUsed: model };
    } catch (err) {
      lastError = err;
      if (err.name === 'TimeoutError' || err.message.includes('404')) {
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error('All candidate models failed');
}

/**
 * Fast mock heuristic if API key is not configured
 */
function mockClassifier(title) {
  const lower = title.toLowerCase();
  const eduKeywords = [
    'tutorial', 'course', 'lecture', 'learn', 'explaining', 'python',
    'javascript', 'react', 'css', 'sql', 'calculus', 'physics', 'math',
    'algebra', 'leetcode', 'cs50', 'engineering', 'exam prep', 'mit '
  ];

  for (const kw of eduKeywords) {
    if (lower.includes(kw)) return true;
  }
  return false;
}

/**
 * Classify a single video title -> isEducational: true | false
 */
export async function classifyTitle(videoId, title) {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  const model = (process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite').trim();

  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    const isEducational = mockClassifier(title);
    return { videoId, isEducational };
  }

  const prompt = `Classify this video title:
Video ID: "${videoId}"
Title: "${title}"

Return JSON:
{
  "videoId": "${videoId}",
  "isEducational": true or false
}`;

  try {
    const { text: rawJson } = await callGeminiApi(prompt, apiKey, model);
    const parsed = JSON.parse(rawJson);
    const isEducational = normalizeIsEducational(parsed.isEducational);

    console.log(`[Gemini] [${videoId}] "${title}" -> isEducational: ${isEducational} ${isEducational ? '🎓 KEEP' : '🔒 BLUR'}`);
    return { videoId, isEducational };
  } catch (err) {
    console.error(`[Gemini] Error classifying [${videoId}]:`, err.message);
    return { videoId, isEducational: mockClassifier(title) };
  }
}

/**
 * Classify a batch of video titles -> [{ videoId, isEducational }, ...]
 */
export async function classifyBatchTitles(videos) {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  const model = (process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite').trim();

  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    return videos.map(v => ({
      videoId: v.videoId,
      isEducational: mockClassifier(v.title)
    }));
  }

  const prompt = `Classify whether each video is educational (true) or non-educational (false):
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

  try {
    const { text: rawJson, modelUsed } = await callGeminiApi(prompt, apiKey, model);
    const parsed = JSON.parse(rawJson);

    const resultMap = new Map();
    if (Array.isArray(parsed.results)) {
      for (const item of parsed.results) {
        if (item && item.videoId) {
          resultMap.set(item.videoId, normalizeIsEducational(item.isEducational));
        }
      }
    }

    console.log(`[Gemini:Batch] 📤 Results (${modelUsed}):`);
    return videos.map(v => {
      const isEducational = resultMap.has(v.videoId) ? resultMap.get(v.videoId) : mockClassifier(v.title);
      console.log(`   ${isEducational ? '🎓 KEEP' : '🔒 BLUR'} [${v.videoId}] "${v.title}" -> isEducational: ${isEducational}`);
      return {
        videoId: v.videoId,
        isEducational
      };
    });
  } catch (err) {
    console.error('[Gemini:Batch] Error:', err.message);
    return videos.map(v => ({
      videoId: v.videoId,
      isEducational: mockClassifier(v.title)
    }));
  }
}
