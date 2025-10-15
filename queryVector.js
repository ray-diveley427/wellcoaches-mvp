import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const VECTOR_STORE_ID = process.env.VECTOR_STORE_ID;

const query = 'self efficacy spiral Wellcoaches';

(async () => {
  console.log('🔍 Running direct retrieval test for:', query);

  // 1️⃣ Create a temporary assistant wired to your vector store
  const assistant = await openai.beta.assistants.create({
    name: 'VectorStoreTester',
    model: 'gpt-4o-mini',
    tool_resources: {
      file_search: { vector_store_ids: [VECTOR_STORE_ID] },
    },
  });

  // 2️⃣ Create and run a thread that asks for matching passages
  const run = await openai.beta.threads.createAndRun({
    assistant_id: assistant.id,
    thread: {
      messages: [
        {
          role: 'user',
          content: `Search your attached vector store and return the top 5 relevant excerpts or passages that mention or explain "${query}". Always include text snippets.`,
        },
      ],
    },
  });

  // 3️⃣ Print what came back
  const text = run.output_text?.trim();
  if (text && text.length > 0 && text !== '(no output returned)') {
    console.log('\n✅ Retrieved text:\n');
    console.log(text.slice(0, 1000)); // first 1000 chars preview
  } else {
    console.log('\n⚠️  No matching text returned from vector store.');
  }

  // 4️⃣ Clean up the temporary assistant
  //await openai.beta.assistants.del(assistant.id);

  console.log('\n🏁 Retrieval test complete.');
})();
