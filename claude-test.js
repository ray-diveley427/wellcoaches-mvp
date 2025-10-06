import Anthropic from '@anthropic-ai/sdk';
import 'dotenv/config';

const anthropic = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

async function testClaude() {
  const response = await anthropic.messages.create({
    model: 'claude-3-5-haiku-20241022',
    max_tokens: 200,
    messages: [
      {
        role: 'user',
        content:
          'Write a short poem about coaching growth and human potential.',
      },
    ],
  });

  console.log('✅ Claude is connected!');
  console.log(response.content[0].text);
}

testClaude();
