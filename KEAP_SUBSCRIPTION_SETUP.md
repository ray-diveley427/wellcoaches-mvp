# Keap Subscription Integration Setup Guide

## Overview

This guide walks you through completing the Keap subscription integration for Multi-Perspective AI.

## What's Already Done ✅

1. **Keap API credentials** added to `.env`
2. **Keap integration module** created (`utils/keapIntegration.js`)
3. **Subscription configuration** created (`utils/subscriptionConfig.js`)
4. **User management** with subscription support (`utils/userManager.js`)
5. **DynamoDB table setup script** (`scripts/createUsersTable.js`)

## Subscription Structure

### Free Tier
- **Price**: $0/month
- **AI Budget**: $5/month, $0.50/day
- **Methods**: QUICK, CONFLICT_RESOLUTION, STAKEHOLDER_ANALYSIS only
- **File Upload**: No
- **History**: 30 days

### Premium Tier
- **Price**: $10/month
- **AI Budget**: $50/month, $5/day
- **Methods**: All methods
- **File Upload**: Yes
- **History**: Unlimited

---

## Step 1: Create DynamoDB Users Table

Run this command to create the `mpai-users` table:

```bash
node scripts/createUsersTable.js
```

This creates a table with:
- Primary key: `user_id`
- Global secondary index on `email`
- Fields for subscription tracking

---

## Step 2: Set Up Keap Products & Tags

### A. Create Subscription Product in Keap

1. Log in to Keap at `my982.infusionsoft.com`
2. Go to **E-Commerce** → **Products**
3. Create new product:
   - Name: "Multi-Perspective AI Premium"
   - Type: Subscription
   - Price: $10.00
   - Billing Cycle: Monthly
   - Active: Yes

4. **Copy the Product ID** and update `utils/subscriptionConfig.js`:
   ```javascript
   export const KEAP_PRODUCT_IDS = {
     premium: 123 // Replace with actual product ID
   };
   ```

### B. Create Tags in Keap

Go to **CRM** → **Settings** → **Tags** and create these tags:

1. **MPAI - Free User**
2. **MPAI - Premium User**
3. **MPAI - Canceled**
4. **MPAI - New Signup**

**Copy the Tag IDs** and update `utils/subscriptionConfig.js`:
```javascript
export const KEAP_TAG_IDS = {
  free: 456,       // Replace with actual tag IDs
  premium: 457,
  canceled: 458,
  new_signup: 459
};
```

### C. (Optional) Create Custom Fields

If you want to track subscription data in Keap custom fields:

1. Go to **CRM** → **Settings** → **Custom Fields**
2. Create these fields for Contacts:
   - `subscription_tier` (Text)
   - `subscription_status` (Dropdown: active, canceled, past_due)
   - `subscription_start_date` (Date)
   - `monthly_usage` (Number)

3. Update `utils/subscriptionConfig.js` with the field IDs.

---

## Step 3: Configure Redirect URI in Keap

1. Go to https://keys.developer.keap.com/
2. Select your "wellcoachesschool" app
3. Add Redirect URI:
   - `https://multi-perspective.ai/api/keap/callback`
   - (For testing: `http://localhost:3000/api/keap/callback`)

---

## Step 4: Authenticate with Keap (One-Time Setup)

You need to authorize the app to access your Keap account:

### Create Admin Auth Endpoint (Temporary)

Add this to your `server.mjs`:

```javascript
import { getAuthorizationUrl, exchangeCodeForToken } from './utils/keapIntegration.js';

// Admin-only route to start Keap OAuth
app.get('/admin/keap/authorize', (req, res) => {
  const authUrl = getAuthorizationUrl();
  res.redirect(authUrl);
});

// Keap OAuth callback
app.get('/api/keap/callback', async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).send('Missing authorization code');
    }

    const tokens = await exchangeCodeForToken(code);

    // TODO: Store tokens in DynamoDB or environment
    // For now, they're stored in memory (will be lost on restart)

    res.send(`
      <h1>Keap Authorization Successful!</h1>
      <p>Access token obtained and stored.</p>
      <p>You can close this window.</p>
    `);
  } catch (error) {
    console.error('Keap callback error:', error);
    res.status(500).send('Authorization failed: ' + error.message);
  }
});
```

### Authorize the App

1. Visit: `https://multi-perspective.ai/admin/keap/authorize`
2. Log in to Keap and approve access
3. You'll be redirected back with tokens stored

**Important**: The tokens are currently stored in memory. For production, you should store them in DynamoDB or AWS Secrets Manager.

---

## Step 5: Test Keap Integration

