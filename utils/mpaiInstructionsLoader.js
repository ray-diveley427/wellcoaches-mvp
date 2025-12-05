// Load ultra-compressed MPAI instructions from markdown files
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildMPAIPrompt as buildOldPrompt } from './mpaiInstructions.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load core instructions (always loaded)
let coreInstructions;
let extendedMethods;
let useOldInstructions = false;

try {
  const coreInstructionsPath = path.join(__dirname, 'mpai_instructions_core.md');
  console.log(`📁 Looking for core instructions at: ${coreInstructionsPath}`);
  coreInstructions = fs.readFileSync(coreInstructionsPath, 'utf8');
  console.log(`✅ Core instructions loaded successfully (${coreInstructions.length} chars)`);
} catch (error) {
  console.error('❌ Error loading core instructions:', error.message);
  console.error('   File path attempted:', path.join(__dirname, 'mpai_instructions_core.md'));
  console.log('⚠️ Falling back to old instructions');
  useOldInstructions = true;
}

// Load extended methods (for on-demand loading)
if (!useOldInstructions) {
  try {
    const extendedMethodsPath = path.join(__dirname, 'mpai_extended_methods.md');
    console.log(`📁 Looking for extended methods at: ${extendedMethodsPath}`);
    extendedMethods = fs.readFileSync(extendedMethodsPath, 'utf8');
    console.log(`✅ Extended methods loaded successfully (${extendedMethods.length} chars)`);
  } catch (error) {
    console.error('❌ Error loading extended methods:', error.message);
    console.error('   File path attempted:', path.join(__dirname, 'mpai_extended_methods.md'));
    console.log('⚠️ Falling back to old instructions');
    useOldInstructions = true;
  }
}

/**
 * Build MPAI system prompt
 * @param {string} method - The analysis method being used
 * @param {string} userQuery - The user's question
 * @param {string} outputStyle - Output style preference
 * @param {string} roleContext - Role context if detected
 * @param {boolean} hasUploads - Whether files were uploaded
 * @returns {string} - Complete system prompt
 */
export function buildMPAIPrompt(method, userQuery, outputStyle = 'BALANCED', roleContext = null, hasUploads = false) {
  // If loading new instructions failed, use old system
  if (useOldInstructions) {
    console.log('⚠️ Using old instruction system');
    return buildOldPrompt(method, userQuery, outputStyle, roleContext, hasUploads);
  }

  let prompt = coreInstructions;

  // Add extended methods if Science of Leadership book is needed
  // SKILLS method uses Science of Leadership book
  if (method === 'APPLY_SCIENCE_OF_LEADERSHIP_BOOK' ||
      method === 'SKILLS' ||
      userQuery?.toLowerCase().includes('science of leadership')) {
    prompt += '\n\n' + extendedMethods;
  }

  // Add method-specific context
  if (method && method !== 'CONVERSATIONAL') {
    prompt += `\n\n**Current Method:** ${method}`;
  }

  // Add role context if detected
  if (roleContext) {
    prompt += `\n\n**Role Context Detected:** ${roleContext}`;
  }

  // Add upload context
  if (hasUploads) {
    prompt += `\n\n**Note:** User has uploaded files. Reference specific content from these files in your analysis.`;
  }

  return prompt;
}

/**
 * Get method from user query or explicit method parameter
 * @param {string} userQuery - The user's question
 * @param {string} explicitMethod - Explicitly requested method
 * @returns {string} - Method name
 */
export function detectMethod(userQuery, explicitMethod = null) {
  if (explicitMethod) return explicitMethod;

  const query = userQuery.toLowerCase();

  // Science of Leadership book
  if (query.includes('science of leadership') || query.includes('sol book')) {
    return 'APPLY_SCIENCE_OF_LEADERSHIP_BOOK';
  }

  // Pattern matching for other methods
  if (query.includes('action plan') || query.includes('development plan')) {
    return 'ACTION_PLAN';
  }

  if (query.includes('stuck') || query.includes('catch-22') || query.includes('inner peace')) {
    return 'INNER_PEACE';
  }

  if (query.includes('pattern') || query.includes('recurring') || query.includes('keeps happening')) {
    return 'PATTERN';
  }

  if (query.includes('conflict') || query.includes('competing') || query.includes('torn between')) {
    return 'CONFLICT';
  }

  if (query.includes('habit') || query.includes('behavior change')) {
    return 'HABIT_FORMATION';
  }

  if (query.includes('skill') || query.includes('capability')) {
    return 'SKILLS';
  }

  if (query.includes('stakeholder') || query.includes('different people')) {
    return 'STAKEHOLDER';
  }

  if (query.includes('scenario') || query.includes('compare options') || query.includes('which option')) {
    return 'SCENARIO_TEST';
  }

  if (query.includes('short term') || query.includes('long term') || query.includes('time horizon')) {
    return 'TIME_HORIZON';
  }

  if (query.includes('risk') || query.includes('safety') || query.includes('harm')) {
    return 'HUMAN_HARM_CHECK';
  }

  if (query.includes('summarize') || query.includes('summary')) {
    return 'NOTES_SUMMARY';
  }

  // Default methods
  if (query.length < 100) {
    return 'CONVERSATIONAL';
  }

  return 'STANDARD';
}
