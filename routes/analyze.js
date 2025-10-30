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

const router = express.Router();

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
    try {
      const data = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`,
          ':sk': `SESSION#${sessionId}`,
        },
        Limit: 20,
        ScanIndexForward: true,
      }));
      priorMessages = (data.Items || [])
        .flatMap(i => [
          i.user_query ? { role: 'user', content: i.user_query } : null,
          i.response ? { role: 'assistant', content: i.response } : null
        ])
        .filter(Boolean);
    } catch (err) {
      console.warn('⚠️ Failed to load prior messages:', err);
    }

    const outputStyle = providedOutputStyle || detectOutputStyle(userQuery);
    const roleContext = providedRoleContext || detectRoleContext(userQuery);
    const bandwidth = detectBandwidth(userQuery);
    let method = providedMethod || suggestMethod(userQuery);

    const result = await callMPAI(userQuery, method, outputStyle, roleContext, priorMessages);

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }

    // Save new exchange to DynamoDB
    const item = {
      PK: `USER#${userId}`,
      SK: `SESSION#${sessionId}#ANALYSIS#${analysisId}`,
      user_id: userId,
      session_id: sessionId,
      analysis_id: analysisId,
      user_query: userQuery,
      response: result.response,
      method,
      outputStyle,
      roleContext,
      bandwidth,
      timestamp: new Date().toISOString(),
      ttl: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
    };
    await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));

    res.json({
      success: true,
      response: result.response,
      method,
      sessionId,
      analysisId,
      modelUsed: result.modelUsed,
      usage: result.usage,
    });
  } catch (err) {
    console.error('❌ Error analyzing:', err);
    res.status(500).json({ success: false, error: 'Failed to analyze query' });
  }
});

export default router;
