// -------------------------------------------------------------
// Wellcoaches MVP Server – Nine Perspectives (DynamoDB version)
// -------------------------------------------------------------
import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';
import {
  DynamoDBClient,
  PutItemCommand,
  QueryCommand,
  ScanCommand,
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

// Utility imports
import { synthesisPrompt } from './utils/synthesisPrompt.js';
import { parseResponse } from './utils/parseResponse.js';
import { analyzePerspectives } from './utils/coreObserver.js';
import { saveSession } from './utils/db.js';

// -------------------------------------------------------------
// Setup
// -------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// -------------------------------------------------------------
// Helper – HTML formatting
// -------------------------------------------------------------
function formatSynthesis(text) {
  if (!text) return '';
  let formatted = text.replace(/\n{2,}/g, '\n').replace(/\n/g, '<br><br>');
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  return `<div class="synthesis-text">${formatted}</div>`;
}

// -------------------------------------------------------------
// DynamoDB Helpers
// -------------------------------------------------------------
async function saveReflectionToDynamo(
  userId,
  sessionId,
  prompt,
  perspectives,
  observerSummary,
  synthesis
) {
  try {
    const item = {
      id: uuidv4(),
      user_id: userId,
      session_id: sessionId,
      timestamp: new Date().toISOString(), // ✅ Use consistent ISO timestamp
      prompt_text: prompt,
      perspectives_output: JSON.stringify(perspectives || []),
      core_observer_output: JSON.stringify(observerSummary || {}),
      synthesis_output: synthesis?.trim() || '',
    };

    console.log('🪣 Writing to DynamoDB Table:', process.env.DYNAMO_TABLE);
    await dynamo.send(
      new PutItemCommand({
        TableName: process.env.DYNAMO_TABLE,
        Item: marshall(item),
      })
    );
    console.log(`✅ Saved reflection for ${userId}, session ${sessionId}`);
  } catch (err) {
    console.error('❌ DynamoDB save failed:', err);
  }
}

// ✅ Query reflections for a given session
async function getReflectionsBySession(userId, sessionId) {
  try {
    const command = new QueryCommand({
      TableName: process.env.DYNAMO_TABLE,
      KeyConditionExpression: 'user_id = :uid AND session_id = :sid',
      ExpressionAttributeValues: marshall({
        ':uid': userId,
        ':sid': sessionId,
      }),
    });

    const { Items } = await dynamo.send(command);
    if (!Items?.length) return [];
    return Items.map(unmarshall).sort(
      (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
    );
  } catch (err) {
    console.error('⚠️ Failed to query DynamoDB:', err);
    return [];
  }
}

// -------------------------------------------------------------
// ROUTE – Home
// -------------------------------------------------------------
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// -------------------------------------------------------------
// ROUTE – Ask (Core Reflection Logic)
// -------------------------------------------------------------
app.post('/ask', async (req, res) => {
  const userId = 'test-user';
  const showBlindspots = req.body.blindspot === 'true';
  const userPrompt = req.body.prompt?.trim();
  let sessionId = req.body.session_id || null;

  if (!userPrompt) return res.redirect('/');

  if (req.body.reset === 'true' || !sessionId) {
    sessionId = uuidv4();
    console.log('🆕 New session created:', sessionId);
  }

  console.log('\n====================================');
  console.log('🟢 Reflection Request');
  console.log('Prompt:', userPrompt);
  console.log('Session:', sessionId);
  console.log('====================================');

  try {
    // -------------------------------------------------------------
    // Step 1: Build GPT Prompt
    // -------------------------------------------------------------
    const gptPrompt = `
You are a structured AI coach using the "Nine Perspectives" model.

Analyze the user's reflections to provide insights and blind spots for all nine perspectives:
Meaning-maker, Confidence, Autonomy, Relational, Achiever, Creative, Thinker, Adventurer, Regulator.

Each reflection builds on previous insights. Always generate nine complete perspectives, each with:
- Insight (2–3 sentences)
- Blind Spot (1–2 sentences)

Return strictly valid JSON:
{
  "perspectives": [
    {"name": "Perspective Name", "insight": "...", "blindspot": "..."},
    ...
  ],
  "summary": "Concise synthesis (2–3 sentences)."
}

User prompt: "${userPrompt}"
`;

    // -------------------------------------------------------------
    // Step 2: GPT – Generate Nine Perspectives
    // -------------------------------------------------------------
    console.log('💬 Calling OpenAI (GPT-4o-mini)...');
    const gptResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are part of the Wellcoaches Nine Perspectives cognitive framework. Return valid JSON only.',
        },
        { role: 'user', content: gptPrompt },
      ],
      temperature: 0.7,
    });

    const rawGPT = gptResponse.choices[0].message.content;
    let gptJSON;
    let perspectives = [];

    try {
      gptJSON = parseResponse(rawGPT);
      perspectives = gptJSON?.perspectives || [];
    } catch (err) {
      console.error('⚠️ Failed to parse GPT JSON:', err.message);
      gptJSON = { perspectives: [], summary: '' };
    }

    // -------------------------------------------------------------
    // Step 3: Core Observer
    // -------------------------------------------------------------
    let observerSummary = null;
    try {
      observerSummary = await analyzePerspectives(perspectives);
    } catch (err) {
      console.warn('⚠️ Core Observer failed:', err.message);
    }

    // -------------------------------------------------------------
    // Step 4: Claude Synthesis
    // -------------------------------------------------------------
    console.log('💬 Calling Claude (3.5 Haiku)...');
    const claudeResponse = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 2500,
      temperature: 0.2,
      messages: [
        { role: 'user', content: synthesisPrompt(gptJSON, observerSummary) },
      ],
    });

    const finalOutput = claudeResponse.content[0].text?.trim() || '';
    console.log('✅ Claude synthesis complete.');

    // -------------------------------------------------------------
    // Step 5: Save to DynamoDB
    // -------------------------------------------------------------
    await saveSession(userPrompt, perspectives, observerSummary, finalOutput);
    await saveReflectionToDynamo(
      userId,
      sessionId,
      userPrompt,
      perspectives,
      observerSummary,
      finalOutput
    );

    // -------------------------------------------------------------
    // Step 6: Redirect to /result/:sessionId
    // -------------------------------------------------------------
    res.redirect(`/result/${sessionId}`);
  } catch (error) {
    console.error('❌ Error in /ask route:', error);
    res.status(500).send(`<pre>${error}</pre>`);
  }
});

