// utils/getContext.js
// Retrieves relevant context from Assistants v2 attached to your vector stores

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  defaultHeaders: { 'OpenAI-Beta': 'assistants=v2' },
});

export async function getContext(query) {
  console.log('\n====================================================');
  console.log('📘 Context Retrieval Initiated');
  console.log('Query:', query);
  console.log('Including all Library Books');
  console.log('====================================================\n');

  const coreAssistant = process.env.OPENAI_ASSISTANT_CORE_ID;
  const booksAssistant = process.env.OPENAI_ASSISTANT_BOOKS_ID;

  // --- Sanity Check ---
  if (!coreAssistant) {
    console.warn('⚠️ No CORE assistant configured — returning empty context.');
    return { text: '', snippets: [] };
  }

  // Always query both Core and Books (if configured)
  const assistantsToQuery = [coreAssistant];
  if (booksAssistant) assistantsToQuery.push(booksAssistant);

  let combinedText = '';
  let snippets = [];

  for (const assistantId of assistantsToQuery) {
    const isCore = assistantId === coreAssistant;
    const label = isCore ? 'Core Knowledge Base' : 'Library Books';

    console.log('----------------------------------------------------');
    console.log(`🧠 Querying Assistant (v2): ${assistantId} — ${label}`);
    console.log('----------------------------------------------------');

    try {
      // ✅ Simplified new API call
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

      const preview = run.output_text
        ? run.output_text.slice(0, 300)
        : '(no output returned)';
      console.log(`📥 Raw run output (first 300 chars):\n${preview}`);

      const runOutput = run.output_text?.trim() || '(no output retrieved)';
      combinedText += `\n\n[${label}]\n${runOutput}`;
      snippets.push({ source: label, content: runOutput });

      console.log(`✅ Retrieved ${runOutput.length} characters from ${label}`);
    } catch (err) {
      console.error(`❌ Error fetching from ${label}:`, err.message);
      snippets.push({
        source: label,
        content: `(Error fetching data: ${err.message})`,
      });
    }
  }

  console.log('====================================================');
  console.log('📘 Library Context Retrieval Complete');
  console.log('Character count:', combinedText.length);
  console.log('====================================================\n');

  return { text: combinedText.trim(), snippets };
}
