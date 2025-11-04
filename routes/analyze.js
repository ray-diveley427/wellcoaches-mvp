import express from 'express';
import { docClient, TABLE_NAME } from '../db/dynamoClient.js';
import { QueryCommand, PutCommand, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import {
  callMPAI,
  detectBandwidth,
  detectOutputStyle,
  detectRoleContext,
  suggestMethod
} from '../utils/claudeHandler.js';

// Import cost tracking from server (for this MVP, we'll use a shared module)
// In production, use Redis or DynamoDB for distributed tracking
let costTracking = global.costTracking || {
  dailyTotal: 0,
  userDaily: {},
  lastResetDate: new Date().toISOString().split('T')[0]
};

const router = express.Router();

// Cost limit config (from env or defaults) - DISABLED for now, ready to enable later
const COST_LIMITS_ENABLED = process.env.COST_LIMITS_ENABLED === 'true'; // Set to 'true' in .env to enable
const MAX_COST_PER_REQUEST = parseFloat(process.env.MAX_COST_PER_REQUEST) || 0.50;
const MAX_COST_PER_USER_PER_DAY = parseFloat(process.env.MAX_COST_PER_USER_PER_DAY) || 10.00;
const MAX_COST_TOTAL_PER_DAY = parseFloat(process.env.MAX_COST_TOTAL_PER_DAY) || 100.00;
// Monthly limit per user (default $5/month)
const DEFAULT_MONTHLY_LIMIT_PER_USER = parseFloat(process.env.DEFAULT_MONTHLY_LIMIT_PER_USER) || 5.00;

function resetDailyCostsIfNeeded() {
  const today = new Date().toISOString().split('T')[0];
  if (costTracking.lastResetDate !== today) {
    costTracking.dailyTotal = 0;
    costTracking.userDaily = {};
    costTracking.lastResetDate = today;
    // Daily reset happens silently (not logged unless in debug mode)
  }
}

/**
 * Get current month string (YYYY-MM)
 */
function getCurrentMonth() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Get user's monthly cost limit
 * First checks for per-user override in DynamoDB, then falls back to default
 */
async function getUserMonthlyLimit(userId) {
  try {
    // Check for per-user limit override in DynamoDB
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
    console.warn(`⚠️ Could not fetch monthly limit for ${userId}, using default:`, err.message);
  }
  
  return DEFAULT_MONTHLY_LIMIT_PER_USER;
}

/**
 * Get user's current monthly cost from DynamoDB
 */
async function getUserMonthlyCost(userId) {
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
    console.warn(`⚠️ Could not fetch monthly cost for ${userId}:`, err.message);
  }
  
  return 0;
}

/**
 * Increment user's monthly cost in DynamoDB (atomic operation)
 */
async function incrementUserMonthlyCost(userId, cost) {
  const currentMonth = getCurrentMonth();
  
  try {
    // Use atomic update to increment monthly cost
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `USER#${userId}`,
        SK: `MONTHLY_COST#${currentMonth}`
      },
      UpdateExpression: 'ADD cost :cost SET month = :month, updated_at = :updated_at',
      ExpressionAttributeValues: {
        ':cost': cost,
        ':month': currentMonth,
        ':updated_at': new Date().toISOString()
      }
    }));
  } catch (err) {
    console.error(`❌ Failed to increment monthly cost for ${userId}:`, err);
    // Don't throw - we don't want to block the request if cost tracking fails
  }
}

async function checkCostLimits(userId, estimatedCost) {
  resetDailyCostsIfNeeded();
  
  const today = new Date().toISOString().split('T')[0];
  const userKey = `${userId}_${today}`;
  
  // Get user's daily cost
  const userDailyCost = costTracking.userDaily[userKey]?.cost || 0;
  const newUserDailyCost = userDailyCost + estimatedCost;
  const newTotalDaily = costTracking.dailyTotal + estimatedCost;
  
  // Get user's monthly cost and limit
  const userMonthlyCost = await getUserMonthlyCost(userId);
  const userMonthlyLimit = await getUserMonthlyLimit(userId);
  const newUserMonthlyCost = userMonthlyCost + estimatedCost;
  
  const errors = [];
  
  // Check per-request limit
  if (estimatedCost > MAX_COST_PER_REQUEST) {
    errors.push(`Request cost ($${estimatedCost.toFixed(4)}) exceeds per-request limit ($${MAX_COST_PER_REQUEST})`);
  }
  
  // Check per-user daily limit
  if (newUserDailyCost > MAX_COST_PER_USER_PER_DAY) {
    errors.push(`User daily cost ($${newUserDailyCost.toFixed(2)}) would exceed limit ($${MAX_COST_PER_USER_PER_DAY})`);
  }
  
  // Check total daily limit
  if (newTotalDaily > MAX_COST_TOTAL_PER_DAY) {
    errors.push(`Total daily cost ($${newTotalDaily.toFixed(2)}) would exceed limit ($${MAX_COST_TOTAL_PER_DAY})`);
  }
  
  // Check per-user monthly limit
  if (newUserMonthlyCost > userMonthlyLimit) {
    errors.push(`User monthly cost ($${newUserMonthlyCost.toFixed(2)}) would exceed monthly limit ($${userMonthlyLimit.toFixed(2)})`);
  }
  
  return { 
    allowed: errors.length === 0, 
    errors,
    monthlyCost: userMonthlyCost,
    monthlyLimit: userMonthlyLimit,
    monthlyRemaining: Math.max(0, userMonthlyLimit - userMonthlyCost)
  };
}