// -------------------------------------------------------------
// ROUTE – Result Page
// -------------------------------------------------------------
app.get('/result/:sessionId', async (req, res) => {
  const userId = 'test-user';
  const sessionId = req.params.sessionId;
  const reflections = await getReflectionsBySession(userId, sessionId);

  if (!reflections.length) {
    return res.status(404).send('No reflections found for this session.');
  }

  const latest = reflections[0];
  const template = fs.readFileSync(
    path.join(__dirname, 'views', 'result.html'),
    'utf8'
  );

  const escapedPrompt = latest.prompt_text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');

  const filled = template
    .replace('{{escapedUserPrompt}}', escapedPrompt)
    .replace('{{claudeOutput}}', formatSynthesis(latest.synthesis_output))
    .replace('{{perspectivesJSON}}', latest.perspectives_output)
    .replace('{{showBlindspots}}', 'block')
    .replace('{{rawUserPrompt}}', latest.prompt_text.replace(/"/g, '&quot;'))
    .replace('{{sessionId}}', sessionId)
    .replace(
      '{{newReflection}}',
      JSON.stringify({
        timestamp: new Date(latest.timestamp).toLocaleString(),
        prompt: latest.prompt_text,
        synthesis: latest.synthesis_output.replace(/^"|"$/g, ''),
      })
    );

  res.send(filled);
});

// -------------------------------------------------------------
// ROUTE – API: Get History (shows all reflections by user)
// -------------------------------------------------------------
app.get('/api/history', async (req, res) => {
  const userId = 'test-user';
  try {
    // 🧭 Show all reflections (across all sessions)
    const command = new QueryCommand({
      TableName: process.env.DYNAMO_TABLE,
      KeyConditionExpression: 'user_id = :uid',
      ExpressionAttributeValues: marshall({ ':uid': userId }),
    });

    const { Items } = await dynamo.send(command);
    if (!Items?.length) return res.json({ success: true, reflections: [] });

    const reflections = Items.map(unmarshall)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .map((r) => ({
        timestamp: new Date(r.timestamp).toLocaleString(),
        prompt: r.prompt_text,
        synthesis: r.synthesis_output.replace(/^"|"$/g, ''), // ✅ Clean stray quotes
      }));

    res.json({ success: true, reflections });
  } catch (err) {
    console.error('❌ Failed to fetch reflections:', err);
    res.json({ success: false, reflections: [] });
  }
});

// -------------------------------------------------------------
// ROUTE – Expand Perspective
// -------------------------------------------------------------
app.post('/expand', async (req, res) => {
  const { prompt, perspective } = req.body;
  if (!prompt || !perspective)
    return res.status(400).json({ error: 'Missing prompt or perspective.' });

  try {
    const expandPrompt = `
You are expanding from the "${perspective}" perspective within the Wellcoaches Nine Perspectives model.

User's situation:
"${prompt}"

Provide a deeper, reflective analysis (5–6 sentences) from the ${perspective} perspective only.
`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert Wellcoaches AI assistant specializing in the ${perspective} perspective.`,
        },
        { role: 'user', content: expandPrompt },
      ],
      temperature: 0.7,
    });

    const expanded =
      response.choices?.[0]?.message?.content?.trim() ||
      '(no content returned)';
    res.json({ expanded });
  } catch (err) {
    console.error('❌ Error expanding perspective:', err);
    res.status(500).json({ error: 'Expansion failed.' });
  }
});

// -------------------------------------------------------------
// START SERVER
// -------------------------------------------------------------
app.listen(3000, () => {
  console.log('✅ Wellcoaches MVP running at http://localhost:3000');
});
