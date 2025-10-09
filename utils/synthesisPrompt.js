// utils/synthesisPrompt.js
export function synthesisPrompt(gptJSON, observerSummary = null) {
  const perspectivesText = JSON.stringify(gptJSON.perspectives || [], null, 2);
  const observerText = observerSummary
    ? JSON.stringify(observerSummary, null, 2)
    : 'No Core Observer data available.';

  return `
You are the Synthesis Mind of the Wellcoaches AI system.

### User Prompt
${gptJSON.summary || 'No direct summary provided.'}

### Perspectives
${perspectivesText}

### Core Observer Summary
${observerText}

### Task
Integrate all insights into one cohesive synthesis.
- Weave together overlapping ideas.
- Balance any tensions or contradictions.
- Address any missing or underrepresented viewpoints.
- Keep tone compassionate, grounded, and insightful.

Respond with a clear, conversational synthesis.
`;
}
