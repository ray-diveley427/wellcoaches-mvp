// =====================================================================
// Keap (Infusionsoft) Integration Module
// =====================================================================
// Handles contact management and tag-based access control using Personal Access Token

import fetch from 'node-fetch';
import { TAG_TO_TIER_MAP, SUBSCRIPTION_TIERS } from './subscriptionConfig.js';

const KEAP_API_BASE = 'https://api.infusionsoft.com/crm/rest/v1';
const KEAP_OAUTH_BASE = 'https://accounts.infusionsoft.com/app/oauth';

// Personal Access Token from environment
const PERSONAL_ACCESS_TOKEN = process.env.KEAP_PERSONAL_ACCESS_TOKEN;

// OAuth token storage (for future OAuth implementation if needed)
let accessToken = null;
let refreshToken = null;
let tokenExpiry = null;

/**
 * Get OAuth authorization URL for admin to authenticate
 */
export function getAuthorizationUrl() {
  const params = new URLSearchParams({
    client_id: process.env.KEAP_CLIENT_ID,
    redirect_uri: process.env.KEAP_REDIRECT_URI,
    response_type: 'code',
    scope: 'full'
  });

  return `${KEAP_OAUTH_BASE}/authorize?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 * Call this from your /api/keap/callback endpoint
 */
export async function exchangeCodeForToken(code) {
  try {
    const response = await fetch(`${KEAP_OAUTH_BASE}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: process.env.KEAP_CLIENT_ID,
        client_secret: process.env.KEAP_CLIENT_SECRET,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: process.env.KEAP_REDIRECT_URI
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    const data = await response.json();

    // Store tokens
    accessToken = data.access_token;
    refreshToken = data.refresh_token;
    tokenExpiry = Date.now() + (data.expires_in * 1000);

    console.log('✅ Keap tokens obtained successfully');
    return data;
  } catch (error) {
    console.error('❌ Keap token exchange error:', error);
    throw error;
  }
}

/**
 * Refresh access token using refresh token
 */
