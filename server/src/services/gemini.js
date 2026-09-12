/**
 * Service to interact with the Gemini API for video title classification
 */

import { normalizeClassification, normalizeConfidence } from '../utils/validation.js';

const SYSTEM_INSTRUCTION = `You are classifying YouTube videos for a distraction-free study mode.

EDUCATIONAL means the video's primary purpose is teaching, explaining, practicing, or providing useful knowledge/skills. This includes programming, computer science, mathematics, science, engineering, academics, tutorials, lectures, exam preparation, career/technical learning, language learning, and educational documentaries.

NON_EDUCATIONAL includes entertainment, gaming entertainment, celebrity content, gossip, memes, comedy, music, sports entertainment, reactions, vlogs, lifestyle content, drama, clickbait entertainment, and general time-wasting content.

Do not classify a video as educational merely because the title contains words such as 'learn', 'knowledge', 'tips', or 'how to'.

Always evaluate the realistic user intent and content nature behind the title. If completely ambiguous or impossible to determine from title alone, return UNCERTAIN.

Return strict JSON only matching the requested schema.`;

/**
 * Perform direct HTTP request to Gemini API
 * @param {string} prompt - Prompt text
 * @param {string} apiKey - Gemini API Key
 * @param {string} model - Model identifier
 * @returns {Promise<string>} Raw text output
 */
