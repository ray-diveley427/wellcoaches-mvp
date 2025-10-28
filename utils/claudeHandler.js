// utils/claudeHandler.js
import Anthropic from '@anthropic-ai/sdk';
import { buildMPAIPrompt } from './mpaiInstructions.js';

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

/**
 * Call Claude with MPAI system prompt and user query
 * Returns the full text response
 */
export async function callMPAI(
  userQuery, 
  method = 'QUICK', 
  outputStyle = 'natural', 
  roleContext = 'personal',
  conversationHistory = []
) {
  try {
    // Build the full system prompt with method-specific guidance
    const systemPrompt = buildMPAIPrompt(method, userQuery, outputStyle, roleContext);

    console.log(`\n🎯 Calling Claude with method: ${method}`);
    console.log(`📝 Style: ${outputStyle} | Context: ${roleContext}`);
    console.log(`💬 Conversation history: ${conversationHistory.length} messages`);
    console.log(`📖 User query: ${userQuery.substring(0, 100)}...`);

    // Build messages array with history + current query
    const messages = [
      ...conversationHistory,
      {
        role: 'user',
        content: userQuery,
      },
    ];

    // Estimate token usage (rough: 1 token ≈ 4 characters)
    const estimatedTokens = Math.round(
      (systemPrompt.length + JSON.stringify(messages).length) / 4
    );
    console.log(`📊 Estimated input tokens: ~${estimatedTokens}`);

    if (estimatedTokens > 150000) {
      console.warn('⚠️  High token usage detected. Consider starting a new session.');
    }

    // Make the API call
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514', // Using Sonnet 4 as per requirements
      max_tokens: 2000,
      system: systemPrompt,
      messages: messages,
    });

    // Extract response text
    const responseText = message.content[0].type === 'text' 
      ? message.content[0].text 
      : '';

    console.log(`✅ Claude response received (${responseText.length} chars)`);
    console.log(`💰 Actual tokens - Input: ${message.usage.input_tokens}, Output: ${message.usage.output_tokens}`);

    return {
      success: true,
      response: responseText,
      method,
      outputStyle,
      roleContext,
      modelUsed: message.model,
      usage: {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
      },
    };
  } catch (err) {
    console.error('❌ Claude API call failed:', err.message);
    
    // Check if it's a token limit error
    if (err.message && err.message.includes('prompt is too long')) {
      return {
        success: false,
        error: 'Conversation is too long. Please start a new session.',
        response: '',
        tokenLimitExceeded: true,
      };
    }
    
    return {
      success: false,
      error: err.message,
      response: '',
    };
  }
}

/**
 * Detect user bandwidth from query
 * Returns 'LOW', 'MEDIUM', or 'HIGH'
 */
export function detectBandwidth(userQuery) {
  const queryLength = userQuery.length;
  
  const crisisKeywords = [
    'overwhelmed', 'urgent', 'cant think', 'can\'t think',
    'losing sleep', 'breaking down', 'crisis', 'emergency',
    'desperate', 'stuck', 'paralyzed', 'falling apart'
  ];
  
  const timePressureKeywords = [
    'quick', 'fast', 'need answer now', 'asap',
    'right now', 'immediately', 'urgent', 'hurry'
  ];

  const exploratoryKeywords = [
    'wondering', 'considering', 'thinking about',
    'exploring', 'curious about', 'what if'
  ];
  
  const hasCrisisLanguage = crisisKeywords.some(k => 
    userQuery.toLowerCase().includes(k)
  );
  
  const hasTimePressure = timePressureKeywords.some(k => 
    userQuery.toLowerCase().includes(k)
  );

  const hasExploratoryLanguage = exploratoryKeywords.some(k =>
    userQuery.toLowerCase().includes(k)
  );

  // LOW bandwidth: crisis, time pressure, or very short
  if (queryLength < 20 || hasCrisisLanguage || hasTimePressure) {
    return 'LOW';
  } 
  // HIGH bandwidth: detailed, professional tone, or synthesis request
  else if (queryLength > 100 || userQuery.toLowerCase().includes('synthesis') ||
           userQuery.toLowerCase().includes('comprehensive') ||
           userQuery.toLowerCase().includes('deep dive')) {
    return 'HIGH';
  } 
  // MEDIUM: everything else
  else {
    return 'MEDIUM';
  }
}