Create a test endpoint in `server.mjs`:

```javascript
import { createOrUpdateContact, syncSubscriptionToKeap } from './utils/keapIntegration.js';

app.post('/admin/test-keap', async (req, res) => {
  try {
    const testUser = {
      email: 'test@example.com',
      given_name: 'Test',
      family_name: 'User'
    };

    const contact = await createOrUpdateContact(testUser);

    res.json({
      success: true,
      message: 'Contact created/updated in Keap',
      contact
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
```

Test it:
```bash
curl -X POST https://multi-perspective.ai/admin/test-keap
```

---

## Step 6: Create Subscription Payment Page

You have two options:

### Option A: Use Keap Order Forms (Easier)

1. In Keap, go to **Marketing** → **Order Forms**
2. Create a new order form for the Premium subscription
3. Add your Premium product
4. Configure success/failure pages
5. Embed or link to this form from your app

### Option B: Build Custom Checkout (More Control)

Create a subscription checkout page that:
1. Collects payment via Keap's payment API
2. Creates the subscription
3. Updates DynamoDB with subscription data
4. Syncs to Keap

---

## Step 7: Handle Subscription Events

### Keap Webhook Setup

1. In Keap, go to **Settings** → **Application** → **Webhooks**
2. Create webhook for these events:
   - Order Placed
   - Subscription Renewed
   - Subscription Canceled
   - Payment Failed

3. Webhook URL: `https://multi-perspective.ai/api/webhooks/keap`

### Create Webhook Handler

Add to `server.mjs`:

```javascript
import { updateSubscription } from './utils/userManager.js';

app.post('/api/webhooks/keap', express.json(), async (req, res) => {
  try {
    const { event_key, object_keys } = req.body;

    console.log('Keap webhook received:', event_key);

    // Handle different events
    switch (event_key) {
      case 'order.add':
        // New subscription purchased
        // Update user to premium
        break;

      case 'subscription.deactivate':
        // Subscription canceled
        // Downgrade user to free
        break;

      case 'invoice.add.payment':
        // Payment received
        // Ensure subscription is active
        break;

      default:
        console.log('Unhandled webhook event:', event_key);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});
```

---

## Step 8: Update Your App to Use Subscriptions

### In `server.mjs`, update the analyze endpoint:

```javascript
import { getOrCreateUser } from './utils/userManager.js';
import { getCostLimits, canUseMethod } from './utils/subscriptionConfig.js';

app.post('/api/analyze', async (req, res) => {
  try {
    const userId = req.user.sub; // From Cognito

    // Get or create user with subscription info
    const user = await getOrCreateUser({
      user_id: userId,
      email: req.user.email,
      given_name: req.user.given_name,
      family_name: req.user.family_name
    });

    // Check if user can use the requested method
    const methodAllowed = canUseMethod(user.subscription_tier, req.body.method);

    if (!methodAllowed) {
      return res.json({
        success: false,
        error: 'This method requires a Premium subscription',
        upgradeRequired: true
      });
    }

    // Get cost limits for user's tier
    const limits = getCostLimits(user.subscription_tier);

    // Check if user has exceeded limits
    if (user.monthly_cost >= limits.monthlyCost) {
      return res.json({
        success: false,
        costLimitExceeded: true,
        monthlyLimitExceeded: true,
        monthlyCost: user.monthly_cost,
        monthlyLimit: limits.monthlyCost
      });
    }

    // ... rest of your analyze logic
  } catch (error) {
    console.error('Analyze error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
```

---

## Next Steps

1. **Run the DynamoDB table creation script**
2. **Set up Keap products and tags** (get IDs)
3. **Update subscriptionConfig.js** with actual IDs
4. **Authorize the Keap integration**
5. **Create payment/checkout flow**
6. **Set up webhooks**
7. **Test the full flow**

---

## Testing Checklist

- [ ] DynamoDB users table created
- [ ] Keap authorization successful
- [ ] Can create contacts in Keap
- [ ] Tags apply correctly
- [ ] Free tier users blocked from premium methods
- [ ] Premium users can access all methods
- [ ] Cost limits enforce correctly
- [ ] Subscription upgrade flow works
- [ ] Webhooks update subscription status

---

## Support

If you encounter issues:
1. Check Keap API logs at `my982.infusionsoft.com`
2. Check CloudWatch logs for your API
3. Verify environment variables are set correctly
4. Test Keap API calls with Postman first

## Need More Features?

Future enhancements to consider:
- Annual billing (discount)
- Free trial period
- Usage-based billing
- Team/organization accounts
- API access tier