async function recordCost(userId, cost) {
  resetDailyCostsIfNeeded();
  
  const today = new Date().toISOString().split('T')[0];
  const userKey = `${userId}_${today}`;
  
  if (!costTracking.userDaily[userKey]) {
    costTracking.userDaily[userKey] = { date: today, cost: 0 };
  }
  
  costTracking.userDaily[userKey].cost += cost;
  costTracking.dailyTotal += cost;
  
  // Also track monthly cost in DynamoDB
  await incrementUserMonthlyCost(userId, cost);
  
  // Export to global for access from server.js
  global.costTracking = costTracking;
  
  // Log high-cost requests for monitoring (only if > $0.05)
  if (cost > 0.05) {
    const monthlyCost = await getUserMonthlyCost(userId);
    const monthlyLimit = await getUserMonthlyLimit(userId);
    console.log(`💰 High-cost request: $${cost.toFixed(4)} | User: ${userId} | Daily: $${costTracking.userDaily[userKey].cost.toFixed(2)} | Monthly: $${monthlyCost.toFixed(2)}/${monthlyLimit.toFixed(2)}`);
  }
}

// Helper function to extract email from Authorization header
function getEmailFromRequest(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      
      // Try multiple possible email fields (Cognito can use different field names)
      const email = payload.email || payload['cognito:username'] || payload['cognito:email'] || null;
      
      // Debug logging
      if (!email && process.env.NODE_ENV !== 'production') {
        console.log('🔍 Token payload keys:', Object.keys(payload));
      }
      
      return email;
    } catch (e) {
      console.warn('⚠️ Failed to parse token:', e.message);
      return null;
    }
  }
  return null;
}

