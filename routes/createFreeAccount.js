import express from 'express';
import { createOrUpdateContact, findContactByEmail } from '../utils/keapIntegration.js';

const router = express.Router();

/**
 * POST /api/create-free-account
 * Create a free Keap account for existing users (grace period until Jan 15, 2026)
 * Body: { email: string, firstName: string, lastName: string }
 * Returns: { success: boolean, contactId: number, message: string }
 */
router.post('/', async (req, res) => {
  try {
    const { email, firstName, lastName } = req.body;

    if (!email || !firstName || !lastName) {
      return res.status(400).json({
        success: false,
        error: 'Email, first name, and last name are required'
      });
    }

    console.log(`📝 Creating free Keap account for ${email} (${firstName} ${lastName})...`);

    // First check if contact already exists in Keap
    const existingContact = await findContactByEmail(email);

    if (existingContact) {
      console.log(`⚠️ Contact ${email} already exists in Keap (ID: ${existingContact.id})`);
      return res.status(400).json({
        success: false,
        error: 'An account with this email already exists. Please sign in instead.',
        alreadyExists: true
      });
    }

    // Create contact in Keap without any subscription tags
    // This gives them free tier access with grace period until Jan 15, 2026
    const contact = await createOrUpdateContact({
      email,
      given_name: firstName,
      family_name: lastName
    });

    if (!contact || !contact.id) {
      throw new Error('Failed to create contact in Keap');
    }

    console.log(`✅ Free account created for ${email} (Contact ID: ${contact.id})`);

    return res.json({
      success: true,
      contactId: contact.id,
      message: 'Free account created successfully. You have access until January 15, 2026.'
    });

  } catch (error) {
    console.error('❌ Error creating free account:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create free account',
      details: error.message
    });
  }
});

export default router;
