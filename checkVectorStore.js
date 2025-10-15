// checkVectorStoreFull.js
// Verifies your vector store + assistant link (OpenAI SDK v6.x)

import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const VECTOR_STORE_ID =
  process.env.VECTOR_STORE_ID || 'vs_68e13c0b31bc8191bbef06ef6454e7c8';
const ASSISTANT_ID =
  process.env.OPENAI_ASSISTANT_CORE_ID || 'asst_j3WFL1ZfucfWZoaaqn14QEIo';

// ----------------------------------------------------
// CHECK VECTOR STORE
// ----------------------------------------------------
async function checkVectorStore() {
  console.log('🔍 Checking vector store:', VECTOR_STORE_ID);

  try {
    const store = await openai.vectorStores.retrieve(VECTOR_STORE_ID);

    console.log('\n📘 Vector Store Info:');
    console.log('Name:', store.name || '(unnamed)');
    console.log('Status:', store.status);
    console.log('File count:', store.file_counts?.total || 0);
    console.log('Created:', new Date(store.created_at * 1000).toLocaleString());

    console.log('\n📂 Listing files in this vector store...');
    const files = await openai.vectorStores.files.list(VECTOR_STORE_ID);

    if (!files.data.length) {
      console.log('⚠️  No files found in this vector store.');
    } else {
      files.data.forEach((file, idx) => {
        console.log(`\n#${idx + 1}`);
        console.log('File ID:', file.id);
        console.log('Filename:', file.filename || '(no filename)');
        console.log('Status:', file.status);
        console.log(
          'Created:',
          new Date(file.created_at * 1000).toLocaleString()
        );
      });
    }

    console.log('\n✅ Vector store check complete.\n');
  } catch (err) {
    console.error('❌ Error checking vector store:', err);
  }
}

// ----------------------------------------------------
// CHECK ASSISTANT LINK
// ----------------------------------------------------
async function checkAssistantLink() {
  console.log('🔍 Checking assistant link:', ASSISTANT_ID);

  try {
    // ✅ The correct call for OpenAI SDK v6.x
    const assistant = await openai.beta.assistants.retrieve(ASSISTANT_ID);

    const linkedStores =
      assistant.tool_resources?.file_search?.vector_store_ids || [];
    console.log('\n📘 Assistant Vector Store Links:');
    console.log(linkedStores.length ? linkedStores : '(none linked)');

    if (linkedStores.includes(VECTOR_STORE_ID)) {
      console.log(
        '\n✅ Assistant is correctly linked to your Wellcoaches Knowledge Base vector store.'
      );
    } else {
      console.log(
        '\n⚠️ Assistant is NOT linked to your expected vector store.'
      );
      console.log('Linked stores:', linkedStores);
      console.log('Expected store:', VECTOR_STORE_ID);
    }

    console.log('\n✅ Assistant link check complete.\n');
  } catch (err) {
    console.error('❌ Error checking assistant link:', err);
  }
}

// ----------------------------------------------------
// MAIN RUNNER
// ----------------------------------------------------
(async () => {
  console.log('====================================================');
  console.log('🧠 WELLCOACHES VECTOR STORE & ASSISTANT CHECK');
  console.log('====================================================\n');

  await checkVectorStore();
  await checkAssistantLink();

  console.log('====================================================');
  console.log('🏁 Verification process complete.');
  console.log('====================================================\n');
})();
