import express from 'express';
import { docClient, TABLE_NAME } from '../db/dynamoClient.js';
import { QueryCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
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

function resetDailyCostsIfNeeded() {
  const today = new Date().toISOString().split('T')[0];
  if (costTracking.lastResetDate !== today) {
    costTracking.dailyTotal = 0;
    costTracking.userDaily = {};
    costTracking.lastResetDate = today;
    // Daily reset happens silently (not logged unless in debug mode)
  }
}

function checkCostLimits(userId, estimatedCost) {
  resetDailyCostsIfNeeded();
  
  const today = new Date().toISOString().split('T')[0];
  const userKey = `${userId}_${today}`;
  
  // Get user's daily cost
  const userDailyCost = costTracking.userDaily[userKey]?.cost || 0;
  const newUserDailyCost = userDailyCost + estimatedCost;
  const newTotalDaily = costTracking.dailyTotal + estimatedCost;
  
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
  
  return { allowed: errors.length === 0, errors };
}

function recordCost(userId, cost) {
  resetDailyCostsIfNeeded();
  
  const today = new Date().toISOString().split('T')[0];
  const userKey = `${userId}_${today}`;
  
  if (!costTracking.userDaily[userKey]) {
    costTracking.userDaily[userKey] = { date: today, cost: 0 };
  }
  
  costTracking.userDaily[userKey].cost += cost;
  costTracking.dailyTotal += cost;
  
  // Export to global for access from server.js
  global.costTracking = costTracking;
  
  // Log high-cost requests for monitoring (only if > $0.05)
  if (cost > 0.05) {
    console.log(`💰 High-cost request: $${cost.toFixed(4)} | User: ${userId} | Daily: $${costTracking.userDaily[userKey].cost.toFixed(2)}`);
  }
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

    if (!userQuery || !userQuery.trim()) {
      return res.status(400).json({ success: false, error: 'User query is required' });
    }

    const sessionId = providedSessionId || uuidv4();
    const analysisId = uuidv4();

    // Load recent messages for context
    let priorMessages = [];
    let contextInfo = { messageCount: 0, estimatedTokens: 0 };
    try {
      // Load ALL messages for the session to preserve full context
      // DynamoDB will respect its 1MB response limit, but most sessions won't hit that
      const data = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`,
          ':sk': `SESSION#${sessionId}`,
        },
        // No limit - load all messages to preserve context from beginning of conversation
        ScanIndexForward: true, // Oldest first (chronological order for Claude)
      }));
      priorMessages = (data.Items || [])
        .flatMap(i => [
          i.user_query ? { role: 'user', content: i.user_query } : null,
          i.response ? { role: 'assistant', content: i.response } : null
        ])
        .filter(Boolean);
      contextInfo.messageCount = priorMessages.length;
    } catch (err) {
      console.warn('⚠️ Failed to load prior messages:', err);
    }

    const outputStyle = providedOutputStyle || detectOutputStyle(userQuery);
    const roleContext = providedRoleContext || detectRoleContext(userQuery);
    const bandwidth = detectBandwidth(userQuery);
    let method = providedMethod || suggestMethod(userQuery);

    // Estimate cost before making API call (rough estimate based on query length)
    // This is conservative - actual cost may be lower
    const estimatedInputTokens = Math.round((JSON.stringify(priorMessages).length + userQuery.length) / 4);
    const estimatedOutputTokens = 2000; // max_tokens setting
    const estimatedInputCost = (estimatedInputTokens / 1_000_000) * 3;
    const estimatedOutputCost = (estimatedOutputTokens / 1_000_000) * 15;
    const estimatedCost = estimatedInputCost + estimatedOutputCost;
    
    // Check cost limits before proceeding (only if enabled)
    if (COST_LIMITS_ENABLED) {
      const costCheck = checkCostLimits(userId, estimatedCost);
      if (!costCheck.allowed) {
        console.error(`🚫 Request blocked due to cost limits:`, costCheck.errors);
        return res.status(429).json({ 
          success: false, 
          error: 'Request exceeds cost limits. Please try again later or contact support.',
          costLimitExceeded: true
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
    
    // Record actual cost
    recordCost(userId, totalCost);
    
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
      timestamp: new Date().toISOString(),
      ttl: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
    };
    await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));

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
