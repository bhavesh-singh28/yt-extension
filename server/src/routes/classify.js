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
 * GET /api/logs
 * Returns classifications.txt content
 */
router.get('/logs', async (req, res) => {
  try {
    const { LOG_FILE_PATH } = await import('../utils/fileLogger.js');
    const fs = await import('node:fs/promises');
    const content = await fs.readFile(LOG_FILE_PATH, 'utf8').catch(() => 'No classifications logged yet.\n');
    res.type('text/plain').send(content);
  } catch (err) {
    res.status(500).send(`Error reading logs: ${err.message}`);
  }
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
    console.log(req.body, "----------------------------------------------------------------");
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
