// =====================================================================
// Usage Limit Checker
// =====================================================================
// Checks if users have exceeded their tier limits and sends notifications

import { TIER_CONFIG, getTierName } from './subscriptionConfig.js';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const sesClient = new SESClient({ region: process.env.AWS_REGION || 'us-east-1' });
const FROM_EMAIL = process.env.ERROR_NOTIFICATION_FROM_EMAIL || 'mpai@wellcoaches.com';
const ADMIN_NOTIFICATION_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL || 'mpai@wellcoaches.com';

/**
 * Check if user has exceeded their monthly limit
 * Returns object with:
 *  - blocked: boolean - whether user should be blocked (at 100%)
 *  - percentUsed: number - percentage of limit used
 *  - reason: string - friendly message for user
 *  - shouldNotify: boolean - whether to send notification (at 60%, 80%, 100%)
 */
export function checkUserLimit(user) {
  const tier = user.subscription_tier || 'free';
  const tierConfig = TIER_CONFIG[tier];

  if (!tierConfig) {
    console.warn(`⚠️ Unknown tier: ${tier}, defaulting to free`);
    return {
      blocked: false,
      percentUsed: 0,
      reason: null,
      shouldNotify: false
    };
  }

  // Check for grace period - if user has grace period, treat as unlimited
  if (user.grace_period_end) {
    const gracePeriodEnd = new Date(user.grace_period_end);
    const now = new Date();

    if (gracePeriodEnd > now) {
      console.log(`✅ User ${user.email} within grace period until ${user.grace_period_end}`);
      return {
        blocked: false,
        percentUsed: 0,
        reason: null,
        shouldNotify: false,
        gracePeriod: true
      };
    } else {
      console.log(`⚠️ User ${user.email} grace period expired on ${user.grace_period_end}`);
    }
  }

  // Staff and students have unlimited access
  if (tierConfig.limits.monthlyCost === null) {
    return {
      blocked: false,
      percentUsed: 0,
      reason: null,
      shouldNotify: false
    };
  }

  const monthlyCost = parseFloat(user.monthly_cost || 0);
  const monthlyLimit = parseFloat(tierConfig.limits.monthlyCost);
  const percentUsed = (monthlyCost / monthlyLimit) * 100;

  // Block at 100% threshold
  if (percentUsed >= 100) {
    const tierName = getTierName(tier);
    const upgradePath = tier === 'free'
      ? 'Please subscribe to continue using Multi-Perspective AI.'
      : 'Please upgrade your subscription or wait until next month when your limit resets.';

    return {
      blocked: true,
      percentUsed: percentUsed.toFixed(1),
      monthlyCost: monthlyCost.toFixed(2),
      monthlyLimit: monthlyLimit.toFixed(2),
      tierName,
      reason: `You've reached your monthly budget limit ($${monthlyLimit.toFixed(2)}). ${upgradePath}`,
      shouldNotify: true
    };
  }

  // Alert at 80%
  if (percentUsed >= 80) {
    const tierName = getTierName(tier);
    return {
      blocked: false,
      percentUsed: percentUsed.toFixed(1),
      monthlyCost: monthlyCost.toFixed(2),
      monthlyLimit: monthlyLimit.toFixed(2),
      tierName,
      reason: `You've used $${monthlyCost.toFixed(2)} of your $${monthlyLimit.toFixed(2)} monthly budget (${percentUsed.toFixed(1)}%). Consider upgrading to avoid interruption.`,
      shouldNotify: percentUsed >= 80 && percentUsed < 85 // Only notify once around 80%
    };
  }

  // Warn at 60%
  if (percentUsed >= 60) {
    return {
      blocked: false,
      percentUsed: percentUsed.toFixed(1),
      monthlyCost: monthlyCost.toFixed(2),
      monthlyLimit: monthlyLimit.toFixed(2),
      reason: `You've used ${percentUsed.toFixed(1)}% of your monthly budget. Consider upgrading for higher limits.`,
      shouldNotify: percentUsed >= 60 && percentUsed < 65 // Only notify once around 60%
    };
  }

  return {
    blocked: false,
    percentUsed: percentUsed.toFixed(1),
    reason: null,
    shouldNotify: false
  };
}

