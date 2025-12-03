import express from 'express';
import { findContactByEmail } from '../utils/keapIntegration.js';

const router = express.Router();

/**
 * POST /api/check-keap-email
 * Check if an email exists in Keap and has subscription tags
 * Body: { email: string }
 * Returns: { existsInKeap: boolean, hasSubscription: boolean, contactId: number|null }
 */
router.post('/', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email required'
      });
    }

    console.log(`🔍 Checking if ${email} exists in Keap...`);

    // Search for contact in Keap
    const contact = await findContactByEmail(email);

    if (!contact) {
      console.log(`⚠️ Email ${email} NOT found in Keap`);
      return res.json({
        success: true,
        existsInKeap: false,
        hasSubscription: false,
        contactId: null,
        message: 'Email not found in Keap. Please subscribe first.'
      });
    }

    console.log(`✅ Email ${email} found in Keap (Contact ID: ${contact.id})`);

    // Check if contact has any subscription tags
    const subscriptionTagIds = [24291, 24289, 24285, 24315]; // Staff, Student, Member, Non-Member
    const hasSubscription = contact.tag_ids?.some(tagId => subscriptionTagIds.includes(tagId)) || false;

    return res.json({
      success: true,
      existsInKeap: true,
      hasSubscription,
      contactId: contact.id,
      tags: contact.tag_ids || [],
      message: hasSubscription
        ? 'Contact found with active subscription'
        : 'Contact found but no active subscription. Please subscribe.'
    });

  } catch (error) {
    console.error('❌ Error checking Keap email:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check email in Keap',
      details: error.message
    });
  }
});

export default router;
