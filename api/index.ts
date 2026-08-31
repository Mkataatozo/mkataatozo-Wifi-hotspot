import express from 'express';
import dotenv from 'dotenv';
import { apiRouter } from '../server/routes/api.js';

dotenv.config();

const app = express();

// Middleware
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Mount API router for both direct /api/* routing and rewritten /* paths on Vercel
app.use('/api', apiRouter);
app.use('/', apiRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

export default app;
