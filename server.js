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

// Cost limits (internal monitoring) - DISABLED for now, ready to enable later
const COST_LIMITS_ENABLED = process.env.COST_LIMITS_ENABLED === 'true'; // Set to 'true' to enable
const MAX_COST_PER_REQUEST = parseFloat(process.env.MAX_COST_PER_REQUEST) || 0.50; // $0.50 max per request
const MAX_COST_PER_USER_PER_DAY = parseFloat(process.env.MAX_COST_PER_USER_PER_DAY) || 10.00; // $10/day per user
const MAX_COST_TOTAL_PER_DAY = parseFloat(process.env.MAX_COST_TOTAL_PER_DAY) || 100.00; // $100/day total

// In-memory cost tracking (reset on server restart)
// For production, consider storing in DynamoDB or Redis
const costTracking = {
  dailyTotal: 0,
  userDaily: {}, // { userId: { date: 'YYYY-MM-DD', cost: 0.00 } }
  lastResetDate: new Date().toISOString().split('T')[0]
};

// Export cost tracking for routes to use
global.costTracking = costTracking;

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

/**
 * GET /admin - Admin dashboard page
 */
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

/**
 * Middleware to check if user is admin (checks email from token)
 * ONLY allows access if user's email is in ADMIN_EMAILS env variable
 */
function isAdmin(req, res, next) {
  // Get admin emails from environment (comma-separated list)
  const adminEmailsStr = process.env.ADMIN_EMAILS || '';
  const adminEmails = adminEmailsStr
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(e => e.length > 0); // Remove empty strings
  
  // If no admin emails configured, deny all access
  if (adminEmails.length === 0) {
    console.error('🚫 Admin access DENIED: ADMIN_EMAILS not configured in .env');
    return res.status(403).json({ error: 'Admin access not configured. Contact administrator.' });
  }
  
  // Try to get email from Authorization header (Bearer token)
  const authHeader = req.headers.authorization;
  let userEmail = null;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      userEmail = payload.email?.toLowerCase();
    } catch (e) {
      console.warn('⚠️ Failed to parse token for admin check:', e.message);
    }
  }
  
  // Check if user email is in admin list
  if (!userEmail) {
    console.warn('🚫 Admin access DENIED: No user email found in token');
    return res.status(403).json({ error: 'Admin access required. Authentication token missing or invalid.' });
  }
  
  if (!adminEmails.includes(userEmail)) {
    console.warn(`🚫 Admin access DENIED: ${userEmail} is not in admin list`);
    return res.status(403).json({ error: 'Admin access required. Your email is not authorized.' });
  }
  
  // User is authorized
  console.log(`✅ Admin access granted: ${userEmail}`);
  return next();
}

/**
 * GET /api/admin/costs (internal monitoring - protected)
 * Returns daily cost totals and per-user costs
 */
app.get('/api/admin/costs', isAdmin, (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  resetDailyCostsIfNeeded();
  
  res.json({
    date: today,
    totalDailyCost: costTracking.dailyTotal.toFixed(4),
    limits: {
      maxPerRequest: MAX_COST_PER_REQUEST,
      maxPerUserPerDay: MAX_COST_PER_USER_PER_DAY,
      maxTotalPerDay: MAX_COST_TOTAL_PER_DAY
    },
    userCosts: Object.entries(costTracking.userDaily).map(([key, value]) => ({
      userId: key.split('_')[0],
      date: value.date,
      cost: value.cost.toFixed(4)
    })),
    percentageOfLimit: ((costTracking.dailyTotal / MAX_COST_TOTAL_PER_DAY) * 100).toFixed(2)
  });
});

/**
 * GET /api/admin/users (protected)
 * Returns detailed stats per user from DynamoDB
 */