// POST /api/analyze
router.post('/', async (req, res) => {
  try {
    const {
      userQuery,
      method: providedMethod,
      outputStyle: providedOutputStyle,
      roleContext: providedRoleContext,
      sessionId: providedSessionId,
      userId = 'user-1'
    } = req.body;
    
    // Extract email from token if available
    const userEmail = getEmailFromRequest(req);
    
    // Log email extraction for debugging
    if (userEmail) {
      console.log(`📧 Extracted email for user ${userId}: ${userEmail}`);
    } else {
      console.log(`⚠️ No email found in token for user ${userId}`);
    }

    if (!userQuery || !userQuery.trim()) {
      return res.status(400).json({ success: false, error: 'User query is required' });
    }

    const sessionId = providedSessionId || uuidv4();
    const analysisId = uuidv4();
    
    console.log(`\n🔵 New request | Session: ${sessionId.substring(0, 8)}... | Query: "${userQuery.substring(0, 50)}..."`);

    // Load recent messages for context
    // Limit: Last 10 exchanges (20 messages) to control costs and stay within token limits
    const MAX_CONTEXT_EXCHANGES = 10;
    const MAX_CONTEXT_MESSAGES = MAX_CONTEXT_EXCHANGES * 2; // user + assistant per exchange

    let priorMessages = [];
    let contextInfo = { messageCount: 0, estimatedTokens: 0, totalMessages: 0 };
    try {
      const data = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`,
          ':sk': `SESSION#${sessionId}`,
        },
        ScanIndexForward: false, // Get most recent first
      }));

      // Get all messages and store total count
      const allMessages = (data.Items || [])
        .flatMap(i => [
          i.user_query ? { role: 'user', content: i.user_query } : null,
          i.response ? { role: 'assistant', content: i.response } : null
        ])
        .filter(Boolean);

      contextInfo.totalMessages = allMessages.length;

      // Take only the last N messages (most recent exchanges)
      priorMessages = allMessages.slice(0, MAX_CONTEXT_MESSAGES).reverse(); // Reverse to chronological order

      contextInfo.messageCount = priorMessages.length;
      if (contextInfo.messageCount > 0) {
        console.log(`📚 Loading context: ${contextInfo.messageCount} of ${contextInfo.totalMessages} messages (last ${MAX_CONTEXT_EXCHANGES} exchanges)`);
        console.log(`   First in context: ${priorMessages[0]?.content?.substring(0, 80)}...`);
        console.log(`   Last in context: ${priorMessages[priorMessages.length - 1]?.content?.substring(0, 80)}...`);
      } else {
        console.log(`📭 No prior messages found for session ${sessionId} (new session)`);
      }
    } catch (err) {
      console.warn('⚠️ Failed to load prior messages:', err);
    }

    let method = providedMethod || suggestMethod(userQuery);
    
    // Some methods require specific output styles - override auto-detection
    const methodsRequiringStructured = [
      'COACHING_PLAN', 
      'SKILLS', 
      'SYNTHESIS',
      'SIMPLE_SYNTHESIS',
      'SYNTHESIS_ALL',
      'INNER_PEACE_SYNTHESIS',
      'HUMAN_HARM_CHECK'
    ];
    const shouldForceStructured = methodsRequiringStructured.includes(method);
    
    const outputStyle = providedOutputStyle || (shouldForceStructured ? 'structured' : detectOutputStyle(userQuery));
    const roleContext = providedRoleContext || detectRoleContext(userQuery);
    const bandwidth = detectBandwidth(userQuery);
    
    if (!providedMethod) {
      console.log(`💡 Auto-selected method: ${method} (bandwidth: ${bandwidth})`);
    }

    // Estimate cost before making API call (rough estimate based on query length)
    // This is conservative - actual cost may be lower
    const estimatedInputTokens = Math.round((JSON.stringify(priorMessages).length + userQuery.length) / 4);
    const estimatedOutputTokens = 2000; // max_tokens setting
    const estimatedInputCost = (estimatedInputTokens / 1_000_000) * 3;
    const estimatedOutputCost = (estimatedOutputTokens / 1_000_000) * 15;
    const estimatedCost = estimatedInputCost + estimatedOutputCost;
    
    // Check cost limits before proceeding (only if enabled)
    if (COST_LIMITS_ENABLED) {
      const costCheck = await checkCostLimits(userId, estimatedCost);
      if (!costCheck.allowed) {
        console.error(`🚫 Request blocked due to cost limits:`, costCheck.errors);
        
        // Check if it's specifically the monthly limit
        const isMonthlyLimitExceeded = costCheck.errors.some(e => e.includes('monthly limit'));
        const errorMessage = isMonthlyLimitExceeded
          ? `Monthly spending limit exceeded. You've used $${costCheck.monthlyCost.toFixed(2)} of your $${costCheck.monthlyLimit.toFixed(2)} monthly limit. Please contact support to increase your limit.`
          : 'Request exceeds cost limits. Please try again later or contact support.';
        
        return res.status(429).json({ 
          success: false, 
          error: errorMessage,
          costLimitExceeded: true,
          monthlyLimitExceeded: isMonthlyLimitExceeded,
          monthlyCost: costCheck.monthlyCost,
          monthlyLimit: costCheck.monthlyLimit,
          monthlyRemaining: costCheck.monthlyRemaining
        });
      }
    }

    const result = await callMPAI(userQuery, method, outputStyle, roleContext, priorMessages);

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }

    // Derive helper fields
    const responseText = result.response || '';
    const preview = responseText.slice(0, 120);
    const perspectivesCount = (Array.isArray(result.perspectives) && result.perspectives.length) || result.count || 1;

    // Calculate actual cost
    const inputTokens = result.usage?.inputTokens || 0;
    const outputTokens = result.usage?.outputTokens || 0;
    contextInfo.estimatedTokens = inputTokens;
    
    // Cost calculation (Claude Sonnet 4 pricing as of 2025)
    // Input: $3 per 1M tokens, Output: $15 per 1M tokens
    const inputCost = (inputTokens / 1_000_000) * 3;
    const outputCost = (outputTokens / 1_000_000) * 15;
    const totalCost = inputCost + outputCost;
    
    // Record actual cost (both daily in-memory and monthly in DynamoDB)
    await recordCost(userId, totalCost);
    
    contextInfo.cost = {
      input: inputCost,
      output: outputCost,
      total: totalCost,
      inputTokens,
      outputTokens
    };

    // Save new exchange to DynamoDB (include snake_case and camelCase for compatibility)
    const item = {
      PK: `USER#${userId}`,
      SK: `SESSION#${sessionId}#ANALYSIS#${analysisId}`,
      user_id: userId,
      session_id: sessionId,
      analysis_id: analysisId,
      user_query: userQuery,
      response: responseText,
      // method + context
      method,
      outputStyle,
      roleContext,
      bandwidth,
      // duplicate keys for export/back-compat
      output_style: outputStyle,
      role_context: roleContext,
      // presentation helpers
      preview,
      perspectives: `${perspectivesCount} perspectives`,
      // cost tracking (for internal monitoring)
      cost: totalCost,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      // user email for admin display
      ...(userEmail && { user_email: userEmail }),
      timestamp: new Date().toISOString(),
      ttl: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
    };
    await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
    
    // Log confirmation that email was saved
    if (userEmail) {
      console.log(`✅ Saved analysis with email: ${userEmail} for user ${userId}`);
    } else {
      console.log(`⚠️ Saved analysis without email for user ${userId}`);
    }

    res.json({
      success: true,
      response: responseText,
      method,
      sessionId,
      analysisId,
      modelUsed: result.modelUsed,
      usage: result.usage,
      contextInfo: { messageCount: contextInfo.messageCount, estimatedTokens: contextInfo.estimatedTokens }, // No cost info to frontend
    });
  } catch (err) {
    console.error('❌ Error analyzing:', err);
    res.status(500).json({ success: false, error: 'Failed to analyze query' });
  }
});

export default router;
