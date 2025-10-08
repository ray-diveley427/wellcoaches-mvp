// utils/coreObserver.js
import OpenAI from 'openai';
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function analyzePerspectives(perspectives) {
  const prompt = `
You are the **Core Observer**, an integrative layer of awareness within the Wellcoaches AI Mind.
Your task is to step back and observe how the nine perspectives relate to each other.

### Goals
1. Detect overlaps – similar values, repeated insights.
2. Detect tensions – contradictions or opposing advice.
3. Detect missing voices – underrepresented perspectives.
4. Identify meta-themes – what the system as a whole is trying to balance or learn.

### Output format
Respond ONLY in valid JSON:
{
  "overlaps": [],
  "tensions": [],
  "missing": [],
  "meta_themes": []
}

Perspectives:
${JSON.stringify(perspectives, null, 2)}
`;

  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
  });

  const content = completion.choices[0].message.content;
  return JSON.parse(content);
}
