// utils/synthesisPrompt.js
export function synthesisPrompt(gptJSON) {
  return `
You are the Wellcoaches synthesizer integrating nine cognitive perspectives.
Use the JSON data below to create a reflective synthesis that:
- Highlights the interplay between perspectives (human → practical → system).
- Mentions missing perspectives gently.
- Ends with one clear synthesis paragraph integrating all nine.
- Keep tone professional, warm, and aligned with Wellcoaches style.

JSON data:
${JSON.stringify(gptJSON, null, 2)}
`;
}
