// utils/getContext.js
// Retrieves relevant context from Assistants v2 attached to your vector stores

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  defaultHeaders: { 'OpenAI-Beta': 'assistants=v2' },
});

export async function getContext(query, useBooks) {
  if (!useBooks) {
    console.log('📘 Skipping assistant retrieval (useBooks = false)');
    return { text: '', snippets: [] };
  }

  const coreAssistant = process.env.OPENAI_ASSISTANT_CORE_ID;
  const bookAssistant = process.env.OPENAI_ASSISTANT_BOOKS_ID;

  if (!coreAssistant && !bookAssistant) {
    console.warn('⚠️ No assistants configured. Using mock fallback data.');
    const snippets = [
      { source: 'Mock Book A', content: 'Self-reflection enhances empathy.' },
      { source: 'Mock Book B', content: 'Cognitive balance improves clarity.' },
    ];
    const text = snippets.map((s) => `[${s.source}] ${s.content}`).join('\n\n');
    return { text, snippets };
  }

  const assistantsToQuery = [coreAssistant];
  if (useBooks && bookAssistant) assistantsToQuery.push(bookAssistant);

  let combinedText = '';
  let snippets = [];

  for (const assistantId of assistantsToQuery) {
    try {
      console.log(`🧠 Querying Assistant (v2): ${assistantId}`);

      // ✅ Single-step: Create thread and run together
      const run = await openai.beta.threads.createAndRun({
        assistant_id: assistantId,
        thread: {
          messages: [
            {
              role: 'user',
              content: `Retrieve 3–5 short, relevant excerpts or passages related to this coaching question:\n"${query}"`,
            },
          ],
        },
      });

      // ✅ Extract text output safely
      const runOutput = run.output_text || '(no output)';
      combinedText += `\n\n[Assistant ${assistantId}]\n${runOutput}`;
      snippets.push({ source: assistantId, content: runOutput });

      console.log(`✅ Retrieved ${runOutput.length} chars from ${assistantId}`);
    } catch (err) {
      console.error(`❌ Error fetching from assistant ${assistantId}:`, err);
    }
  }

  return { text: combinedText.trim(), snippets };
}
