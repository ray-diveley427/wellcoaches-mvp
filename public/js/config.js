// =====================================================================
// Multi-Perspective AI - Configuration
// =====================================================================
// Central configuration file for constants, methods, and mappings

// =====================================================================
// METHODS DATA WITH COMPLEXITY LEVELS
// =====================================================================
const METHODS = [
  { key: 'QUICK', name: 'QUICK', complexity: 1, complexityStars: '★☆☆☆☆', category: 'beginner', tag: 'BEGINNER', description: 'Get quick insights for daily decisions and straightforward situations. Perfect when you need guidance fast.' },
  { key: 'CONFLICT_RESOLUTION', name: 'CONFLICT', complexity: 2, complexityStars: '★★☆☆☆', category: 'beginner', tag: 'BEGINNER', description: 'Understand the core tension when you feel torn between two approaches. Validates both sides and finds a path forward.' },
  { key: 'STAKEHOLDER_ANALYSIS', name: 'STAKEHOLDER', complexity: 2, complexityStars: '★★☆☆☆', category: 'beginner', tag: 'BEGINNER', description: 'Understand perspectives of multiple people involved. Reveals hidden motivations and finds common ground.' },
  { key: 'NOTES_SUMMARY', name: 'NOTES SUMMARY', complexity: 2, complexityStars: '★★★☆☆', category: 'beginner', tag: 'BEGINNER', description: 'Organize any documents - for example, meeting notes, transcripts, or assessments - through relevant perspectives for clarity and insight.' },
  { key: 'PATTERN_RECOGNITION', name: 'PATTERN', complexity: 3, complexityStars: '★★★☆☆', category: 'intermediate', tag: 'INTERMEDIATE', description: 'Identify root causes of recurring problems and understand your role in perpetuating patterns.' },
  { key: 'SCENARIO_TEST', name: 'SCENARIO TEST', complexity: 3, complexityStars: '★★★☆☆', category: 'intermediate', tag: 'INTERMEDIATE', description: 'Thoroughly analyze 2-3 specific options to understand strengths, weaknesses, and hidden implications.' },
  { key: 'TIME_HORIZON', name: 'TIME HORIZON', complexity: 3, complexityStars: '★★★☆☆', category: 'intermediate', tag: 'INTERMEDIATE', description: 'Balance immediate needs with future consequences. See 1-year, 3-year, and 5-year perspectives.' },
  { key: 'HUMAN_HARM_CHECK', name: 'HUMAN HARM CHECK', complexity: 4, complexityStars: '★★★★☆', category: 'advanced', tag: 'ADVANCED', description: 'Comprehensive assessment of potential harms from major decisions. Identifies vulnerable populations and mitigation strategies.' },
  { key: 'FULL', name: 'FULL', complexity: 4, complexityStars: '★★★★☆', category: 'advanced', tag: 'ADVANCED', description: 'Full multi-perspective analysis considering all nine perspectives. For complex situations needing thorough understanding.' },
  { key: 'SIMPLE_SYNTHESIS', name: 'SYNTHESIS', complexity: 5, complexityStars: '★★★★★', category: 'advanced', tag: 'ADVANCED', description: 'Integrate insights from multiple analyses or explore across personal, relational, and systemic levels.' },
  { key: 'SYNTHESIS_ALL', name: 'SYNTHESIS (ALL)', complexity: 5, complexityStars: '★★★★★', category: 'advanced', tag: 'ADVANCED', description: 'Deep integration across individual, relational, and systemic levels. Most comprehensive analysis.' },
  { key: 'INNER_PEACE_SYNTHESIS', name: 'INNER PEACE SYNTHESIS', complexity: 5, complexityStars: '★★★★★', category: 'advanced', tag: 'ADVANCED', description: 'Resolve internal conflicts and improve well-being. Identify competing parts within yourself and find pathways to integration.' },
  { key: 'COACHING_PLAN', name: 'COACHING PLAN', complexity: 4, complexityStars: '★★★★☆', category: 'advanced', tag: 'ADVANCED', description: 'Transform analysis into actionable development plan with vision, strategies, and concrete next steps.' },
  { key: 'SKILLS', name: 'SKILLS', complexity: 4, complexityStars: '★★★★☆', category: 'advanced', tag: 'ADVANCED', description: 'Develop skills in applying any of the nine perspectives, based on the book: The Science of Leadership.' }
];

// =====================================================================
// FAQ MAPPINGS
// =====================================================================
const FAQ_MAPPINGS = {
  "What is Multi-Perspective AI?": "overview",
  "The Nine Perspectives": "dimensions",
  "Who is this for?": "applications",
  "Which method should I use?": "methods",
  "Privacy & data security": "privacy"
};

// =====================================================================
// PRO TOOLS CONFIGURATION
// =====================================================================
const PRO_TOOLS = {
  coach: [
    {
      name: 'Map to Competencies',
      badge: 'ICF & NBHWC',
      description: 'Maps the nine perspectives to both ICF Core Competencies and NBHWC Competencies for dual certification documentation.',
      activation: 'Map to competencies'
    },
    {
      name: 'Coherence Readiness Tool',
      badge: 'Breakthrough',
      description: 'Identifies which perspective holds the key pattern for breakthrough. Applies legitimacy-first principle.',
      activation: 'Find the coherence point'
    },
    {
      name: 'Moral Mindfulness Activation',
      badge: 'Discovery',
      description: 'Shifts from advice-giving to discovery-facilitation. Transforms perspectives into inquiry.',
      activation: 'Activate moral mindfulness'
    },
    {
      name: 'Future Self Exercise Tool',
      badge: 'Evolution',
      description: 'Projects perspectives forward to reveal potential evolution paths and future integration.',
      activation: 'Run Future Self exercise'
    },
    {
      name: 'Mentor Coaching Tool',
      badge: 'Development',
      description: 'Supports coaches in developing capacity to hold all nine perspectives while meeting competency requirements.',
      activation: 'Mentor coaching mode'
    },
    {
      name: 'Declipse Tool',
      badge: 'Declipse',
      description: 'Applies the Declipse methodology to generate powerful coaching questions aligned with ICF Core Competencies.',
      activation: 'Apply Declipse lens'
    }
  ],
  healthcare: [],
  leader: []
};

// =====================================================================
// EXPORTS (for ES6 modules or global access)
// =====================================================================
// Make constants available globally for vanilla JS usage
if (typeof window !== 'undefined') {
  window.METHODS = METHODS;
  window.FAQ_MAPPINGS = FAQ_MAPPINGS;
  window.PRO_TOOLS = PRO_TOOLS;
}
