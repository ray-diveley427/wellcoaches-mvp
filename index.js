import 'dotenv/config';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function main() {
  const response = await openai.responses.create({
    model: 'gpt-5-nano',
    input: 'write a haiku about ai',
    store: true,
  });

  console.log(response.output_text);
}

main().catch(console.error);
