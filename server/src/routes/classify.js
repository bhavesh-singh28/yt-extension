/**
 * Express router for video classification endpoints
 */

import { Router } from 'express';
import { validateClassifyRequest, validateBatchClassifyRequest } from '../utils/validation.js';
import { classifyTitle, classifyBatchTitles } from '../services/gemini.js';

const router = Router();

/**
 * GET /api/health
 * Returns server health and configuration status
 */
router.get('/health', (req, res) => {
  const hasApiKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here');
  res.json({
    status: 'ok',
    uptime: Math.round(process.uptime()),
    geminiConfigured: hasApiKey,
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    timestamp: new Date().toISOString()
  });
});

/**
 * POST /api/classify
 * Classifies a single YouTube video title
 */
router.post('/classify', async (req, res, next) => {
  try {
    const { valid, error, sanitized } = validateClassifyRequest(req.body);

    if (!valid) {
      return res.status(400).json({ error });
    }

    const result = await classifyTitle(sanitized.videoId, sanitized.title);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/classify-batch
 * Classifies multiple YouTube video titles in a single request
 */
router.post('/classify-batch', async (req, res, next) => {
  try {
    const { valid, error, sanitized } = validateBatchClassifyRequest(req.body);

    if (!valid) {
      return res.status(400).json({ error });
    }

    const results = await classifyBatchTitles(sanitized);
    res.json({ results });
  } catch (err) {
    next(err);
  }
});

export default router;
