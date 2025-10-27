// server.js - Multi-Perspective AI Server
import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

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
import {
  saveAnalysis,
  getSessionAnalyses,
  getUserSessions,
  createSession,
  updateSessionPreference,
} from './utils/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration
const MAX_HISTORY_MESSAGES = 15; // Keep last 15 exchanges (30 messages total)
const WARN_THRESHOLD = 20; // Warn user after 20 messages

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// For development, allow CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

const userId = 'user-1'; // TODO: Replace with actual user auth

// =====================================================================
// ROUTES
// =====================================================================

/**
 * GET / - Serve main UI
 */
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/**
 * POST /api/analyze - Main analysis endpoint
 * Accepts: userQuery, method (optional), outputStyle (optional), roleContext (optional), sessionId (optional)
 * Returns: analysisId, sessionId, response, method, outputStyle, roleContext
 */
app.post('/api/analyze', async (req, res) => {
  try {
    const {
      userQuery,
      method: providedMethod,
      outputStyle: providedOutputStyle,
      roleContext: providedRoleContext,
      sessionId: providedSessionId,
    } = req.body;

    if (!userQuery || !userQuery.trim()) {
      return res.status(400).json({
        success: false,
        error: 'User query is required',
      });
    }

    // Create or use existing session
    const sessionId = providedSessionId || (await createSession(userId));

    // Get session analysis history
    const sessionAnalyses = await getSessionAnalyses(userId, sessionId);
    const analysisCount = sessionAnalyses.length;

    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 MPAI Analysis Request');
    console.log(`Session: ${sessionId}`);
    console.log(`Analysis #${analysisCount + 1} (${sessionAnalyses.length} prior messages)`);

    // Build conversation history with sliding window
    // Keep only the most recent N exchanges to prevent token overflow
    const recentAnalyses = sessionAnalyses
      .reverse() // Oldest first
      .slice(-MAX_HISTORY_MESSAGES); // Take last N

    const conversationHistory = recentAnalyses.flatMap(analysis => [
      { role: 'user', content: analysis.user_query },
      { role: 'assistant', content: analysis.response }
    ]);

    console.log(`💬 Including ${conversationHistory.length} messages in context (last ${recentAnalyses.length} exchanges)`);

    // Warn if conversation is getting very long
    if (analysisCount > WARN_THRESHOLD) {
      console.warn(`⚠️  Long conversation detected: ${analysisCount} messages. Consider suggesting new session.`);
    }

    // Detect defaults if not provided
    const outputStyle = providedOutputStyle || detectOutputStyle(userQuery);
    const roleContext = providedRoleContext || detectRoleContext(userQuery);
    const bandwidth = detectBandwidth(userQuery);

    // Suggest or use provided method
    let method = providedMethod || suggestMethod(userQuery);

    // Override with SYNTHESIS_ALL if appropriate
    if (method === 'QUICK' && shouldSuggestSynthesisAll(analysisCount)) {
      console.log(`💡 Suggesting SYNTHESIS_ALL (${analysisCount} prior analyses)`);
    }

    console.log(`Method: ${method}`);
    console.log(`Style: ${outputStyle} | Context: ${roleContext}`);
    console.log(`Bandwidth: ${bandwidth}`);
    console.log(`Query: ${userQuery.substring(0, 80)}...`);
    console.log(`${'='.repeat(60)}`);

    // Call Claude with MPAI and conversation history
    const result = await callMPAI(
      userQuery, 
      method, 
      outputStyle, 
      roleContext,
      conversationHistory
    );

    if (!result.success) {
      // Check if token limit was exceeded
      if (result.tokenLimitExceeded) {
        return res.status(400).json({
          success: false,
          error: result.error,
          tokenLimitExceeded: true,
          suggestion: 'Please start a new session to continue.',
        });
      }
      
      return res.status(500).json({
        success: false,
        error: result.error,
      });
    }

    // Save to DynamoDB
    const analysisId = await saveAnalysis(userId, sessionId, {
      userQuery,
      method,
      outputStyle,
      roleContext,
      claudeResponse: result.response,
      bandwidth,
    });

    // Save user preferences if not defaults
    const preferences = {};
    if (providedOutputStyle && providedOutputStyle !== 'natural') {
      preferences.outputStyle = outputStyle;
    }
    if (providedRoleContext && providedRoleContext !== 'personal') {
      preferences.roleContext = roleContext;
    }

    if (Object.keys(preferences).length > 0) {
      await updateSessionPreference(userId, sessionId, 'preferences', JSON.stringify(preferences));
    }

    // Determine if SYNTHESIS_ALL should be suggested
    const shouldSuggestSynthesis = shouldSuggestSynthesisAll(analysisCount);

    // Build response with warnings if needed
    const responseData = {
      success: true,
      analysisId,
      sessionId,
      method,
      outputStyle,
      roleContext,
      bandwidth,
      analysisNumber: analysisCount + 1,
      response: result.response,
      usage: result.usage,
      suggestions: {
        shouldSuggestSynthesis,
        synthesisSuggestion: shouldSuggestSynthesis 
          ? `You've done ${analysisCount + 1} analyses. Would you like to do a SYNTHESIS to integrate all insights?`
          : null,
      },
    };

    // Add warning if conversation is getting long
    if (analysisCount > WARN_THRESHOLD) {
      responseData.warnings = {
        longConversation: true,
        message: `This conversation has ${analysisCount + 1} messages. For best performance, consider starting a new session soon.`,
      };
    }

    res.json(responseData);
  } catch (err) {
    console.error('❌ Error in /api/analyze:', err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

/**
 * GET /api/session/:sessionId - Get all analyses in a session
 */
app.get('/api/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const analyses = await getSessionAnalyses(userId, sessionId);

    res.json({
      success: true,
      sessionId,
      analyses,
      count: analyses.length,
      synthesisSuggestion: shouldSuggestSynthesisAll(analyses.length),
    });
  } catch (err) {
    console.error('❌ Error fetching session:', err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

/**
 * GET /api/sessions - Get all sessions for user
 */
app.get('/api/sessions', async (req, res) => {
  try {
    const sessions = await getUserSessions(userId);

    res.json({
      success: true,
      count: sessions.length,
      sessions,
    });
  } catch (err) {
    console.error('❌ Error fetching sessions:', err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

/**
 * POST /api/session/new - Create new session
 */
app.post('/api/session/new', async (req, res) => {
  try {
    const sessionId = await createSession(userId);

    res.json({
      success: true,
      sessionId,
      message: 'New conversation started',
    });
  } catch (err) {
    console.error('❌ Error creating session:', err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

/**
 * POST /api/preference - Save user preference for a session
 */
app.post('/api/preference', async (req, res) => {
  try {
    const { sessionId, preference, value } = req.body;

    if (!sessionId || !preference) {
      return res.status(400).json({
        success: false,
        error: 'sessionId and preference are required',
      });
    }

    await updateSessionPreference(userId, sessionId, preference, value);

    res.json({
      success: true,
      message: `Preference updated: ${preference} = ${value}`,
    });
  } catch (err) {
    console.error('❌ Error updating preference:', err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

/**
 * POST /api/method/suggest - Get suggested method and options based on query
 */
app.post('/api/method/suggest', async (req, res) => {
  try {
    const { userQuery, sessionId } = req.body;

    if (!userQuery) {
      return res.status(400).json({
        success: false,
        error: 'userQuery is required',
      });
    }

    const suggestedMethod = suggestMethod(userQuery);
    const outputStyle = detectOutputStyle(userQuery);
    const roleContext = detectRoleContext(userQuery);
    const bandwidth = detectBandwidth(userQuery);

    // Check if SYNTHESIS_ALL should be suggested
    let synthesisSuggestion = null;
    if (sessionId) {
      const sessionAnalyses = await getSessionAnalyses(userId, sessionId);
      if (shouldSuggestSynthesisAll(sessionAnalyses.length)) {
        synthesisSuggestion = `You've done ${sessionAnalyses.length} analyses. Consider SYNTHESIS_ALL to integrate insights.`;
      }
    }

    res.json({
      success: true,
      suggestedMethod,
      methodDescription: getMethodDescription(suggestedMethod),
      detectedOutputStyle: outputStyle,
      detectedRoleContext: roleContext,
      bandwidth,
      synthesisSuggestion,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

/**
 * GET /api/methods - Get all available methods with descriptions
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

  res.json({
    success: true,
    methods,
  });
});

/**
 * GET /api/styles - Get available output styles
 */
app.get('/api/styles', (req, res) => {
  res.json({
    success: true,
    styles: [
      {
        key: 'natural',
        name: 'Natural',
        description: 'Integrated narrative, no labels, flowing prose (default)',
      },
      {
        key: 'structured',
        name: 'Structured',
        description: 'Explicit perspective labels, systematic breakdown',
      },
      {
        key: 'abbreviated',
        name: 'Abbreviated',
        description: 'Streamlined, core insights only',
      },
    ],
  });
});

/**
 * Health check
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// =====================================================================
// Start Server
// =====================================================================
app.listen(PORT, () => {
  console.log(`\n${'='.repeat(60)}`);
  console.log('🚀 Multi-Perspective AI Server');
  console.log(`🌐 Running at http://localhost:${PORT}`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`💾 DynamoDB Table: ${process.env.DYNAMO_TABLE}`);
  console.log(`💬 Max history: ${MAX_HISTORY_MESSAGES} exchanges`);
  console.log(`⚠️  Warning threshold: ${WARN_THRESHOLD} messages`);
  console.log(`${'='.repeat(60)}\n`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Server shutting down...');
  process.exit(0);
});