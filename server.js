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


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------------------
// ROUTES
// ---------------------------------------------------------------------------

// Home page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// ---------------------------------------------------------------------------
// Handle main request
// ---------------------------------------------------------------------------
app.post('/ask', async (req, res) => {
  const userPrompt = req.body.prompt?.trim();
  const mode = req.body.mode === 'blindspot' ? 'blindspot' : 'full';
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

  // -----------------------------------------------------------------------
  // Step 1: Build GPT Prompt
  // -----------------------------------------------------------------------
  if (requestedVoices) {
    // “Explore missing voices” path
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
    // Quick Blindspot mode
    gptPrompt = `
You are part of the Wellcoaches "Nine Perspectives" model.
Analyze the reasoning below and identify:
1. Dominant perspectives (e.g., Achiever, Regulator, Analytical)
2. Missing perspectives
3. A short dignity reminder if intrinsic perspectives are missing
Respond strictly in JSON with this structure:
{
  "dominant_perspectives": [],
  "missing_perspectives": [],
  "dignity_reminder": "",
  "summary": ""
}
Reasoning: "${userPrompt}"
`;
  } else {
    // Full cognitive generation mode using refined architecture
    // Optionally enrich with library context
    const { text: libraryContext, snippets } = await getContext(
      userPrompt,
      useBooks
    );
    gptPrompt = buildPrompt({
      question: userPrompt,
      options: { useBooks, libraryContext },
    });
  }

  try {
    // ---------------------------------------------------------------------
    // Step 2: GPT Structured Output
    // ---------------------------------------------------------------------
    console.log('💬 Calling OpenAI (GPT-5-mini) for structured analysis...');
    const gptResponse = await openai.responses.create({
      model: 'gpt-5-mini',
      input: gptPrompt,
    });
    const rawGPT = gptResponse.output_text;
    console.log('✅ GPT response received. Length:', rawGPT.length, 'chars');

    const gptJSON = parseResponse(rawGPT);

    // ---------------------------------------------------------------------
    // Step 3: Claude Synthesis
    // ---------------------------------------------------------------------
    
    try {
      console.log('👁️ Running Core Observer analysis...');
      const perspectivesArray = gptJSON.perspectives || [];
      observerSummary = await analyzePerspectives(perspectivesArray);
      console.log('✅ Core Observer summary generated.');
    } catch (err) {
      console.warn(
        '⚠️ Core Observer failed — continuing without it:',
        err.message
      );
    }

    console.log('💬 Calling Claude (3.5 Haiku) for synthesis...');
    const claudeResponse = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 2500,
      temperature: 0.2,
      messages: [{ role: 'user', content: synthesisPrompt(gptJSON) }],
    });

    const finalOutput = claudeResponse.content[0].text;
    console.log(
      '✅ Claude synthesis complete. Length:',
      finalOutput.length,
      'chars'
    );

    // ---------------------------------------------------------------------
    // Step 4: Developer Log
    // ---------------------------------------------------------------------
    if (!fs.existsSync('logs')) fs.mkdirSync('logs');
    const logEntry = {
      timestamp: new Date().toISOString(),
      mode,
      prompt: userPrompt,
      gpt_model: 'gpt-5-mini',
      claude_model: 'claude-3-5-haiku-20241022',
      gpt_chars: rawGPT.length,
      claude_chars: finalOutput.length,
      vector_store: process.env.VECTOR_STORE_ID || null,
      json_keys: Object.keys(gptJSON),
    };
    fs.appendFileSync(
      'logs/history.json',
      JSON.stringify(logEntry) + ',\n',
      'utf8'
    );
    console.log('🗂️ Log entry added to logs/history.json');

    // ---------------------------------------------------------------------
    // Step 5: Render for User
    // ---------------------------------------------------------------------
    const template = fs.readFileSync(
      path.join(__dirname, 'views', 'result.html'),
      'utf8'
    );
    let missingListHTML = '';

    if (
      gptJSON.missing_perspectives &&
      gptJSON.missing_perspectives.length > 0
    ) {
      missingListHTML = `
        <div class="missing-voices">
          <h3>Explore Missing Voices</h3>
          <form action="/ask" method="post">
            <input type="hidden" name="prompt" value="${userPrompt}" />
            <input type="hidden" name="voices" value="${gptJSON.missing_perspectives.join(
              ', '
            )}" />
            <button type="submit" class="button secondary">
              Generate Insights for ${gptJSON.missing_perspectives.join(', ')}
            </button>
          </form>
        </div>
      `;
    }

    // 🧠 Ensure blindspot mode doesn't render perspectives
    const perspectivesJSON =
      mode === 'blindspot' ? '[]' : JSON.stringify(gptJSON.perspectives || []);

    const filled = template
      .replace('{{userPrompt}}', userPrompt)
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

// ---------------------------------------------------------------------------
// Perspective Expansion Route
// ---------------------------------------------------------------------------
app.post('/expand', async (req, res) => {
  const { prompt, perspective } = req.body;
  if (!prompt || !perspective)
    return res.status(400).json({ error: 'Missing data.' });

  try {
    const expandPrompt = `
Expand upon the "${perspective}" perspective from the Wellcoaches Nine Perspectives model.
Provide a deeper, more reflective analysis (5–6 sentences) consistent with its cognitive style.
Do not restate other perspectives.
Situation: "${prompt}"
`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert Wellcoaches AI assistant.',
        },
        { role: 'user', content: expandPrompt },
      ],
    });

    // ✅ Replace placeholder text {{userPrompt}} in the returned message
    const expanded =
      response.choices?.[0]?.message?.content?.replace(
        '{{userPrompt}}',
        prompt
      ) || '(no content returned)';

    res.json({ expanded });
  } catch (err) {
    console.error('❌ Error expanding perspective:', err);
    res.status(500).json({ error: 'Expansion failed.' });
  }
});

// ---------------------------------------------------------------------------
// START SERVER
// ---------------------------------------------------------------------------
app.listen(3000, () => {
  console.log('✅ Wellcoaches MVP running at http://localhost:3000');
});