async function callGeminiApi(prompt, apiKey, model) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const requestBody = {
    contents: [
      {
        parts: [
          { text: prompt }
        ]
      }
    ],
    systemInstruction: {
      parts: [
        { text: SYSTEM_INSTRUCTION }
      ]
    },
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1,
      maxOutputTokens: 2048
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(10000) // 10s timeout
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Gemini API HTTP ${response.status}: ${errorText || response.statusText}`);
  }

  const data = await response.json();
  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('Gemini API returned an empty or missing response part');
  }

  return text;
}

/**
 * Local heuristic mock classifier used when GEMINI_API_KEY is not configured
 * Allows seamless offline development and testing
 */
function mockClassifier(title) {
  const lower = title.toLowerCase();

  const educationalKeywords = [
    'tutorial', 'course', 'lecture', 'learn ', 'explaining', 'explained',
    'python', 'javascript', 'react', 'css', 'html', 'database', 'sql',
    'calculus', 'physics', 'chemistry', 'biology', 'math', 'algebra',
    'algorithm', 'data structure', 'leetcode', 'cs50', 'engineering',
    'system design', 'machine learning', 'deep learning', 'exam prep',
    'history documentary', 'mit opencourseware'
  ];

  const nonEducationalKeywords = [
    'vlog', 'prank', 'reaction', 'challenge', 'highlights', 'gameplay',
    'gossip', 'celebrity', 'drama', 'funny moments', 'meme', 'trailer',
    'official music video', 'mv', 'tiktok', 'try not to laugh', 'shorts',
    'unboxing', 'haul', 'room tour', 'gaming', 'walkthrough'
  ];

  for (const kw of educationalKeywords) {
    if (lower.includes(kw)) {
      return { classification: 'EDUCATIONAL', confidence: 0.92, reason: `Matches educational topic: "${kw}"` };
    }
  }

  for (const kw of nonEducationalKeywords) {
    if (lower.includes(kw)) {
      return { classification: 'NON_EDUCATIONAL', confidence: 0.94, reason: `Matches entertainment category: "${kw}"` };
    }
  }

  return { classification: 'UNCERTAIN', confidence: 0.5, reason: 'Ambiguous title, treated as uncertain' };
}

/**
 * Classify a single video title
 * @param {string} videoId
 * @param {string} title
 * @returns {Promise<{ videoId: string, classification: 'EDUCATIONAL'|'NON_EDUCATIONAL'|'UNCERTAIN', confidence: number, reason?: string }>}
 */
export async function classifyTitle(videoId, title) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[GeminiService] No GEMINI_API_KEY provided. Using local mock classification.');
      const mockResult = mockClassifier(title);
      return {
        videoId,
        classification: mockResult.classification,
        confidence: mockResult.confidence,
        reason: `${mockResult.reason} (mock mode)`
      };
    }
    throw new Error('GEMINI_API_KEY is not configured in server environment');
  }

  const prompt = `Classify this YouTube video title:
Video ID: "${videoId}"
Title: "${title}"

Return JSON matching:
{
  "classification": "EDUCATIONAL" | "NON_EDUCATIONAL" | "UNCERTAIN",
  "confidence": 0.0 to 1.0,
  "reason": "short explanation"
}`;

  try {
    const rawJson = await callGeminiApi(prompt, apiKey, model);
    const parsed = JSON.parse(rawJson);

    return {
      videoId,
      classification: normalizeClassification(parsed.classification),
      confidence: normalizeConfidence(parsed.confidence),
      reason: typeof parsed.reason === 'string' ? parsed.reason.slice(0, 200) : ''
    };
  } catch (err) {
    console.error(`[GeminiService] Error classifying video "${videoId}":`, err.message);

    // Fallback gracefully without breaking
    if (process.env.NODE_ENV !== 'production') {
      const fallback = mockClassifier(title);
      return {
        videoId,
        classification: fallback.classification,
        confidence: fallback.confidence,
        reason: `Fallback on error: ${err.message}`
      };
    }

    return {
      videoId,
      classification: 'UNCERTAIN',
      confidence: 0.5,
      reason: 'Classification service temporarily unavailable'
    };
  }
}

/**
 * Classify a batch of video titles in a single Gemini API call
 * @param {Array<{ videoId: string, title: string }>} videos
 * @returns {Promise<Array<{ videoId: string, classification: string, confidence: number, reason?: string }>>}
 */
export async function classifyBatchTitles(videos) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[GeminiService] No GEMINI_API_KEY provided. Using local mock classification for batch.');
      return videos.map(v => {
        const mockResult = mockClassifier(v.title);
        return {
          videoId: v.videoId,
          classification: mockResult.classification,
          confidence: mockResult.confidence,
          reason: `${mockResult.reason} (mock mode)`
        };
      });
    }
    throw new Error('GEMINI_API_KEY is not configured in server environment');
  }

  const prompt = `Classify each of the following YouTube video titles for a distraction-free study mode:
${JSON.stringify(videos, null, 2)}

Return a strict JSON object with a "results" array matching this exact schema:
{
  "results": [
    {
      "videoId": "string matching input",
      "classification": "EDUCATIONAL" | "NON_EDUCATIONAL" | "UNCERTAIN",
      "confidence": 0.0 to 1.0,
      "reason": "short explanation"
    }
  ]
}`;

  try {
    const rawJson = await callGeminiApi(prompt, apiKey, model);
    const parsed = JSON.parse(rawJson);

    if (!Array.isArray(parsed.results)) {
      throw new Error('Gemini response missing "results" array');
    }

    const resultMap = new Map();
    for (const item of parsed.results) {
      if (item && item.videoId) {
        resultMap.set(item.videoId, {
          videoId: item.videoId,
          classification: normalizeClassification(item.classification),
          confidence: normalizeConfidence(item.confidence),
          reason: typeof item.reason === 'string' ? item.reason.slice(0, 200) : ''
        });
      }
    }

    // Ensure every requested video has an entry in output order
    return videos.map(v => {
      if (resultMap.has(v.videoId)) {
        return resultMap.get(v.videoId);
      }
      return {
        videoId: v.videoId,
        classification: 'UNCERTAIN',
        confidence: 0.5,
        reason: 'Missing from model output'
      };
    });
  } catch (err) {
    console.error('[GeminiService] Batch classification failed:', err.message);

    // Fallback to local heuristic in dev or UNCERTAIN in prod
    return videos.map(v => {
      if (process.env.NODE_ENV !== 'production') {
        const fallback = mockClassifier(v.title);
        return {
          videoId: v.videoId,
          classification: fallback.classification,
          confidence: fallback.confidence,
          reason: `Fallback batch error: ${err.message}`
        };
      }
      return {
        videoId: v.videoId,
        classification: 'UNCERTAIN',
        confidence: 0.5,
        reason: 'Service unavailable'
      };
    });
  }
}
