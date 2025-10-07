// utils/buildPrompt.js
import { perspectivePrompts } from '../perspectivePrompts.js';
import { orderedPerspectives, valueDimensions } from '../valueDimensions.js';

export function buildPrompt(userPrompt) {
  const perspectivesText = orderedPerspectives
    .map(
      (name) => `
{
  "name": "${name}",
  "value_dimension": "${valueDimensions[name]}",
  "instruction": "${perspectivePrompts[name]}"
}`
    )
    .join(',\n');

  return `
You are part of the Wellcoaches "Nine Perspectives" cognitive framework.
For the situation below, generate distinct insights for each perspective.
Each perspective must follow its cognitive style and value orientation.
Respond strictly in JSON with this structure:
{
  "perspectives": [
    {"name": "Meaning-maker", "insight": "", "blindspot": "", "value_dimension": "Intrinsic"},
    ...
  ],
  "missing_perspectives": [],
  "summary": ""
}

Guidelines:
- Do NOT mention Jung, Enneagram, or cognitive functions explicitly.
- Let each perspective's tone reflect its hidden architecture.
- Keep responses concise and differentiated (2–3 sentences per insight, 1–2 per blindspot).
- Maintain natural language; avoid labeling theory.
- Preserve Hartman order (Intrinsic → Extrinsic → Systemic).

Situation: "${userPrompt}"

Perspective Processing Cues:
${perspectivesText}
`;
}
