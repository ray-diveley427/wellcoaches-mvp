import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

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
// Helper – Format synthesis
// -------------------------------------------------------------
function formatSynthesis(text) {
  if (!text) return '';
  let formatted = text.replace(/\n{2,}/g, '\n').replace(/\n/g, '<br><br>');
  if (formatted.match(/[-•]\s+/)) {
    formatted = formatted.replace(
      /(?:^|<br><br>)([-•]\s+.+?)(?=<br><br>|$)/gs,
      (match) => {
        const items = match
          .split(/<br><br>/)
          .map((line) => line.replace(/^[-•]\s*/, '').trim())
          .filter(Boolean)
          .map((line) => `<li>${line}</li>`)
          .join('');
        return `<ul>${items}</ul>`;
      }
    );
  }
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  return `<div class="synthesis-text">${formatted}</div>`;
}

// -------------------------------------------------------------
// MAIN ROUTE – /ask
// -------------------------------------------------------------
app.post('/ask', async (req, res) => {
  const showBlindspots = req.body.blindspot === 'true';
  const requestedVoices = req.body.voices?.trim() || null;

  let userPrompt = req.body.prompt?.trim();
  const previousPrompt = req.body.previous?.trim();

  // ✅ Clean continuation logic (no nested labels)
  if (previousPrompt) {
    userPrompt = `${previousPrompt}\n${userPrompt}`;
    console.log('🧩 Collaborative continuation detected');
  }

  if (!userPrompt) return res.redirect('/');

  console.log('\n====================================');
  console.log('🟢 New Perspectives Request');
  console.log('Show Blindspots:', showBlindspots ? 'Yes' : 'No');
  if (requestedVoices) console.log('Exploring voices:', requestedVoices);
  console.log('Prompt:', userPrompt);
  console.log('====================================');

  try {
    // -------------------------------------------------------------
    // Step 1: Build GPT Prompt
    // -------------------------------------------------------------
    let gptPrompt;
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
    } else {
      gptPrompt = buildPrompt({ question: userPrompt });
    }

    // -------------------------------------------------------------
    // Step 2: GPT Structured Output
    // -------------------------------------------------------------
    console.log('💬 Calling OpenAI (GPT-4o-mini)...');
    const gptResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are part of the Wellcoaches Nine Perspectives cognitive framework. Always respond with valid JSON only.',
        },
        { role: 'user', content: gptPrompt },
      ],
      temperature: 0.7,
    });

    const rawGPT = gptResponse.choices[0].message.content;
    console.log('✅ GPT response received.');
    const gptJSON = parseResponse(rawGPT);

    // -------------------------------------------------------------
    // Step 3: Core Observer
    // -------------------------------------------------------------
    let observerSummary = null;
    try {
      console.log('👁️ Running Core Observer...');
      const perspectivesArray = gptJSON.perspectives || [];
      observerSummary = await analyzePerspectives(perspectivesArray);
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

    const finalOutput = claudeResponse.content[0].text;
    console.log('✅ Claude synthesis complete.');

    // -------------------------------------------------------------
    // Step 5: Save Session
    // -------------------------------------------------------------
    await saveSession(
      userPrompt,
      gptJSON.perspectives,
      observerSummary,
      finalOutput
    );

    // -------------------------------------------------------------
    // Step 6: Render result.html
    // -------------------------------------------------------------
    const template = fs.readFileSync(
      path.join(__dirname, 'views', 'result.html'),
      'utf8'
    );

    // ✅ Clean continuation logic (no nested “previous reflection”)
    if (previousPrompt) {
      userPrompt = `${previousPrompt}\n${req.body.prompt?.trim()}`;
      console.log('🧩 Collaborative continuation detected');
    }

    // ✅ Convert line breaks for HTML view
    const escapedUserPromptForHTML = userPrompt
      .replace(/&/g, '&amp;') // basic HTML escape only
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>'); // add <br> tags for line breaks

    // ✅ For JS-safe embedding (no HTML escaping)
    const escapedUserPromptForJS = userPrompt
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n');

    // ✅ Format previous prompt only once
    const formattedPreviousPrompt = (previousPrompt || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');

    const filled = template
      .replaceAll('{{previousPrompt}}', formattedPreviousPrompt)
      .replaceAll('{{escapedUserPrompt}}', escapedUserPromptForHTML)
      .replaceAll('{{userPromptJS}}', escapedUserPromptForJS)
      .replace('{{isContinuation}}', previousPrompt ? 'block' : 'none')
      .replace('{{claudeOutput}}', formatSynthesis(finalOutput))
      .replace('{{exploreSection}}', '')
      .replace(
        '{{perspectivesJSON}}',
        JSON.stringify(gptJSON.perspectives || [])
      )
      .replace('{{blindspotData}}', 'null')
      .replace('{{showBlindspots}}', showBlindspots ? 'block' : 'none');

    res.send(filled);
  } catch (error) {
    console.error('❌ Error in /ask route:', error);
    res.status(500).send(`<pre>${error}</pre>`);
  }
});

// -------------------------------------------------------------
// PERSPECTIVE EXPANSION ROUTE – /expand
// -------------------------------------------------------------
app.post('/expand', async (req, res) => {
  const { prompt, perspective } = req.body;
  if (!prompt || !perspective)
    return res.status(400).json({ error: 'Missing prompt or perspective.' });

  try {
    const expandPrompt = `
You are providing a deeper analysis from the "${perspective}" perspective within the Wellcoaches Nine Perspectives model.

The user's situation is:
"${prompt}"

Provide a deeper, reflective analysis (5–6 sentences) from the ${perspective} perspective. Focus only on this perspective.`;

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
      response.choices?.[0]?.message?.content || '(no content returned)';
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
