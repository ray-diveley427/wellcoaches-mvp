# Keap Order Form Configuration

## Order Form Setup Instructions

For the Multi-Perspective AI integration to work properly, the Keap order forms need to be configured to redirect users back to the signup page after purchase.

### Forms to Configure:

1. **AI Wellcoaches Member Subscription**
   - URL: https://my982.infusionsoft.com/app/orderForms/AI-Wellcoaches-Member-Subscription
   - Product ID: 2915 (from Erika's screenshot)
   - Price: $10/month

2. **AI Non-member Subscription**
   - URL: https://my982.infusionsoft.com/app/orderForms/AI-Non-member-Subscription
   - Product ID: 2913 (from Erika's screenshot)
   - Price: $20/month

### Required Configuration for Each Form:

#### 1. Thank You Page / Redirect URL

Set the "Thank You Page" or "Redirect After Purchase" to:

**Member Form:**
```
https://multi-perspective.ai/signup?tier=member&source=keap
```

**Non-Member Form:**
```
https://multi-perspective.ai/signup?tier=non_member&source=keap
```

#### 2. Tags to Apply

Make sure each form applies the correct Keap tag on purchase:

**Member Form Should Apply:**
- Tag ID: 24285 - "AI Wellcoaches Member"
- Tag ID: 24313 - "AI Wellcoaches Member Record Created" (optional tracking tag)

**Non-Member Form Should Apply:**
- Tag ID: 24315 - "AI Wellcoaches Non-Member Record Created"

#### 3. Email Notifications

**Welcome Email Template** (to be added to Keap campaign):

```
Subject: Welcome to Multi-Perspective AI!

Hi [First Name],

Welcome to Multi-Perspective AI! You're all set to start getting AI-powered insights for your coaching practice.

## Next Step: Create Your Account

To access Multi-Perspective AI:

1. Visit https://multi-perspective.ai and click "Sign In" in the top right corner
2. Create your account using this email address: [Email]
3. You'll receive a verification code via email to confirm your account
4. Once verified, you'll have immediate access to the platform!

## What's Included:

- All 10 AI-powered analysis methods
- File upload support for coaching transcripts
- Unlimited conversation history
- [Member: Priority support | Non-Member: Email support]
- [Member: $50 | Non-Member: $100] monthly AI usage budget

## Need Help?

If you have any questions or need assistance, email us at mpai@wellcoaches.com

Best regards,
The Multi-Perspective AI Team
```

## How to Configure in Keap:

### Option 1: Via Keap Web Interface

1. Log into Keap at https://app.infusionsoft.com
2. Go to **E-Commerce** → **Order Forms**
3. Find the forms:
   - AI Wellcoaches Member Subscription
   - AI Non-member Subscription
4. Click **Edit** on each form
5. Find the **Thank You Page** or **Confirmation Settings** section
6. Set the redirect URL as shown above
7. In the **Automation** or **Campaign** section:
   - Ensure the correct tags are applied
   - Set up the welcome email sequence

### Option 2: Verify Current Settings

To check if forms are already configured correctly:

1. Make a test purchase (or use test mode if available)
2. Complete the checkout
3. Verify you're redirected to: `https://multi-perspective.ai/signup?tier=X&source=keap`
4. Check that the appropriate tag is applied to your test contact in Keap

## Testing Checklist:

- [ ] Member form redirects to signup page with `?tier=member&source=keap`
- [ ] Non-Member form redirects to signup page with `?tier=non_member&source=keap`
- [ ] Member form applies tag 24285 (AI Wellcoaches Member)
- [ ] Non-Member form applies tag 24315 (AI Wellcoaches Non-Member Record Created)
- [ ] Welcome email is sent after purchase
- [ ] User can create account using same email address
- [ ] User's account is automatically assigned correct tier on first login

## Support:

If you need help configuring these forms, contact:
- Erika (Keap administrator)
- Support: mpai@wellcoaches.com
