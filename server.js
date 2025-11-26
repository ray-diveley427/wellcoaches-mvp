// server.js - Multi-Perspective AI Server
import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import historyRoutes from './routes/history.js';
import analyzeRoutes from './routes/analyze.js';
import subscriptionRoutes from './routes/subscription.js';
import { TABLE_NAME } from './db/dynamoClient.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration
// Note: Context window limits are enforced in routes/analyze.js
// - MAX_CONTEXT_EXCHANGES = 10 (20 messages total) per conversation
// - History TTL = 30 days (auto-deletion from DynamoDB)
// - History display limit = 50 most recent items
const DEFAULT_USER_ID = 'user-1'; // TODO: Replace with auth-based user ID

// Cost limits (internal monitoring) - DISABLED for now, ready to enable later
const COST_LIMITS_ENABLED = process.env.COST_LIMITS_ENABLED === 'true'; // Set to 'true' to enable
const MAX_COST_PER_REQUEST = parseFloat(process.env.MAX_COST_PER_REQUEST) || 0.50; // $0.50 max per request
const MAX_COST_PER_USER_PER_DAY = parseFloat(process.env.MAX_COST_PER_USER_PER_DAY) || 10.00; // $10/day per user
const MAX_COST_TOTAL_PER_DAY = parseFloat(process.env.MAX_COST_TOTAL_PER_DAY) || 100.00; // $100/day total
const DEFAULT_MONTHLY_LIMIT_PER_USER = parseFloat(process.env.DEFAULT_MONTHLY_LIMIT_PER_USER) || 5.00; // $5/month per user (default)

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

// CORS configuration based on environment
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // Allowed origins for production/staging
  const allowedOrigins = [
    'http://localhost:3000',
    'https://multi-perspective.dev.wellcoachesschool.com',
    'https://multi-perspective.ai'
  ];
  
  // For development (localhost), allow all origins for flexibility
  // For production/staging, only allow specific origins
  if (process.env.NODE_ENV === 'production') {
    if (origin && allowedOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
    }
  } else {
    // Development: allow all origins
    res.header('Access-Control-Allow-Origin', origin || '*');
  }
  
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

// ==================================================================
// HIPAA Security Headers Middleware
// ==================================================================
app.use((req, res, next) => {
  // Strict-Transport-Security: Force HTTPS
  res.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

  // Content-Security-Policy: Prevent XSS attacks
  res.header('Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://cognito-idp.us-east-1.amazonaws.com; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "img-src 'self' data: https:; " +
    "connect-src 'self' https://cognito-idp.us-east-1.amazonaws.com https://*.auth.us-east-1.amazoncognito.com;"
  );

  // X-Content-Type-Options: Prevent MIME sniffing
  res.header('X-Content-Type-Options', 'nosniff');

  // X-Frame-Options: Prevent clickjacking
  res.header('X-Frame-Options', 'DENY');

  // X-XSS-Protection: Enable browser XSS protection
  res.header('X-XSS-Protection', '1; mode=block');

  // Referrer-Policy: Control referrer information
  res.header('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions-Policy: Restrict browser features
  res.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  next();
});

// Mount refactored history routes
app.use('/api/history', historyRoutes);
app.use('/api/analyze', analyzeRoutes);
app.use('/api/subscription', subscriptionRoutes);

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
  
  // User is authorized (logged only in development)
  if (process.env.NODE_ENV !== 'production') {
    console.log(`✅ Admin access granted: ${userEmail}`);
  }
  return next();
}

// Helper functions for monthly cost tracking (duplicated from routes/analyze.js for admin use)
function getCurrentMonth() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

async function getUserMonthlyCost(userId) {
  const { docClient, TABLE_NAME } = await import('./db/dynamoClient.js');
  const { GetCommand } = await import('@aws-sdk/lib-dynamodb');
  const currentMonth = getCurrentMonth();
  
  try {
    const result = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `USER#${userId}`,
        SK: `MONTHLY_COST#${currentMonth}`
      }
    }));
    
    if (result.Item && result.Item.cost !== undefined) {
      return parseFloat(result.Item.cost);
    }
  } catch (err) {
    // If no monthly cost record exists, user hasn't spent anything this month
  }
  
  return 0;
}

async function getUserMonthlyLimit(userId) {
  const { docClient, TABLE_NAME } = await import('./db/dynamoClient.js');
  const { GetCommand } = await import('@aws-sdk/lib-dynamodb');
  
  try {
    const result = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `USER#${userId}`,
        SK: `MONTHLY_LIMIT`
      }
    }));
    
    if (result.Item && result.Item.monthly_limit !== undefined) {
      return parseFloat(result.Item.monthly_limit);
    }
  } catch (err) {
    // If user limit doesn't exist, that's fine - use default
  }
  
  return DEFAULT_MONTHLY_LIMIT_PER_USER;
}

/**
 * GET /api/admin/costs (internal monitoring - protected)
 * Returns daily cost totals and per-user costs with email addresses and monthly usage
 */
