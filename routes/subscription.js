// =====================================================================
// Subscription Routes
// =====================================================================
// Handles subscription management, Keap OAuth, and webhooks

import express from 'express';
import {
  getOrCreateUser,
  updateSubscription,
  getUser
} from '../utils/userManager.js';
import {
  getAuthorizationUrl,
  exchangeCodeForToken,
  syncSubscriptionToKeap,
  isAuthenticated
} from '../utils/keapIntegration.js';
import {
  SUBSCRIPTION_TIERS,
  SUBSCRIPTION_STATUS,
  TIER_CONFIG,
  KEAP_ORDER_FORM_URLS
} from '../utils/subscriptionConfig.js';

const router = express.Router();

/**
 * Get current user's subscription status
 * GET /api/subscription/status
 */
router.get('/status', async (req, res) => {
  try {
    // Get user ID from Cognito token (you'll need to add auth middleware)
    const userId = req.user?.sub;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    const user = await getUser(userId);

    if (!user) {
      return res.json({
        success: true,
        subscription: {
          tier: SUBSCRIPTION_TIERS.FREE,
          status: SUBSCRIPTION_STATUS.ACTIVE,
          limits: TIER_CONFIG.free.limits,
          features: TIER_CONFIG.free.features,
          usage: {
            monthly: 0,
            daily: 0
          }
        }
      });
    }

    const tierConfig = TIER_CONFIG[user.subscription_tier] || TIER_CONFIG.free;

    res.json({
      success: true,
      subscription: {
        tier: user.subscription_tier,
        status: user.subscription_status,
        limits: tierConfig.limits,
        features: tierConfig.features,
        usage: {
          monthly: user.monthly_cost || 0,
          daily: user.daily_cost || 0
        },
        percentUsed: {
          monthly: ((user.monthly_cost || 0) / tierConfig.limits.monthlyCost * 100).toFixed(1),
          daily: ((user.daily_cost || 0) / tierConfig.limits.dailyCost * 100).toFixed(1)
        }
      }
    });
  } catch (error) {
    console.error('❌ Error getting subscription status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get subscription status'
    });
  }
});

/**
 * Upgrade to Premium (creates Keap order form redirect)
 * POST /api/subscription/upgrade
 */
router.post('/upgrade', async (req, res) => {
  try {
    const userId = req.user?.sub;
    const userEmail = req.user?.email;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    // Return the Keap order form URL for member subscription
    const orderFormUrl = KEAP_ORDER_FORM_URLS.member
      ? `${KEAP_ORDER_FORM_URLS.member}?inf_field_Email=${encodeURIComponent(userEmail)}`
      : '/subscription/upgrade-placeholder';

    res.json({
      success: true,
      redirectUrl: orderFormUrl,
      isPlaceholder: !KEAP_ORDER_FORM_URLS.member
    });
  } catch (error) {
    console.error('❌ Error upgrading subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upgrade subscription'
    });
  }
});

/**
 * Cancel subscription
 * POST /api/subscription/cancel
 */
router.post('/cancel', async (req, res) => {
  try {
    const userId = req.user?.sub;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    const user = await getUser(userId);

    if (!user || user.subscription_tier === SUBSCRIPTION_TIERS.FREE) {
      return res.json({
        success: false,
        error: 'No active subscription to cancel'
      });
    }

    // Update subscription to canceled
    await updateSubscription(userId, {
      status: SUBSCRIPTION_STATUS.CANCELED
    });

    // Sync to Keap
    if (isAuthenticated()) {
      await syncSubscriptionToKeap(
        { email: user.email, given_name: user.given_name, family_name: user.family_name },
        { tier: user.subscription_tier, status: SUBSCRIPTION_STATUS.CANCELED }
      );
    }

    res.json({
      success: true,
      message: 'Subscription canceled. You will retain access until the end of your billing period.'
    });
  } catch (error) {
    console.error('❌ Error canceling subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel subscription'
    });
  }
});

/**
 * Admin: Start Keap OAuth flow
 * GET /admin/keap/authorize
 */
router.get('/admin/keap/authorize', (req, res) => {
  const authUrl = getAuthorizationUrl();
  res.redirect(authUrl);
});

/**
 * Keap OAuth callback
 * GET /api/keap/callback
 */
router.get('/keap/callback', async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).send('Missing authorization code');
    }

    await exchangeCodeForToken(code);

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Keap Authorization Successful</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 600px;
            margin: 100px auto;
            padding: 2rem;
            text-align: center;
          }
          .success {
            background: #10b981;
            color: white;
            padding: 1rem 2rem;
            border-radius: 8px;
            margin-bottom: 1rem;
          }
          .info {
            background: #f3f4f6;
            padding: 1rem;
            border-radius: 8px;
            color: #374151;
          }
        </style>
      </head>
      <body>
        <h1>✅ Keap Authorization Successful!</h1>
        <div class="success">
          <p>Access token obtained and stored successfully.</p>
        </div>
        <div class="info">
          <p>Your Multi-Perspective AI app is now connected to Keap.</p>
          <p>You can close this window.</p>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('❌ Keap callback error:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Authorization Failed</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 600px;
            margin: 100px auto;
            padding: 2rem;
            text-align: center;
          }
          .error {
            background: #ef4444;
            color: white;
            padding: 1rem 2rem;
            border-radius: 8px;
          }
        </style>
      </head>
      <body>
        <h1>❌ Authorization Failed</h1>
        <div class="error">
          <p>${error.message}</p>
        </div>
      </body>
      </html>
    `);
  }
});

/**
 * Keap webhook handler
 * POST /api/webhooks/keap
 */
router.post('/webhooks/keap', express.json(), async (req, res) => {
  try {
    const { event_key, object_keys } = req.body;

    console.log('📥 Keap webhook received:', event_key, object_keys);

    // Handle different Keap events
    switch (event_key) {
      case 'order.add':
        // New subscription purchased
        console.log('💳 New order placed');
        // TODO: Update user to premium tier
        break;

      case 'subscription.deactivate':
        // Subscription canceled
        console.log('🚫 Subscription deactivated');
        // TODO: Downgrade user to free tier
        break;

      case 'invoice.add.payment':
        // Payment received
        console.log('✅ Payment received');
        // TODO: Ensure subscription is active
        break;

      default:
        console.log('ℹ️ Unhandled webhook event:', event_key);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Admin: Manually update user subscription (for testing)
 * POST /admin/subscription/update
 */
router.post('/admin/subscription/update', express.json(), async (req, res) => {
  try {
    const { userId, tier, status } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId required'
      });
    }

    const updated = await updateSubscription(userId, {
      tier: tier || SUBSCRIPTION_TIERS.PREMIUM,
      status: status || SUBSCRIPTION_STATUS.ACTIVE
    });

    res.json({
      success: true,
      user: updated
    });
  } catch (error) {
    console.error('❌ Error updating subscription:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
