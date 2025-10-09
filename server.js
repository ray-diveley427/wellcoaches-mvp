import 'dotenv/config';
import { getContext } from './utils/getContext.js';
import express from 'express';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Utility imports
import { buildPrompt } from './utils/buildPrompt.js';
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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// -------------------------------------------------------------
// ROUTES
// -------------------------------------------------------------
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// -------------------------------------------------------------
// MAIN ROUTE — /ask
// -------------------------------------------------------------
app.post('/ask', async (req, res) => {
  const userPrompt = req.body.prompt?.trim();
  const mode = req.body.blindspot === 'true' ? 'blindspot' : 'full';
  const requestedVoices = req.body.voices?.trim() || null;
  const useBooks = req.body.useBooks === 'on' || req.body.useBooks === true;

  if (!userPrompt) return res.redirect('/');

  console.log('\n====================================');
  console.log('🟢 New Request Received');
  console.log('Mode:', mode);
  if (requestedVoices) console.log('Exploring voices:', requestedVoices);
  console.log('Prompt:', userPrompt);
  console.log('Vector store in use:', process.env.VECTOR_STORE_ID || '(none)');
  console.log('====================================');

  let gptPrompt;

  // -------------------------------------------------------------
  // Step 1: Build GPT Prompt
  // -------------------------------------------------------------
  if (requestedVoices) {
    gptPrompt = `
You are part of the Wellcoaches "Nine Perspectives" model.
Generate insights ONLY for the following perspectives: ${requestedVoices}.
For each perspective, provide:
- One key insight (2–3 sentences)
- One potential blind spot (1–2 sentences)
Respond strictly in JSON with this structure:
{
  "perspectives": [{"name": "...", "insight": "...", "blindspot": "..."}],
  "summary": ""
}
Situation: "${userPrompt}"
`;
  } else if (mode === 'blindspot') {
    gptPrompt = `
You are part of the Wellcoaches "Nine Perspectives" model.
Analyze the reasoning below and identify:
1. Dominant perspectives
2. Missing perspectives
3. A short dignity reminder if intrinsic perspectives are missing
Respond strictly in JSON:
{
  "dominant_perspectives": [],
  "missing_perspectives": [],
  "dignity_reminder": "",
  "summary": ""
}
Reasoning: "${userPrompt}"
`;
  } else {
    const { text: libraryContext } = await getContext(userPrompt, useBooks);
    gptPrompt = buildPrompt({
      question: userPrompt,
      options: { useBooks, libraryContext },
    });
  }

  try {
    // -------------------------------------------------------------
    // Step 2: GPT Structured Output
    // -------------------------------------------------------------
    console.log('💬 Calling OpenAI (GPT-4o-mini) for structured analysis...');

    // ✅ FIXED: Use correct OpenAI API
    const gptResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are part of the Wellcoaches Nine Perspectives cognitive framework. Always respond with valid JSON only, no other text.',
        },
        {
          role: 'user',
          content: gptPrompt,
        },
      ],
      temperature: 0.7,
    });

    const rawGPT = gptResponse.choices[0].message.content;
    console.log('✅ GPT response received. Length:', rawGPT.length, 'chars');
    const gptJSON = parseResponse(rawGPT);

    // -------------------------------------------------------------
    // Step 3: Core Observer
    // -------------------------------------------------------------
    let observerSummary = null;
    try {
      console.log('👁️ Running Core Observer analysis...');
      const perspectivesArray = gptJSON.perspectives || [];
      observerSummary = await analyzePerspectives(perspectivesArray);
      console.log('✅ Core Observer summary generated.');
    } catch (err) {
      console.warn('⚠️ Core Observer failed:', err.message);
    }

    // -------------------------------------------------------------
    // Step 4: Claude Synthesis
    // -------------------------------------------------------------
    console.log('💬 Calling Claude (3.5 Haiku) for synthesis...');
    const claudeResponse = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 2500,
      temperature: 0.2,
      messages: [
        {
          role: 'user',
          content: synthesisPrompt(gptJSON, observerSummary),
        },
      ],
    });

    const finalOutput = claudeResponse.content[0].text;
    console.log(
      '✅ Claude synthesis complete. Length:',
      finalOutput.length,
      'chars'
    );

    // -------------------------------------------------------------
    // Step 5: Save Session to Database
    // -------------------------------------------------------------
    await saveSession(
      userPrompt,
      gptJSON.perspectives,
      observerSummary,
      finalOutput
    );

    // -------------------------------------------------------------
    // Step 6: Developer Log
    // -------------------------------------------------------------
    if (!fs.existsSync('logs')) fs.mkdirSync('logs');
    fs.appendFileSync(
      'logs/history.json',
      JSON.stringify({
        timestamp: new Date().toISOString(),
        mode,
        prompt: userPrompt,
        gpt_model: 'gpt-4o-mini',
        claude_model: 'claude-3-5-haiku-20241022',
        gpt_chars: rawGPT.length,
        claude_chars: finalOutput.length,
      }) + ',\n',
      'utf8'
    );

    // -------------------------------------------------------------
    // Step 7: Render for User
    // -------------------------------------------------------------
    const template = fs.readFileSync(
      path.join(__dirname, 'views', 'result.html'),
      'utf8'
    );
    let missingListHTML = '';

    if (gptJSON.missing_perspectives?.length > 0) {
      missingListHTML = `
        <div class="missing-voices">
          <h3>Explore Missing Voices</h3>
          <form action="/ask" method="post">
            <input type="hidden" name="prompt" value="${userPrompt.replace(
              /"/g,
              '&quot;'
            )}" />
            <input type="hidden" name="voices" value="${gptJSON.missing_perspectives.join(
              ', '
            )}" />
            <button type="submit" class="button secondary">
              Generate Insights for ${gptJSON.missing_perspectives.join(', ')}
            </button>
          </form>
        </div>`;
    }

    const perspectivesJSON =
      mode === 'blindspot' ? '[]' : JSON.stringify(gptJSON.perspectives || []);

    // ✅ Escape the userPrompt for safe injection into JavaScript
    const escapedPrompt = userPrompt
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r');

    const filled = template
      .replace(/\{\{userPrompt\}\}/g, escapedPrompt)
      .replace('{{claudeOutput}}', finalOutput)
      .replace('{{exploreSection}}', missingListHTML || '')
      .replace('{{perspectivesJSON}}', perspectivesJSON)
      .replace('{{showBlindspots}}', mode === 'full' ? 'block' : 'none');

    res.send(filled);
  } catch (error) {
    console.error('❌ Error during generation:', error);
    res.status(500).send(`<pre>${error}</pre>`);
  }
});

