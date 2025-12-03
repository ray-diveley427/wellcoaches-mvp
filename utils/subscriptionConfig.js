// =====================================================================
// Subscription Configuration
// =====================================================================
// Defines subscription tiers, pricing, and feature access based on Keap tags

export const SUBSCRIPTION_TIERS = {
  STAFF_COMPLIMENTARY: 'staff_complimentary',
  STUDENT: 'student',
  NON_MEMBER: 'non_member',
  MEMBER: 'member',
  FREE: 'free' // Fallback for users without tags
};

export const SUBSCRIPTION_STATUS = {
  ACTIVE: 'active',
  CANCELED: 'canceled',
  PAST_DUE: 'past_due',
  TRIAL: 'trial'
};

// Subscription tier details based on Erika's requirements
export const TIER_CONFIG = {
  staff_complimentary: {
    name: 'Wellcoaches Staff/Complimentary',
    price: 0,
    billingPeriod: null,
    expirationDays: null, // No expiration
    limits: {
      dailyCost: null,      // Unlimited
      monthlyCost: null,    // Unlimited
      maxMessages: null
    },
    features: {
      methods: 'all',
      fileUpload: true,
      historyLimit: null,
      support: 'priority'
    },
    description: 'Full complimentary access for Wellcoaches staff'
  },
  student: {
    name: 'Wellcoaches Student',
    price: 0,
    billingPeriod: null,
    expirationDays: null, // Ends at Certification (handled by tag removal)
    limits: {
      dailyCost: null,      // Unlimited during access period
      monthlyCost: null,
      maxMessages: null
    },
    features: {
      methods: 'all',
      fileUpload: true,
      historyLimit: null,
      support: 'email'
    },
    description: 'Free access for students from Module 3 until Certification'
  },
  non_member: {
    name: 'Non-Member',
    price: 20.00,
    billingPeriod: 'month',
    limits: {
      dailyCost: 10.00,
      monthlyCost: 100.00,
      maxMessages: null
    },
    features: {
      methods: 'all',
      fileUpload: true,
      historyLimit: null,
      support: 'email'
    },
    description: 'Full access at $20/month for non-members'
  },
  member: {
    name: 'Wellcoaches Member',
    price: 10.00,
    billingPeriod: 'month',
    limits: {
      dailyCost: 5.00,
      monthlyCost: 50.00,
      maxMessages: null
    },
    features: {
      methods: 'all',
      fileUpload: true,
      historyLimit: null,
      support: 'priority'
    },
    description: 'Member pricing at $10/month'
  },
  free: {
    name: 'Free Trial',
    price: 0,
    billingPeriod: null,
    limits: {
      dailyCost: 0.50,
      monthlyCost: 5.00,
      maxMessages: null
    },
    features: {
      methods: ['QUICK', 'CONFLICT_RESOLUTION', 'STAKEHOLDER_ANALYSIS'],
      fileUpload: false,
      historyLimit: 30,
      support: 'email'
    },
    description: 'Limited free access for users without tags'
  }
};

/**
 * Check if user's subscription allows a specific method
 */
export function canUseMethod(subscriptionTier, methodKey) {
  const tier = subscriptionTier || SUBSCRIPTION_TIERS.FREE;
  const config = TIER_CONFIG[tier];

  if (!config) return false;

  if (config.features.methods === 'all') {
    return true;
  }

  if (Array.isArray(config.features.methods)) {
    return config.features.methods.includes(methodKey);
  }

  return false;
}

/**
 * Get cost limits for subscription tier
 */
export function getCostLimits(subscriptionTier) {
  const tier = subscriptionTier || SUBSCRIPTION_TIERS.FREE;
  const config = TIER_CONFIG[tier];

  return config ? config.limits : TIER_CONFIG.free.limits;
}

/**
 * Get readable subscription tier name
 */
export function getTierName(tier) {
  const config = TIER_CONFIG[tier];
  return config ? config.name : 'Free';
}

/**
 * Get all available methods for a tier
 */
export function getAvailableMethods(subscriptionTier) {
  const tier = subscriptionTier || SUBSCRIPTION_TIERS.FREE;
  const config = TIER_CONFIG[tier];

  if (!config) return TIER_CONFIG.free.features.methods;

  return config.features.methods;
}

/**
 * Check if user can upload files
 */
export function canUploadFiles(subscriptionTier) {
  const tier = subscriptionTier || SUBSCRIPTION_TIERS.FREE;
  const config = TIER_CONFIG[tier];

  return config ? config.features.fileUpload : false;
}

/**
 * Keap Order Form URLs
 * Retrieved from Erika on 2025-11-26
 */
export const KEAP_ORDER_FORM_URLS = {
  member: 'https://my982.infusionsoft.com/app/orderForms/AI-Wellcoaches-Member-Subscription',
  non_member: 'https://my982.infusionsoft.com/app/orderForms/AI-Non-member-Subscription'
};

/**
 * Keap Tag IDs - Maps tags to subscription tiers
 * Retrieved from Keap on 2025-11-25
 */
export const KEAP_TAG_IDS = {
  staff_complimentary: 24291,  // AI Wellcoaches Staff (includes complimentary)
  student: 24289,              // AI Wellcoaches Student
  non_member: 24315,           // AI Wellcoaches Non-Member Record Created
  member: 24285,               // AI Wellcoaches Member
  canceled: 24319,             // AI Wellcoaches Subscription Cancelled
  member_record_created: 24313,// AI Wellcoaches Member Record Created
  third_party_paid: 24317      // 3rd Party Paid AI Wellcoaches
};

/**
 * Map Keap tag IDs to subscription tiers
 * Priority order matters - if user has multiple tags, use the first match
 */
export const TAG_TO_TIER_MAP = {
  [KEAP_TAG_IDS.staff_complimentary]: SUBSCRIPTION_TIERS.STAFF_COMPLIMENTARY,
  [KEAP_TAG_IDS.student]: SUBSCRIPTION_TIERS.STUDENT,
  [KEAP_TAG_IDS.member]: SUBSCRIPTION_TIERS.MEMBER,
  [KEAP_TAG_IDS.non_member]: SUBSCRIPTION_TIERS.NON_MEMBER
};

/**
 * Keap Custom Field IDs (optional - create in Keap if needed)
 */
export const KEAP_CUSTOM_FIELDS = {
  subscription_tier: 'PLACEHOLDER',
  subscription_status: 'PLACEHOLDER',
  subscription_start_date: 'PLACEHOLDER',
  monthly_usage: 'PLACEHOLDER'
};
