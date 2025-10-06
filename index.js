import 'dotenv/config';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function main() {
  console.log('Testing OpenAI connection...');

  try {
    const response = await openai.responses.create({
      model: 'gpt-5-mini', // or "gpt-4.1-mini" if 5-mini isn't available
      input: "Say 'Connected to OpenAI successfully!'",
    });

    console.log('✅ Connection successful!');
    console.log('Response:', response.output_text);
  } catch (error) {
    console.error('❌ Connection failed:', error);
  }
}

main();
