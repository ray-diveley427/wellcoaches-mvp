// utils/buildPrompt.js
import { perspectivePrompts } from './perspectivePrompts.js';
import { orderedPerspectives, valueDimensions } from './valueDimensions.js';

/**
 * Build the Wellcoaches prompt for GPT with optional book context.
 * @param {string|object} input - Either a simple string (for backward compatibility)
 *                                or an object { question, options }.
 * @returns {string} full prompt text
 */
export function buildPrompt(input) {
  // Maintain backward compatibility
  let question = typeof input === 'string' ? input : input.question;
  const options = typeof input === 'object' ? input.options || {} : {};
  const { useBooks = false, libraryContext = '' } = options;

  // Optional context from vector store or mock data
  const contextBlock =
    useBooks && libraryContext
      ? `\n\nAdditional Library Context (from licensed resources):\n${libraryContext}\n\nUse these insights only if relevant. Cite briefly like [Book, page].`
      : '';

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
- Let each perspective's tone reflect its hidden architecture (Jungian processes, Enneagram motivations, and Hartman value dimensions are implicit).
- Keep responses concise and differentiated (2–3 sentences per insight, 1–2 per blindspot).
- Maintain natural language; avoid labeling theory.
- Preserve Hartman order (Intrinsic → Extrinsic → Systemic).
${contextBlock}

Situation: "${question}"

Perspective Processing Cues:
${perspectivesText}
`;
}
