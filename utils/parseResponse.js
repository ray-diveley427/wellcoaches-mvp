export function parseResponse(text) {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON found in response.');
    return JSON.parse(match[0]);
  } catch (err) {
    console.error('⚠️ JSON parse failed:', err.message);
    return { perspectives: [], summary: '' };
  }
}
