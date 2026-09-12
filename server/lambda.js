/**
 * AWS Lambda Handler for YouTube Study Filter
 * Zero-dependency native Lambda handler compatible with:
 * - AWS Lambda Function URLs
 * - Amazon API Gateway HTTP API (Payload v2)
 * - Amazon API Gateway REST API (Payload v1)
 */

import { classifyTitle, classifyBatchTitles } from './src/services/gemini.js';
import { validateClassifyRequest, validateBatchClassifyRequest } from './src/utils/validation.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Content-Type': 'application/json'
};

export const handler = async (event) => {
  // Handle HTTP method across API Gateway v1, v2, and Function URLs
  const method = (
    event.requestContext?.http?.method ||
    event.httpMethod ||
    'GET'
  ).toUpperCase();

  const path = (
    event.requestContext?.http?.path ||
    event.rawPath ||
    event.path ||
    '/'
  );

  // Handle CORS preflight OPTIONS request
  if (method === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: ''
    };
  }

  // Parse JSON body safely
  let body = {};
  if (event.body) {
    try {
      const raw = event.isBase64Encoded
        ? Buffer.from(event.body, 'base64').toString('utf8')
        : event.body;
      body = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (err) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Invalid JSON payload' })
      };
    }
  }

  try {
    // Health Check
    if (path.endsWith('/api/health') || path === '/health') {
      const hasKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here');
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          status: 'ok',
          platform: 'aws-lambda',
          geminiConfigured: hasKey,
          model: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
          timestamp: new Date().toISOString()
        })
      };
    }

    // Single Classify
    if (path.endsWith('/api/classify') && method === 'POST') {
      const { valid, error, sanitized } = validateClassifyRequest(body);
      if (!valid) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({ error })
        };
      }
      const result = await classifyTitle(sanitized.videoId, sanitized.title);
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify(result)
      };
    }

    // Batch Classify
    if (path.endsWith('/api/classify-batch') && method === 'POST') {
      const { valid, error, sanitized } = validateBatchClassifyRequest(body);
      if (!valid) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({ error })
        };
      }
      const results = await classifyBatchTitles(sanitized);
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ results })
      };
    }

    // 404
    return {
      statusCode: 404,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: `Not Found: ${method} ${path}` })
    };
  } catch (err) {
    console.error('[LambdaError]', err);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: err.message || 'Internal Server Error' })
    };
  }
};
