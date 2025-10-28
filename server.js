// server.js - Multi-Perspective AI Server
import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, PutCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";


const dbClient = new DynamoDBClient({
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});
const docClient = DynamoDBDocumentClient.from(dbClient);
const TABLE_NAME = "mpai-sessions";

// Utils
import {
  callMPAI,
  detectBandwidth,
  detectOutputStyle,
  detectRoleContext,
  suggestMethod,
  shouldSuggestSynthesisAll,
  getMethodDescription,
} from './utils/claudeHandler.js';

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
 * Fetch user history from DynamoDB
 */
// ✅ Always return an array (never 404)
app.get("/api/history/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const pk = userId.startsWith("USER#") ? userId : `USER#${userId}`;

    const data = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: { ":pk": pk },
        ScanIndexForward: false,
        Limit: 50,
      })
    );

    // Always return a 200 — even if empty
    res.json(data.Items || []);
  } catch (err) {
    console.error("❌ Error fetching DynamoDB history:", err);
    res.status(500).json({ error: "Failed to fetch history" });
  }
});



// Delete a full session (all items for that session)
app.delete("/api/history/:userId/:sessionId", async (req, res) => {
  const { userId, sessionId } = req.params;
  try {
    // 1️⃣ Get all items for this session
    const data = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `USER#${userId}`,
        ":sk": `SESSION#${sessionId}`,
      },
    }));

    // 2️⃣ Delete each item (batch)
    for (const item of data.Items || []) {
      await docClient.send(new DeleteCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: item.PK,
          SK: item.SK,
        },
      }));
    }

    console.log(`🗑️ Deleted ${data.Count} items from session ${sessionId}`);
    res.json({ success: true, message: `Deleted session ${sessionId}` });
  } catch (err) {
    console.error("❌ Error deleting session:", err);
    res.status(500).json({ success: false, error: "Failed to delete session" });
  }
});


/**
 * POST /api/analyze
 * Runs an MPAI analysis and stores result in DynamoDB
 * — now with conversation memory restored!
 */
app.post('/api/analyze', async (req, res) => {
  try {
    const {
      userQuery,
      method: providedMethod,
      outputStyle: providedOutputStyle,
      roleContext: providedRoleContext,
      sessionId: providedSessionId,
      userId = DEFAULT_USER_ID
    } = req.body;

    if (!userQuery || !userQuery.trim()) {
      return res.status(400).json({ success: false, error: 'User query is required' });
    }

    // 1️⃣ Build session and analysis IDs
    const sessionId = providedSessionId || uuidv4();
    const analysisId = uuidv4();

    // 2️⃣ Load recent messages for context
    let priorMessages = [];
    try {
      const data = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues: {
          ":pk": `USER#${userId}`,
          ":sk": `SESSION#${sessionId}`,
        },
        Limit: 20,
        ScanIndexForward: true // oldest → newest
      }));

      priorMessages = (data.Items || [])
        .flatMap(i => [
          i.user_query ? { role: "user", content: i.user_query } : null,
          i.response ? { role: "assistant", content: i.response } : null
        ])
        .filter(Boolean);
    } catch (err) {
      console.warn("⚠️ Failed to load prior messages:", err);
    }

    // 3️⃣ Detect defaults
    const outputStyle = providedOutputStyle || detectOutputStyle(userQuery);
    const roleContext = providedRoleContext || detectRoleContext(userQuery);
    const bandwidth = detectBandwidth(userQuery);
    let method = providedMethod || suggestMethod(userQuery);

    // 4️⃣ Call Claude (now with priorMessages)
    const result = await callMPAI(userQuery, method, outputStyle, roleContext, priorMessages);

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }

    // 5️⃣ Save new exchange to DynamoDB
    const item = {
      PK: `USER#${userId}`,
      SK: `SESSION#${sessionId}#ANALYSIS#${analysisId}`,
      user_id: userId,
      session_id: sessionId,
      analysis_id: analysisId,
      user_query: userQuery,
      response: result.response,
      method,
      bandwidth,
      output_style: outputStyle,
      role_context: roleContext,
      timestamp: new Date().toISOString(),
      ttl: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30 // 30 days
    };

    await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));

    // 6️⃣ Respond to client
    res.json({
      success: true,
      analysisId,
      sessionId,
      method,
      outputStyle,
      roleContext,
      bandwidth,
      response: result.response,
      usage: result.usage || {},
    });

  } catch (err) {
    console.error("❌ Error in /api/analyze:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});




/**
 * GET /api/methods - List available methods
 */
app.get('/api/methods', (req, res) => {
  const methods = [
    { key: 'QUICK', description: getMethodDescription('QUICK') },
    { key: 'FULL', description: getMethodDescription('FULL') },
    { key: 'CONFLICT_RESOLUTION', description: getMethodDescription('CONFLICT_RESOLUTION') },
    { key: 'STAKEHOLDER_ANALYSIS', description: getMethodDescription('STAKEHOLDER_ANALYSIS') },
    { key: 'PATTERN_RECOGNITION', description: getMethodDescription('PATTERN_RECOGNITION') },
    { key: 'SCENARIO_TEST', description: getMethodDescription('SCENARIO_TEST') },
    { key: 'TIME_HORIZON', description: getMethodDescription('TIME_HORIZON') },
    { key: 'HUMAN_HARM_CHECK', description: getMethodDescription('HUMAN_HARM_CHECK') },
    { key: 'SIMPLE_SYNTHESIS', description: getMethodDescription('SIMPLE_SYNTHESIS') },
    { key: 'SYNTHESIS_ALL', description: getMethodDescription('SYNTHESIS_ALL') },
    { key: 'INNER_PEACE_SYNTHESIS', description: getMethodDescription('INNER_PEACE_SYNTHESIS') },
    { key: 'COACHING_PLAN', description: getMethodDescription('COACHING_PLAN') },
    { key: 'SKILLS', description: getMethodDescription('SKILLS') },
    { key: 'NOTES_SUMMARY', description: getMethodDescription('NOTES_SUMMARY') },
  ];

  res.json({ success: true, methods });
});

/**
 * GET /api/health
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});


// Save one conversation (end-of-analysis)
app.post("/api/history", async (req, res) => {
  try {
    const { userId, sessionId, userQuery, response } = req.body;
    const item = {
      PK: `USER#${userId}`,
      SK: `SESSION#${sessionId || uuidv4()}`,
      user_id: userId,
      user_query: userQuery,
      response,
      timestamp: new Date().toISOString(),
      ttl: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
    };
    await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Error saving history:", err);
    res.status(500).json({ error: "Failed to save history" });
  }
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
