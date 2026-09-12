/**
 * Validation utilities for classification requests and responses
 */

export const VALID_CLASSIFICATIONS = new Set(['EDUCATIONAL', 'NON_EDUCATIONAL', 'UNCERTAIN']);

/**
 * Validates a single classification request body
 * @param {object} body - Request body
 * @returns {{ valid: boolean, error?: string, sanitized?: { videoId: string, title: string } }}
 */
export function validateClassifyRequest(body) {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object' };
  }

  const { videoId, title } = body;

  if (!videoId || typeof videoId !== 'string' || videoId.trim().length === 0) {
    return { valid: false, error: 'Field "videoId" must be a non-empty string' };
  }

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return { valid: false, error: 'Field "title" must be a non-empty string' };
  }

  // Sanitize length to prevent prompt injection / oversized requests
  const sanitizedVideoId = videoId.trim().slice(0, 64);
  const sanitizedTitle = title.trim().slice(0, 500);

  return {
    valid: true,
    sanitized: {
      videoId: sanitizedVideoId,
      title: sanitizedTitle
    }
  };
}

/**
 * Validates a batch classification request body
 * @param {object} body - Request body
 * @returns {{ valid: boolean, error?: string, sanitized?: Array<{ videoId: string, title: string }> }}
 */
export function validateBatchClassifyRequest(body) {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object' };
  }

  const { videos } = body;

  if (!Array.isArray(videos)) {
    return { valid: false, error: 'Field "videos" must be an array' };
  }

  if (videos.length === 0) {
    return { valid: false, error: 'Field "videos" array must not be empty' };
  }

  if (videos.length > 50) {
    return { valid: false, error: 'Maximum batch size is 50 videos per request' };
  }

  const sanitized = [];
  for (let i = 0; i < videos.length; i++) {
    const item = videos[i];
    if (!item || typeof item !== 'object') {
      return { valid: false, error: `Item at index ${i} is not a valid object` };
    }
    if (!item.videoId || typeof item.videoId !== 'string' || item.videoId.trim().length === 0) {
      return { valid: false, error: `Item at index ${i} is missing a valid "videoId"` };
    }
    if (!item.title || typeof item.title !== 'string' || item.title.trim().length === 0) {
      return { valid: false, error: `Item at index ${i} is missing a valid "title"` };
    }

    sanitized.push({
      videoId: item.videoId.trim().slice(0, 64),
      title: item.title.trim().slice(0, 500)
    });
  }

  return { valid: true, sanitized };
}

/**
 * Normalizes a classification value to ensure it matches allowed enums
 * @param {string} val
 * @returns {'EDUCATIONAL' | 'NON_EDUCATIONAL' | 'UNCERTAIN'}
 */
export function normalizeClassification(val) {
  if (typeof val !== 'string') return 'UNCERTAIN';
  const upper = val.toUpperCase().trim();
  if (VALID_CLASSIFICATIONS.has(upper)) {
    return upper;
  }
  return 'UNCERTAIN';
}

/**
 * Normalizes confidence score between 0.0 and 1.0
 * @param {number|any} val
 * @returns {number}
 */
export function normalizeConfidence(val) {
  const num = parseFloat(val);
  if (isNaN(num)) return 0.5;
  return Math.max(0.0, Math.min(1.0, Math.round(num * 100) / 100));
}