app.get('/api/admin/users', isAdmin, async (req, res) => {
  try {
    const { docClient, TABLE_NAME } = await import('./db/dynamoClient.js');
    const { ScanCommand } = await import('@aws-sdk/lib-dynamodb');
    
    // Get time range (default: last 30 days)
    const days = parseInt(req.query.days) || 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const userStats = {};
    
    try {
      let lastEvaluatedKey = null;
      let allItems = [];
      
      // Paginate through all items
      do {
        const params = {
          TableName: TABLE_NAME,
          ...(lastEvaluatedKey && { ExclusiveStartKey: lastEvaluatedKey })
        };
        
        const result = await docClient.send(new ScanCommand(params));
        if (result.Items) {
          allItems = allItems.concat(result.Items);
        }
        lastEvaluatedKey = result.LastEvaluatedKey;
      } while (lastEvaluatedKey);
      
      // Process items
      allItems.forEach(item => {
        if (!item.user_id || !item.timestamp) return;
        
        const userId = item.user_id;
        const itemDate = new Date(item.timestamp);
        
        // Filter by date range
        if (itemDate < cutoffDate) return;
        
        if (!userStats[userId]) {
          userStats[userId] = {
            userId,
            totalCost: 0,
            totalAnalyses: 0,
            totalSessions: new Set(),
            methods: {},
            firstActivity: item.timestamp,
            lastActivity: item.timestamp,
            inputTokens: 0,
            outputTokens: 0
          };
        }
        
        const stats = userStats[userId];
        
        // Cost
        if (item.cost) {
          stats.totalCost += parseFloat(item.cost);
        } else if (item.input_tokens && item.output_tokens) {
          // Calculate cost if not stored
          const inputCost = (item.input_tokens / 1_000_000) * 3;
          const outputCost = (item.output_tokens / 1_000_000) * 15;
          stats.totalCost += inputCost + outputCost;
        }
        
        // Counts
        stats.totalAnalyses++;
        if (item.session_id) {
          stats.totalSessions.add(item.session_id);
        }
        
        // Method usage
        if (item.method) {
          stats.methods[item.method] = (stats.methods[item.method] || 0) + 1;
        }
        
        // Tokens
        if (item.input_tokens) stats.inputTokens += item.input_tokens;
        if (item.output_tokens) stats.outputTokens += item.output_tokens;
        
        // Dates
        if (new Date(item.timestamp) < new Date(stats.firstActivity)) {
          stats.firstActivity = item.timestamp;
        }
        if (new Date(item.timestamp) > new Date(stats.lastActivity)) {
          stats.lastActivity = item.timestamp;
        }
      });
      
      // Convert Sets to counts and format
      const formattedStats = Object.values(userStats).map(stats => ({
        userId: stats.userId,
        totalCost: stats.totalCost.toFixed(4),
        totalAnalyses: stats.totalAnalyses,
        totalSessions: stats.totalSessions.size,
        avgCostPerAnalysis: stats.totalAnalyses > 0 ? (stats.totalCost / stats.totalAnalyses).toFixed(4) : '0.0000',
        methods: stats.methods,
        firstActivity: stats.firstActivity,
        lastActivity: stats.lastActivity,
        inputTokens: stats.inputTokens.toLocaleString(),
        outputTokens: stats.outputTokens.toLocaleString(),
        totalTokens: (stats.inputTokens + stats.outputTokens).toLocaleString()
      }));
      
      // Sort by total cost (highest first)
      formattedStats.sort((a, b) => parseFloat(b.totalCost) - parseFloat(a.totalCost));
      
      res.json({
        period: `${days} days`,
        cutoffDate: cutoffDate.toISOString(),
        totalUsers: formattedStats.length,
        users: formattedStats
      });
    } catch (err) {
      console.error('❌ Error scanning DynamoDB:', err);
      res.status(500).json({ error: 'Failed to fetch user stats' });
    }
  } catch (err) {
    console.error('❌ Error in /api/admin/users:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

function resetDailyCostsIfNeeded() {
  const today = new Date().toISOString().split('T')[0];
  if (costTracking.lastResetDate !== today) {
    costTracking.dailyTotal = 0;
    costTracking.userDaily = {};
    costTracking.lastResetDate = today;
    console.log(`💰 Daily cost reset - new day: ${today}`);
  }
}


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
