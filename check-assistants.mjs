import 'dotenv/config';
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  defaultHeaders: { 'OpenAI-Beta': 'assistants=v2' },
});


const assistants = [
  process.env.OPENAI_ASSISTANT_CORE_ID,
  process.env.OPENAI_ASSISTANT_BOOKS_ID,
].filter(Boolean);

if (assistants.length === 0) {
  console.error('❌ No assistant IDs found in .env.');
  process.exit(1);
}

for (const id of assistants) {
  console.log(`\n🧠 Checking Assistant: ${id}`);
  try {
    const result = await client.beta.assistants.retrieve(id);
    console.log('✅ Name:', result.name);
    console.log('   Model:', result.model);
    console.log(
      '   Vector Stores:',
      result.tool_resources?.file_search?.vector_store_ids || []
    );
  } catch (err) {
    console.error('❌ Error retrieving assistant:', err.message);
  }
}
