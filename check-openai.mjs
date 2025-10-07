import 'dotenv/config';
import OpenAI from 'openai';

console.log('Testing OpenAI import...');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

console.log('client.constructor.name:', client.constructor.name);
console.log('beta exists?', !!client.beta);
console.log('client keys:', Object.keys(client));
console.log(
  'beta.responses.create available?',
  typeof client.beta?.responses?.create === 'function'
);
