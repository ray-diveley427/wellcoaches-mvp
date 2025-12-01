// =====================================================================
// User Preferences API
// =====================================================================
// Handles user privacy and preference settings

import express from 'express';
import { getUser, updateConversationRetention } from '../utils/userManager.js';

const router = express.Router();

/**
 * GET /api/user/preferences
 * Get current user preferences
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.query.userId || req.body.userId;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID required' });
    }

    const user = await getUser(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({
      success: true,
      preferences: {
        conversation_retention_days: user.conversation_retention_days || 90
      }
    });
  } catch (error) {
    console.error('❌ Error getting user preferences:', error);
    res.status(500).json({ success: false, error: 'Failed to get preferences' });
  }
});

/**
 * PUT /api/user/preferences/retention
 * Update conversation retention preference
 */
router.put('/retention', async (req, res) => {
  try {
    const { userId, retentionDays } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID required' });
    }

    if (!retentionDays || (retentionDays !== 30 && retentionDays !== 90)) {
      return res.status(400).json({
        success: false,
        error: 'Retention days must be 30 or 90'
      });
    }

    const updatedUser = await updateConversationRetention(userId, retentionDays);

    res.json({
      success: true,
      message: `Conversation retention updated to ${retentionDays} days`,
      preferences: {
        conversation_retention_days: updatedUser.conversation_retention_days
      }
    });
  } catch (error) {
    console.error('❌ Error updating retention preference:', error);
    res.status(500).json({ success: false, error: 'Failed to update preference' });
  }
});

export default router;