/**
 * Detect output style preference from user context
 * Returns 'natural', 'structured', or 'abbreviated'
 */
export function detectOutputStyle(userQuery) {
  const query = userQuery.toLowerCase();

  // STRUCTURED: explicit requests or professional indicators
  if (query.includes('show perspectives') || 
      query.includes('name the perspectives') ||
      query.includes('break it down') ||
      query.includes('structured')) {
    return 'structured';
  }

  // ABBREVIATED: brevity requests
  if (query.includes('keep it brief') ||
      query.includes('just key points') ||
      query.includes('summarize') ||
      query.includes('abbreviated') ||
      query.includes('short version')) {
    return 'abbreviated';
  }

  // NATURAL: default
  return 'natural';
}

/**
 * Detect user role context from query
 * Returns 'professional' or 'personal'
 */
export function detectRoleContext(userQuery) {
  const query = userQuery.toLowerCase();

  const professionalIndicators = [
    'coach', 'leader', 'team', 'organization', 'company',
    'employee', 'manager', 'executive', 'consultant',
    'consultant', 'hr', 'healthcare', 'client',
    'stakeholder', 'strategic', 'business', 'project'
  ];

  const personalIndicators = [
    'personal', 'family', 'relationship', 'friend',
    'my life', 'struggling with', 'feeling', 'myself'
  ];

  const hasProfessionalContext = professionalIndicators.some(indicator =>
    query.includes(indicator)
  );

  const hasPersonalContext = personalIndicators.some(indicator =>
    query.includes(indicator)
  );

  // If both or neither explicitly mentioned, check query tone
  if (hasProfessionalContext && !hasPersonalContext) {
    return 'professional';
  }
  if (hasPersonalContext && !hasProfessionalContext) {
    return 'personal';
  }

  // Default based on tone: structured/formal = professional, casual/emotional = personal
  if (query.length > 200 && 
      (query.includes('?') && query.split('?').length > 3)) {
    return 'professional';
  }

  return 'personal';
}

/**
 * Suggest analysis method based on query content
 */
