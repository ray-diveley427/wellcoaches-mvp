// utils/db.js
import {
  DynamoDBClient,
  PutItemCommand,
  QueryCommand,
  UpdateItemCommand,
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { v4 as uuidv4 } from 'uuid';

const dynamoDB = new DynamoDBClient({ region: process.env.AWS_REGION });
const TABLE_NAME = process.env.DYNAMO_TABLE || 'mpai-sessions';

/**
 * Save a single analysis to DynamoDB
 */
export async function saveAnalysis(userId, sessionId, analysis) {
  try {
    const {
      userQuery,
      method,
      outputStyle,
      roleContext,
      claudeResponse,
      bandwidth,
      timestamp = new Date().toISOString(),
    } = analysis;

    const analysisId = uuidv4();

    const item = {
      PK: `USER#${userId}`,
      SK: `SESSION#${sessionId}#ANALYSIS#${timestamp}#${analysisId}`,
      user_id: userId,
      session_id: sessionId,
      analysis_id: analysisId,
      timestamp,
      method,
      output_style: outputStyle,
      role_context: roleContext,
      bandwidth,
      user_query: userQuery,
      response: claudeResponse,
      ttl: Math.floor(Date.now() / 1000) + 31536000, // 1 year (365 days)
    };

    const command = new PutItemCommand({
      TableName: TABLE_NAME,
      Item: marshall(item),
    });

    await dynamoDB.send(command);
    console.log(`✅ Saved analysis: ${analysisId}`);
    return analysisId;
  } catch (err) {
    console.error('❌ Failed to save analysis:', err);
    throw err;
  }
}

/**
 * Get all analyses for a session, ordered chronologically
 */
export async function getSessionAnalyses(userId, sessionId) {
  try {
    const command = new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: marshall({
        ':pk': `USER#${userId}`,
        ':skPrefix': `SESSION#${sessionId}#ANALYSIS`,
      }),
      ScanIndexForward: true, // Chronological order (oldest first)
    });

    const { Items } = await dynamoDB.send(command);
    
    if (!Items || Items.length === 0) {
      return [];
    }

    // Unmarshal and return
    const analyses = Items.map(unmarshall);
    console.log(`📚 Retrieved ${analyses.length} analyses for session ${sessionId}`);
    
    return analyses;
  } catch (err) {
    console.error('❌ Failed to query session:', err);
    return [];
  }
}

/**
 * Get all sessions for a user
 */
export async function getUserSessions(userId) {
  try {
    const command = new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: marshall({
        ':pk': `USER#${userId}`,
      }),
      ScanIndexForward: false, // Newest first
    });

    const { Items } = await dynamoDB.send(command);
    if (!Items?.length) return [];

    // Group by session_id and get latest from each
    const sessionMap = new Map();
    Items.map(unmarshall).forEach((item) => {
      const sid = item.session_id;
      if (!sid) return; // Skip items without session_id
      
      if (!sessionMap.has(sid) || new Date(item.timestamp) > new Date(sessionMap.get(sid).timestamp)) {
        sessionMap.set(sid, item);
      }
    });

    const sessions = Array.from(sessionMap.values()).sort(
      (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
    );

    console.log(`📋 Retrieved ${sessions.length} sessions for user ${userId}`);
    return sessions;
  } catch (err) {
    console.error('❌ Failed to query user sessions:', err);
    return [];
  }
}

/**
 * Create a new session
 */
export async function createSession(userId) {
  const sessionId = uuidv4();
  console.log(`🆕 Created new session: ${sessionId}`);
  return sessionId;
}

/**
 * Update session metadata (e.g., perspective visibility preference)
 */
export async function updateSessionPreference(userId, sessionId, preference, value) {
  try {
    const command = new UpdateItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({
        PK: `USER#${userId}`,
        SK: `SESSION#${sessionId}#META`,
      }),
      UpdateExpression: `SET #pref = :val, #updated = :now`,
      ExpressionAttributeNames: {
        '#pref': preference,
        '#updated': 'last_updated',
      },
      ExpressionAttributeValues: marshall({
        ':val': value,
        ':now': new Date().toISOString(),
      }),
    });

    await dynamoDB.send(command);
    console.log(`✅ Updated preference: ${preference} = ${value}`);
  } catch (err) {
    console.error('❌ Failed to update preference:', err);
  }
}