async function refreshAccessToken() {
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  try {
    const response = await fetch(`${KEAP_OAUTH_BASE}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: process.env.KEAP_CLIENT_ID,
        client_secret: process.env.KEAP_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      })
    });

    if (!response.ok) {
      throw new Error('Token refresh failed');
    }

    const data = await response.json();
    accessToken = data.access_token;
    refreshToken = data.refresh_token;
    tokenExpiry = Date.now() + (data.expires_in * 1000);

    console.log('✅ Keap token refreshed');
    return data;
  } catch (error) {
    console.error('❌ Token refresh error:', error);
    throw error;
  }
}

/**
 * Get valid access token (refresh if expired, or use Personal Access Token)
 */
async function getValidToken() {
  // If Personal Access Token is available, use it
  if (PERSONAL_ACCESS_TOKEN) {
    return PERSONAL_ACCESS_TOKEN;
  }

  // Otherwise fall back to OAuth tokens
  if (!accessToken) {
    throw new Error('Not authenticated with Keap. Please authorize first or set KEAP_PERSONAL_ACCESS_TOKEN.');
  }

  // Refresh if token expires in less than 5 minutes
  if (tokenExpiry && Date.now() > (tokenExpiry - 300000)) {
    await refreshAccessToken();
  }

  return accessToken;
}

/**
 * Make authenticated request to Keap API
 */
async function keapRequest(endpoint, method = 'GET', body = null) {
  const token = await getValidToken();

  // Add timeout to prevent hanging requests
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    signal: controller.signal
  };

  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${KEAP_API_BASE}${endpoint}`, options);
    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Keap API error: ${response.status} - ${error}`);
    }

    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Keap API request timed out');
    }
    throw error;
  }
}

/**
 * Find contact by email
 */
export async function findContactByEmail(email) {
  try {
    const response = await keapRequest(`/contacts?email=${encodeURIComponent(email)}`);

    if (response.contacts && response.contacts.length > 0) {
      return response.contacts[0];
    }

    return null;
  } catch (error) {
    console.error('❌ Error finding contact:', error);
    return null;
  }
}

/**
 * Create or update contact in Keap
 */
export async function createOrUpdateContact(userData) {
  try {
    const { email, given_name, family_name, phone } = userData;

    // Check if contact exists
    const existingContact = await findContactByEmail(email);

    const contactData = {
      email_addresses: [{ email, field: 'EMAIL1' }],
      given_name: given_name || '',
      family_name: family_name || ''
    };

    if (phone) {
      contactData.phone_numbers = [{ number: phone, field: 'PHONE1' }];
    }

    if (existingContact) {
      // Update existing contact
      const updated = await keapRequest(`/contacts/${existingContact.id}`, 'PATCH', contactData);
      console.log(`✅ Updated Keap contact: ${email} (ID: ${existingContact.id})`);
      return updated;
    } else {
      // Create new contact
      const created = await keapRequest('/contacts', 'POST', contactData);
      console.log(`✅ Created Keap contact: ${email} (ID: ${created.id})`);
      return created;
    }
  } catch (error) {
    console.error('❌ Error creating/updating contact:', error);
    throw error;
  }
}

/**
 * Apply tag to contact
 */
export async function applyTag(contactId, tagId) {
  try {
    await keapRequest(`/contacts/${contactId}/tags`, 'POST', { tagIds: [tagId] });
    console.log(`✅ Applied tag ${tagId} to contact ${contactId}`);
    return true;
  } catch (error) {
    console.error('❌ Error applying tag:', error);
    throw error;
  }
}

/**
 * Remove tag from contact
 */
export async function removeTag(contactId, tagId) {
  try {
    await keapRequest(`/contacts/${contactId}/tags/${tagId}`, 'DELETE');
    console.log(`✅ Removed tag ${tagId} from contact ${contactId}`);
    return true;
  } catch (error) {
    console.error('❌ Error removing tag:', error);
    throw error;
  }
}

/**
 * Update custom field on contact
 */
export async function updateCustomField(contactId, fieldId, value) {
  try {
    const data = {
      custom_fields: [
        { id: fieldId, content: value }
      ]
    };

    await keapRequest(`/contacts/${contactId}`, 'PATCH', data);
    console.log(`✅ Updated custom field ${fieldId} on contact ${contactId}`);
    return true;
  } catch (error) {
    console.error('❌ Error updating custom field:', error);
    throw error;
  }
}

/**
 * Sync user subscription to Keap
 * This is the main function to call when subscription changes
 */
export async function syncSubscriptionToKeap(userData, subscriptionData) {
  try {
    const { email, given_name, family_name } = userData;
    const { tier, status, subscriptionId } = subscriptionData;

    // Create or update contact
    const contact = await createOrUpdateContact({ email, given_name, family_name });

    // Apply appropriate tags based on tier
    // You'll need to create these tags in Keap and get their IDs
    const TAG_IDS = {
      free: null, // Set this after creating tag in Keap
      premium: null, // Set this after creating tag in Keap
      canceled: null // Set this after creating tag in Keap
    };

    if (tier === 'premium' && status === 'active' && TAG_IDS.premium) {
      await applyTag(contact.id, TAG_IDS.premium);
    }

    if (status === 'canceled' && TAG_IDS.canceled) {
      await applyTag(contact.id, TAG_IDS.canceled);
    }

    // Update custom fields if you have them set up
    // Example: await updateCustomField(contact.id, CUSTOM_FIELD_ID, tier);

    console.log(`✅ Synced subscription for ${email} to Keap`);
    return contact;
  } catch (error) {
    console.error('❌ Error syncing subscription to Keap:', error);
    // Don't throw - subscription should work even if Keap sync fails
    return null;
  }
}

/**
 * Get tags for a contact
 */
export async function getContactTags(contactId) {
  try {
    const response = await keapRequest(`/contacts/${contactId}`);
    return response.tag_ids || [];
  } catch (error) {
    console.error('❌ Error getting contact tags:', error);
    return [];
  }
}

/**
 * Get user's subscription tier based on their Keap tags
 * This is the main function to call on login
 */
export async function getUserSubscriptionTier(email) {
  try {
    // Find contact by email
    const contact = await findContactByEmail(email);

    if (!contact) {
      console.log(`⚠️ Contact not found in Keap for ${email}, using free tier`);
      return SUBSCRIPTION_TIERS.FREE;
    }

    // Get contact's tags
    const tagIds = contact.tag_ids || [];

    if (tagIds.length === 0) {
      console.log(`⚠️ No tags found for ${email}, using free tier`);
      return SUBSCRIPTION_TIERS.FREE;
    }

    // Check tags in priority order
    for (const [tagId, tier] of Object.entries(TAG_TO_TIER_MAP)) {
      if (tagIds.includes(parseInt(tagId))) {
        console.log(`✅ User ${email} has tier: ${tier} (tag ${tagId})`);
        return tier;
      }
    }

    // No matching tags found
    console.log(`⚠️ No matching subscription tags for ${email}, using free tier`);
    return SUBSCRIPTION_TIERS.FREE;
  } catch (error) {
    console.error('❌ Error getting user subscription tier:', error);
    // Fail open - allow access with free tier
    return SUBSCRIPTION_TIERS.FREE;
  }
}

/**
 * Get current authentication status
 */
export function isAuthenticated() {
  return !!accessToken || !!PERSONAL_ACCESS_TOKEN;
}

/**
 * Manually set tokens (for loading from database)
 */
export function setTokens(access, refresh, expiry) {
  accessToken = access;
  refreshToken = refresh;
  tokenExpiry = expiry;
}