app.get('/api/admin/costs', isAdmin, async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  resetDailyCostsIfNeeded();
  
  // Get user costs from in-memory tracking
  const userCostsRaw = Object.entries(costTracking.userDaily).map(([key, value]) => ({
    userId: key.split('_')[0],
    date: value.date,
    cost: value.cost.toFixed(4)
  }));
  
  // Look up email addresses and monthly costs from DynamoDB for each user
  const { docClient, TABLE_NAME } = await import('./db/dynamoClient.js');
  const { QueryCommand } = await import('@aws-sdk/lib-dynamodb');
  
  const userCostsWithEmail = await Promise.all(userCostsRaw.map(async (userCost) => {
    let email = null;
    let monthlyCost = 0;
    let monthlyLimit = DEFAULT_MONTHLY_LIMIT_PER_USER;
    
    try {
      // Query DynamoDB to get the most recent item for this user to find their email
      const result = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `USER#${userCost.userId}`
        },
        Limit: 1,
        ScanIndexForward: false // Get most recent first
      }));
      
      if (result.Items && result.Items.length > 0 && result.Items[0].user_email) {
        email = result.Items[0].user_email;
      }
      
      // Get monthly cost and limit
      monthlyCost = await getUserMonthlyCost(userCost.userId);
      monthlyLimit = await getUserMonthlyLimit(userCost.userId);
    } catch (err) {
      console.warn(`⚠️ Failed to lookup data for user ${userCost.userId}:`, err.message);
    }
    
    return {
      ...userCost,
      email: email || 'N/A',
      monthlyCost: monthlyCost.toFixed(4),
      monthlyLimit: monthlyLimit.toFixed(2),
      monthlyRemaining: Math.max(0, monthlyLimit - monthlyCost).toFixed(2)
    };
  }));
  
  res.json({
    date: today,
    totalDailyCost: costTracking.dailyTotal.toFixed(4),
    limits: {
      maxPerRequest: MAX_COST_PER_REQUEST,
      maxPerUserPerDay: MAX_COST_PER_USER_PER_DAY,
      maxTotalPerDay: MAX_COST_TOTAL_PER_DAY,
      defaultMonthlyPerUser: DEFAULT_MONTHLY_LIMIT_PER_USER
    },
    userCosts: userCostsWithEmail,
    percentageOfLimit: ((costTracking.dailyTotal / MAX_COST_TOTAL_PER_DAY) * 100).toFixed(2)
  });
});

/**
 * PUT /api/admin/users/:userId/monthly-limit (protected)
 * Set a custom monthly limit for a specific user
 */
app.put('/api/admin/users/:userId/monthly-limit', isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { monthlyLimit, subscriptionTier } = req.body;
    
    if (!monthlyLimit || isNaN(parseFloat(monthlyLimit)) || parseFloat(monthlyLimit) < 0) {
      return res.status(400).json({ error: 'Invalid monthly limit. Must be a positive number.' });
    }
    
    const { docClient, TABLE_NAME } = await import('./db/dynamoClient.js');
    const { PutCommand } = await import('@aws-sdk/lib-dynamodb');
    
    const item = {
      PK: `USER#${userId}`,
      SK: `MONTHLY_LIMIT`,
      user_id: userId,
      monthly_limit: parseFloat(monthlyLimit),
      updated_at: new Date().toISOString()
    };
    
    // Include subscription tier if provided (for future billing integration)
    if (subscriptionTier) {
      item.subscription_tier = subscriptionTier;
    }
    
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: item
    }));
    
    res.json({ 
      success: true, 
      userId, 
      monthlyLimit: parseFloat(monthlyLimit),
      subscriptionTier: subscriptionTier || null,
      message: `Monthly limit set to $${parseFloat(monthlyLimit).toFixed(2)} for user ${userId}${subscriptionTier ? ` (${subscriptionTier} tier)` : ''}`
    });
  } catch (err) {
    console.error('❌ Error setting monthly limit:', err);
    res.status(500).json({ error: 'Failed to set monthly limit' });
  }
});

/**
 * DELETE /api/admin/users/:userId/monthly-limit (protected)
 * Remove custom monthly limit for a user (revert to default)
 */
