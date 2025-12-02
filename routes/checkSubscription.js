import express from 'express';
import { getUser } from '../utils/userManager.js';

const router = express.Router();

/**
 * GET /api/check-subscription
 * Check if user has active subscription or is within grace period
 * Returns: { needsSubscription: boolean, gracePeriodEnd: string|null, tier: string }
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.query.userId;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID required'
      });
    }

    const user = await getUser(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const tier = user.subscription_tier || 'free';
    const gracePeriodEnd = user.grace_period_end || null;
    const now = new Date();

    // Check if user has a paid subscription tier
    const paidTiers = ['staff_complimentary', 'student', 'member', 'non_member'];
    const hasPaidSubscription = paidTiers.includes(tier);

    // Check if user is within grace period
    const hasGracePeriod = gracePeriodEnd && new Date(gracePeriodEnd) > now;

    // User needs subscription if:
    // 1. They have free tier AND
    // 2. They have no grace period OR grace period has expired
    const needsSubscription = tier === 'free' && !hasGracePeriod;

    res.json({
      success: true,
      needsSubscription,
      tier,
      gracePeriodEnd,
      hasGracePeriod,
      hasPaidSubscription
    });

  } catch (error) {
    console.error('❌ Error checking subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check subscription status'
    });
  }
});

export default router;
