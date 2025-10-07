// utils/parseResponse.js
export function parseResponse(rawText) {
  try {
    return JSON.parse(rawText);
  } catch {
    console.warn('⚠️ GPT output invalid JSON. Wrapping safely.');
    return { summary: rawText, perspectives: [] };
  }
}