app.delete('/api/admin/users/:userId/monthly-limit', isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { docClient, TABLE_NAME } = await import('./db/dynamoClient.js');
    const { DeleteCommand } = await import('@aws-sdk/lib-dynamodb');
    
    await docClient.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `USER#${userId}`,
        SK: `MONTHLY_LIMIT`
      }
    }));
    
    res.json({ 
      success: true, 
      userId, 
      message: `Custom monthly limit removed for user ${userId}. Using default: $${DEFAULT_MONTHLY_LIMIT_PER_USER.toFixed(2)}`
    });
  } catch (err) {
    console.error('❌ Error removing monthly limit:', err);
    res.status(500).json({ error: 'Failed to remove monthly limit' });
  }
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
            email: null, // Will be set from first item with email
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
        
        // Set email if available and not already set
        if (item.user_email && !userStats[userId].email) {
          userStats[userId].email = item.user_email;
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
      
      // Convert Sets to counts and format, and add monthly costs
      // Also look up emails separately to ensure we get them even if user's activity is outside date range
      const formattedStats = await Promise.all(Object.values(userStats).map(async (stats) => {
        let email = stats.email; // Use email from date-filtered items if available

        // If email not found in date range, look it up separately from most recent item
        if (!email) {
          try {
            // Query to get all items for this user, then find one with email
            const emailResult = await docClient.send(new QueryCommand({
              TableName: TABLE_NAME,
              KeyConditionExpression: 'PK = :pk',
              ExpressionAttributeValues: {
                ':pk': `USER#${stats.userId}`
              },
              ScanIndexForward: false, // Get most recent first
              Limit: 50 // Get up to 50 items to find one with email
            }));

            // Find the first item that has an email (most recent first)
            if (emailResult.Items && emailResult.Items.length > 0) {
              const itemWithEmail = emailResult.Items.find(item => item.user_email);
              if (itemWithEmail && itemWithEmail.user_email) {
                email = itemWithEmail.user_email;
                console.log(`✅ Found email for user ${stats.userId}: ${email}`);
              } else {
                console.log(`⚠️ No email found in any items for user ${stats.userId} (checked ${emailResult.Items.length} items)`);
              }
            }
          } catch (err) {
            // If lookup fails, email stays null (will show as N/A)
            console.warn(`⚠️ Failed to lookup email for user ${stats.userId}:`, err.message);
          }
        } else {
          console.log(`✅ Email found from date-filtered items for user ${stats.userId}: ${email}`);
        }

        const monthlyCost = await getUserMonthlyCost(stats.userId);
        const monthlyLimit = await getUserMonthlyLimit(stats.userId);

        // Get Keap subscription tier info
        let subscriptionTier = 'free'; // Default to free
        let keapTags = [];
        if (email && email !== 'N/A') {
          try {
            const { getUserSubscriptionTier, findContactByEmail } = await import('./utils/keapIntegration.js');
            const tier = await getUserSubscriptionTier(email);
            if (tier) {
              subscriptionTier = tier;
              console.log(`✅ Keap tier for ${email}: ${tier}`);
            } else {
              console.log(`ℹ️ No Keap tier found for ${email}, using free`);
            }

            // Also get the contact's tags for detailed info
            const contact = await findContactByEmail(email);
            if (contact && contact.tag_ids) {
              keapTags = contact.tag_ids;
              console.log(`✅ Keap tags for ${email}: ${keapTags.join(', ')}`);
            }
          } catch (err) {
            console.warn(`⚠️ Failed to get Keap info for ${email}:`, err.message);
          }
        }

        return {
          userId: stats.userId,
          email: email || 'N/A',
          subscriptionTier: subscriptionTier,
          keapTags: keapTags,
          totalCost: stats.totalCost.toFixed(4),
          monthlyCost: monthlyCost.toFixed(4),
          monthlyLimit: monthlyLimit.toFixed(2),
          monthlyRemaining: Math.max(0, monthlyLimit - monthlyCost).toFixed(2),
          monthlyUsagePercent: monthlyLimit > 0 ? ((monthlyCost / monthlyLimit) * 100).toFixed(1) : '0.0',
          totalAnalyses: stats.totalAnalyses,
          totalSessions: stats.totalSessions.size,
          avgCostPerAnalysis: stats.totalAnalyses > 0 ? (stats.totalCost / stats.totalAnalyses).toFixed(4) : '0.0000',
          methods: stats.methods,
          firstActivity: stats.firstActivity,
          lastActivity: stats.lastActivity,
          inputTokens: stats.inputTokens.toLocaleString(),
          outputTokens: stats.outputTokens.toLocaleString(),
          totalTokens: (stats.inputTokens + stats.outputTokens).toLocaleString()
        };
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
    // Daily reset (silent in production)
  }
}


// Only start listening if not running under iisnode (IIS)
// iisnode manages the HTTP server automatically
if (!process.env.IISNODE_VERSION) {
  app.listen(PORT, () => {
    console.log(`\n${'='.repeat(60)}`);
    console.log('🚀 Multi-Perspective AI Server');
    console.log(`🌐 Running at http://localhost:${PORT}`);
    console.log(`💾 DynamoDB Table: ${TABLE_NAME}`);
    console.log(`💬 Context window: 10 exchanges (20 messages)`);
    console.log(`📅 Session TTL: 30 days`);
    console.log(`${'='.repeat(60)}\n`);
  });
} else {
  // Running under iisnode - just log startup info
  console.log(`\n${'='.repeat(60)}`);
  console.log('🚀 Multi-Perspective AI Server');
  console.log('🌐 Running under IIS/iisnode');
  console.log(`💾 DynamoDB Table: ${TABLE_NAME}`);
  console.log(`💬 Context window: 10 exchanges (20 messages)`);
  console.log(`📅 Session TTL: 30 days`);
  console.log(`${'='.repeat(60)}\n`);
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Server shutting down...');
  process.exit(0);
});