// -------------------------------------------------------------
// PERSPECTIVE EXPANSION ROUTE — /expand
// -------------------------------------------------------------
app.post('/expand', async (req, res) => {
  console.log('\n🔍 ===== EXPAND ENDPOINT HIT =====');
  console.log('Request body:', JSON.stringify(req.body, null, 2));

  const { prompt, perspective } = req.body;

  console.log('Prompt received:', prompt);
  console.log('Prompt length:', prompt?.length);
  console.log('Perspective:', perspective);

  if (!prompt || !perspective) {
    console.log('❌ Missing prompt or perspective');
    return res.status(400).json({ error: 'Missing data.' });
  }

  try {
    const expandPrompt = `
You are providing a deeper analysis from the "${perspective}" perspective within the Wellcoaches Nine Perspectives model.

The user's situation is:
"${prompt}"

Provide a deeper, more reflective analysis (5–6 sentences) from the ${perspective} perspective that is consistent with its cognitive style and values. Focus specifically on this situation and provide actionable insights. Do not mention other perspectives. The situation has been provided above - analyze it directly without asking for clarification.
`;

    console.log('Calling OpenAI...');

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert Wellcoaches AI assistant specializing in the ${perspective} perspective. The user's situation has already been provided. Analyze it directly without asking for more information.`,
        },
        { role: 'user', content: expandPrompt },
      ],
      temperature: 0.7,
    });

    const expanded =
      response.choices?.[0]?.message?.content || '(no content returned)';

    console.log('✅ Expansion complete. Length:', expanded.length);
    console.log('=================================\n');

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
