// server.js - Multi-Perspective AI Server
import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import historyRoutes from './routes/history.js';
import analyzeRoutes from './routes/analyze.js';
import { TABLE_NAME } from './db/dynamoClient.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration
const MAX_HISTORY_MESSAGES = 15; // Keep last 15 exchanges (30 messages total)
const WARN_THRESHOLD = 20; // Warn user after 20 messages
const DEFAULT_USER_ID = 'user-1'; // TODO: Replace with auth-based user ID

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Allow CORS for dev
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Mount refactored history routes
app.use('/api/history', historyRoutes);
app.use('/api/analyze', analyzeRoutes);

// =====================================================================
// ROUTES
// =====================================================================

/**
 * Serve main UI
 */
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/**
 * Serve FAQ
 */
app.get('/faq', (req, res) => {
  res.sendFile(path.join(__dirname, 'moore-multiplicity-faq.html'));
});

/**
 * GET /api/health
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});


app.listen(PORT, () => {
  console.log(`\n${'='.repeat(60)}`);
  console.log('🚀 Multi-Perspective AI Server');
  console.log(`🌐 Running at http://localhost:${PORT}`);
  console.log(`💾 DynamoDB Table: ${TABLE_NAME}`);
  console.log(`💬 Max history: ${MAX_HISTORY_MESSAGES} exchanges`);
  console.log(`${'='.repeat(60)}\n`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Server shutting down...');
  process.exit(0);
});