/**
 * Send email notification to user about their usage
 */
export async function notifyUserOfLimit(user, limitInfo) {
  if (!user.email || user.email.includes('@temp.local')) {
    console.log('⚠️ No email for user, skipping notification');
    return;
  }

  try {
    const { blocked, percentUsed, monthlyCost, monthlyLimit, tierName } = limitInfo;
    const userName = user.given_name || 'there';

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: ${blocked ? '#dc2626' : '#f59e0b'}; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
    .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
    .highlight { background: #fff3cd; padding: 15px; border-left: 4px solid #f59e0b; margin: 20px 0; }
    .cta-button { display: inline-block; background: #14b8a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600; }
    .stats { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; }
    .footer { text-align: center; color: #6b7280; font-size: 0.875rem; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0;">${blocked ? '⚠️ Usage Limit Reached' : '📊 Usage Alert'}</h2>
    </div>
    <div class="content">
      <p>Hi ${userName},</p>

      <p>${blocked ?
        'Your Multi-Perspective AI account has reached its monthly usage limit and access has been temporarily paused.' :
        'Your Multi-Perspective AI usage is approaching your monthly limit.'
      }</p>

      <div class="stats">
        <p style="margin: 0 0 10px 0;"><strong>Current Usage:</strong></p>
        <p style="margin: 0; font-size: 1.5rem; color: ${blocked ? '#dc2626' : '#f59e0b'};">
          <strong>$${monthlyCost} / $${monthlyLimit}</strong> (${percentUsed}%)
        </p>
        <p style="margin: 10px 0 0 0; color: #6b7280;">Plan: ${tierName}</p>
      </div>

      ${blocked ? `
      <div class="highlight">
        <p><strong>What happens now?</strong></p>
        <p>To continue using Multi-Perspective AI, you can:</p>
        <ul>
          <li>Upgrade your subscription for higher limits</li>
          <li>Wait until your limit resets next month</li>
        </ul>
      </div>
      ` : `
      <div class="highlight">
        <p><strong>What should you do?</strong></p>
        <p>Consider upgrading your subscription to avoid any interruption in service.</p>
      </div>
      `}

      <div style="text-align: center;">
        <a href="https://multi-perspective.ai/pricing.html" class="cta-button">View Subscription Options</a>
      </div>

      <p>If you have any questions, please contact us at <a href="mailto:mpai@wellcoaches.com">mpai@wellcoaches.com</a></p>

      <div class="footer">
        <p>Multi-Perspective AI by Wellcoaches</p>
      </div>
    </div>
  </div>
</body>
</html>
    `;

    const textBody = `
Multi-Perspective AI ${blocked ? 'Usage Limit Reached' : 'Usage Alert'}

Hi ${userName},

${blocked ?
  'Your Multi-Perspective AI account has reached its monthly usage limit and access has been temporarily paused.' :
  'Your Multi-Perspective AI usage is approaching your monthly limit.'
}

Current Usage: $${monthlyCost} / $${monthlyLimit} (${percentUsed}%)
Plan: ${tierName}

${blocked ?
  'To continue using Multi-Perspective AI, please upgrade your subscription or wait until your limit resets next month.' :
  'Consider upgrading your subscription to avoid any interruption in service.'
}

View subscription options: https://multi-perspective.ai/pricing.html

Questions? Contact us at mpai@wellcoaches.com

Multi-Perspective AI by Wellcoaches
    `;

    const params = {
      Source: FROM_EMAIL,
      Destination: {
        ToAddresses: [user.email],
      },
      Message: {
        Subject: {
          Data: `[Multi-Perspective AI] ${blocked ? 'Usage Limit Reached' : 'Usage Alert'} - ${percentUsed}% Used`,
        },
        Body: {
          Html: {
            Data: htmlBody,
          },
          Text: {
            Data: textBody,
          },
        },
      },
    };

    await sesClient.send(new SendEmailCommand(params));
    console.log(`📧 Usage limit notification sent to ${user.email}`);
  } catch (err) {
    console.error('❌ Failed to send usage limit notification:', err.message);
  }
}

/**
 * Send notification to admins about user hitting limit
 */
export async function notifyAdminsOfUserLimit(user, limitInfo) {
  if (!ADMIN_NOTIFICATION_EMAIL) {
    console.log('⚠️ No admin notification email configured');
    return;
  }

  try {
    const { blocked, percentUsed, monthlyCost, monthlyLimit, tierName } = limitInfo;

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1e0a29; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
    .user-info { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid ${blocked ? '#dc2626' : '#f59e0b'}; }
    .label { font-weight: bold; color: #6b7280; }
    .value { margin-top: 5px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0;">${blocked ? '🚫' : '⚠️'} User ${blocked ? 'Blocked' : 'Approaching Limit'}</h2>
    </div>
    <div class="content">
      <div class="user-info">
        <div class="label">User:</div>
        <div class="value">${user.email} (${user.user_id})</div>
      </div>

      <div class="user-info">
        <div class="label">Current Usage:</div>
        <div class="value">$${monthlyCost} / $${monthlyLimit} (${percentUsed}%)</div>
      </div>

      <div class="user-info">
        <div class="label">Subscription Tier:</div>
        <div class="value">${tierName}</div>
      </div>

      <div class="user-info">
        <div class="label">Status:</div>
        <div class="value" style="color: ${blocked ? '#dc2626' : '#f59e0b'}; font-weight: bold;">
          ${blocked ? 'BLOCKED - Access suspended' : 'WARNING - Approaching limit'}
        </div>
      </div>

      <p style="margin-top: 20px;">
        ${blocked ?
          'User has been automatically blocked from using the service. They will need to upgrade to continue.' :
          'User is approaching their monthly limit. Consider reaching out to offer upgrade assistance.'
        }
      </p>

      <p style="color: #6b7280; font-size: 0.875rem;">
        View admin dashboard: <a href="https://multi-perspective.ai/admin.html">https://multi-perspective.ai/admin.html</a>
      </p>
    </div>
  </div>
</body>
</html>
    `;

    const textBody = `
Multi-Perspective AI Admin Alert

User ${blocked ? 'Blocked' : 'Approaching Limit'}

User: ${user.email} (${user.user_id})
Current Usage: $${monthlyCost} / $${monthlyLimit} (${percentUsed}%)
Subscription Tier: ${tierName}
Status: ${blocked ? 'BLOCKED - Access suspended' : 'WARNING - Approaching limit'}

${blocked ?
  'User has been automatically blocked from using the service. They will need to upgrade to continue.' :
  'User is approaching their monthly limit. Consider reaching out to offer upgrade assistance.'
}

View admin dashboard: https://multi-perspective.ai/admin.html
    `;

    const params = {
      Source: FROM_EMAIL,
      Destination: {
        ToAddresses: [ADMIN_NOTIFICATION_EMAIL],
      },
      Message: {
        Subject: {
          Data: `[MPAI Admin] User ${blocked ? 'Blocked' : 'at ' + percentUsed + '%'}: ${user.email}`,
        },
        Body: {
          Html: {
            Data: htmlBody,
          },
          Text: {
            Data: textBody,
          },
        },
      },
    };

    await sesClient.send(new SendEmailCommand(params));
    console.log(`📧 Admin notification sent about user ${user.email}`);
  } catch (err) {
    console.error('❌ Failed to send admin notification:', err.message);
  }
}
