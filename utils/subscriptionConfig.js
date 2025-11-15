// =====================================================================
// Subscription Configuration
// =====================================================================
// Defines subscription tiers, pricing, and feature access

export const SUBSCRIPTION_TIERS = {
  FREE: 'free',
  PREMIUM: 'premium'
};

export const SUBSCRIPTION_STATUS = {
  ACTIVE: 'active',
  CANCELED: 'canceled',
  PAST_DUE: 'past_due',
  TRIAL: 'trial'
};

// Subscription tier details
export const TIER_CONFIG = {
  free: {
    name: 'Free',
    price: 0,
    billingPeriod: 'month',
    limits: {
      dailyCost: 0.50,      // $0.50 per day
      monthlyCost: 5.00,    // $5.00 per month
      maxMessages: null      // No hard message limit, just cost
    },
    features: {
      methods: ['QUICK', 'CONFLICT_RESOLUTION', 'STAKEHOLDER_ANALYSIS'],
      fileUpload: false,
      historyLimit: 30,      // Days of history
      support: 'email'
    },
    description: 'Get started with basic multi-perspective analysis'
  },
  premium: {
    name: 'Premium',
    price: 10.00,
    billingPeriod: 'month',
    limits: {
      dailyCost: 5.00,      // $5.00 per day
      monthlyCost: 50.00,   // $50.00 per month
      maxMessages: null
    },
    features: {
      methods: 'all',        // All methods available
      fileUpload: true,
      historyLimit: null,    // Unlimited history
      support: 'priority'
    },
    description: 'Full access to all methods and features'
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
 * Keap Product IDs (to be filled in after creating products in Keap)
 *
 * SETUP INSTRUCTIONS:
 * 1. Go to my982.infusionsoft.com
 * 2. Create product: "Multi-Perspective AI Premium" - $10/month subscription
 * 3. Get the Product ID and replace 'PLACEHOLDER' below
 */
export const KEAP_PRODUCT_IDS = {
  premium: 'PLACEHOLDER'  // TODO: Replace with actual Keap product ID
};

/**
 * Keap Order Form URL
 *
 * SETUP INSTRUCTIONS:
 * 1. In Keap, create an Order Form for the Premium product
 * 2. Get the form URL and replace below
 */
export const KEAP_ORDER_FORM_URL = 'https://my982.infusionsoft.com/app/orderForms/PLACEHOLDER';

/**
 * Keap Tag IDs (to be filled in after creating tags in Keap)
 *
 * SETUP INSTRUCTIONS:
 * 1. Go to Keap → CRM → Settings → Tags
 * 2. Create these tags and get their IDs:
 */
export const KEAP_TAG_IDS = {
  free: 'PLACEHOLDER',       // TODO: Create "MPAI - Free User" tag
  premium: 'PLACEHOLDER',    // TODO: Create "MPAI - Premium User" tag
  canceled: 'PLACEHOLDER',   // TODO: Create "MPAI - Canceled" tag
  new_signup: 'PLACEHOLDER'  // TODO: Create "MPAI - New Signup" tag
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
