/**
 * YouTube Study Filter - Backend Server
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import classifyRouter from './routes/classify.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Dynamic CORS configuration supporting chrome-extension origins and localhost
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '*').split(',').map(s => s.trim());

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);

    // If wildcard is allowed
    if (allowedOrigins.includes('*')) return callback(null, true);

    // Allow any Chrome Extension or explicit allowed origin
    if (origin.startsWith('chrome-extension://') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Default allow for local development
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }

    return callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing with safe size limit
app.use(express.json({ limit: '100kb' }));

// Logging middleware in development
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`[${req.method}] ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
    });
    next();
  });
}

// Mount API routes
app.use('/api', classifyRouter);

// Root route
app.get('/', (req, res) => {
  res.json({
    name: 'YouTube Study Filter API',
    version: '1.0.0',
    description: 'AI classification service for YouTube Study Filter Chrome Extension',
    endpoints: {
      health: 'GET /api/health',
      classify: 'POST /api/classify',
      classifyBatch: 'POST /api/classify-batch'
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Not Found: ${req.method} ${req.url}` });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[ServerError]', err);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Internal Server Error'
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`=============================================`);
  console.log(`🚀 YouTube Study Filter Server running!`);
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`🔑 Gemini Configured: ${Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here')}`);
  console.log(`🤖 Model: ${process.env.GEMINI_MODEL || 'gemini-2.5-flash'}`);
  console.log(`=============================================`);
});

// Graceful shutdown
function handleShutdown(signal) {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

export default app;