export function suggestMethod(userQuery) {
  const query = userQuery.toLowerCase();

  // INNER_PEACE_SYNTHESIS: internal conflict about what to do (EXPANDED)
  const internalConflictIndicators = [
    'torn between', 'can\'t decide between', 'part of me',
    'but also', 'at war with myself', 'conflicted',
    'inner conflict', 'head says', 'heart says',
    'know I should but', 'feel pulled', 'internal struggle',
    'competing desires', 'two minds', 'split between'
  ];
  
  const hasInternalConflict = internalConflictIndicators.some(
    indicator => query.includes(indicator)
  );
  
  // Exclude if it's clearly external conflict
  const isExternalConflict = 
    query.includes('between people') ||
    query.includes('team conflict') ||
    query.includes('stakeholder') && query.includes('disagree');
  
  if (hasInternalConflict && !isExternalConflict) {
    return 'INNER_PEACE_SYNTHESIS';
  }

  // CONFLICT_RESOLUTION: stuck between two things (external)
  if (query.includes('conflict') || query.includes('stuck between') || 
      query.includes('gridlock') || (query.includes('torn') && isExternalConflict)) {
    return 'CONFLICT_RESOLUTION';
  }

  // COACHING_PLAN: explicit coaching request
  if (query.includes('coaching plan') || query.includes('develop me') ||
      query.includes('growth plan') || query.includes('action plan')) {
    return 'COACHING_PLAN';
  }

  // SKILLS: perspective skill development
  if (query.includes('develop') && query.includes('perspective') ||
      query.includes('strengthen') && (query.includes('perspective') || query.includes('skill')) ||
      query.includes('skill development')) {
    return 'SKILLS';
  }

  // NOTES_SUMMARY: summarize content
  if (query.includes('summarize') || query.includes('notes') ||
      query.includes('transcript') || query.includes('meeting')) {
    return 'NOTES_SUMMARY';
  }

  // SCENARIO_TEST: comparing options
  if (query.includes('decision') || query.includes('choose') || 
      query.includes('option') || query.includes('compare')) {
    return 'SCENARIO_TEST';
  }

  // STAKEHOLDER_ANALYSIS: multiple people involved
  if (query.includes('team') || query.includes('people') || 
      query.includes('stakeholder') || query.includes('group')) {
    return 'STAKEHOLDER_ANALYSIS';
  }

  // PATTERN_RECOGNITION: recurring pattern
  if (query.includes('pattern') || query.includes('keep happening') || 
      query.includes('recurring') || query.includes('here we go again') ||
      query.includes('keep doing') || query.includes('always end up')) {
    return 'PATTERN_RECOGNITION';
  }

  // TIME_HORIZON: timeframe tradeoffs
  if (query.includes('long term') || query.includes('short term') || 
      query.includes('immediate') && query.includes('future')) {
    return 'TIME_HORIZON';
  }

  // HUMAN_HARM_CHECK: risk/safety/ethics
  if (query.includes('risk') || query.includes('harm') || 
      query.includes('safety') || query.includes('ethics') ||
      query.includes('ethical') || query.includes('danger') ||
      query.includes('could hurt')) {
    return 'HUMAN_HARM_CHECK';
  }

  // SYNTHESIS methods
  if (query.includes('synthesis') || query.includes('integrate')) {
    return 'SIMPLE_SYNTHESIS'; // Default; SYNTHESIS_ALL handled by server based on session
  }

  // FULL: deep dive / comprehensive request
  if (query.includes('deep dive') || query.includes('comprehensive') || 
      query.includes('thorough') || query.includes('detailed')) {
    return 'FULL';
  }

  // Default
  return 'QUICK';
}

/**
 * Determine if SYNTHESIS_ALL should be used
 * Call this after analyses in a session
 */
export function shouldSuggestSynthesisAll(sessionAnalysisCount) {
  // After 2-3 analyses, offer SYNTHESIS_ALL
  return sessionAnalysisCount >= 2;
}

/**
 * Get human-readable method description
 */
export function getMethodDescription(method) {
  const descriptions = {
    QUICK: 'Quick analysis (200-400 words) - fast clarity on core tensions',
    FULL: 'Full analysis (600-800 words) - comprehensive multi-perspective view',
    CONFLICT_RESOLUTION: 'Conflict resolution - revealing both sides of gridlock',
    STAKEHOLDER_ANALYSIS: 'Stakeholder analysis - mapping multiple perspectives',
    PATTERN_RECOGNITION: 'Pattern recognition - uncovering recurring blind spots',
    SCENARIO_TEST: 'Scenario test - comparing options through perspectives',
    TIME_HORIZON: 'Time horizon - balancing short-term vs long-term needs',
    HUMAN_HARM_CHECK: 'Safety check - systematic risk and ethics assessment',
    SIMPLE_SYNTHESIS: 'Simple synthesis - three-level integration with vision',
    SYNTHESIS_ALL: 'Deep synthesis - integrating all prior conversations',
    INNER_PEACE_SYNTHESIS: 'Inner peace - resolving internal conflict with integration path',
    COACHING_PLAN: 'Coaching plan - structured development roadmap',
    SKILLS: 'Skills development - strengthening specific perspectives',
    NOTES_SUMMARY: 'Notes summary - organizing content through perspectives',
  };

  return descriptions[method] || 'Multi-perspective analysis';
}