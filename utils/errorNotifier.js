// utils/errorNotifier.js
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const sesClient = new SESClient({ region: process.env.AWS_REGION || 'us-east-1' });

const ADMIN_EMAIL = 'ai-admin@wellcoaches.com';
const FROM_EMAIL = process.env.ERROR_NOTIFICATION_FROM_EMAIL || 'noreply@multi-perspective.ai';
const ENABLED = process.env.ERROR_NOTIFICATIONS_ENABLED !== 'false'; // Enabled by default

/**
 * Send error notification email to admin
 * @param {Object} errorDetails - Error information
 * @param {string} errorDetails.type - Type of error (e.g., 'API_ERROR', 'SERVER_ERROR')
 * @param {string} errorDetails.message - Error message
 * @param {Object} errorDetails.context - Additional context (userId, sessionId, etc.)
 * @param {Error} errorDetails.stack - Error stack trace
 */
export async function notifyAdminOfError(errorDetails) {
  if (!ENABLED) {
    console.log('📧 Error notifications disabled - would have sent:', errorDetails.type);
    return;
  }

  try {
    const {
      type = 'UNKNOWN_ERROR',
      message = 'No error message provided',
      context = {},
      stack = '',
      timestamp = new Date().toISOString()
    } = errorDetails;

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #dc2626; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
    .section { margin: 15px 0; padding: 15px; background: white; border-left: 4px solid #dc2626; }
    .label { font-weight: bold; color: #6b7280; }
    .value { margin-top: 5px; font-family: monospace; background: #f3f4f6; padding: 8px; border-radius: 4px; }
    .stack { font-size: 12px; overflow-x: auto; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0;">⚠️ Multi-Perspective AI Error Alert</h2>
    </div>
    <div class="content">
      <div class="section">
        <div class="label">Error Type:</div>
        <div class="value">${type}</div>
      </div>

      <div class="section">
        <div class="label">Error Message:</div>
        <div class="value">${escapeHtml(message)}</div>
      </div>

      <div class="section">
        <div class="label">Timestamp:</div>
        <div class="value">${timestamp}</div>
      </div>

      ${context.userId ? `
      <div class="section">
        <div class="label">User ID:</div>
        <div class="value">${context.userId}</div>
      </div>
      ` : ''}

      ${context.sessionId ? `
      <div class="section">
        <div class="label">Session ID:</div>
        <div class="value">${context.sessionId}</div>
      </div>
      ` : ''}

      ${context.method ? `
      <div class="section">
        <div class="label">Method:</div>
        <div class="value">${context.method}</div>
      </div>
      ` : ''}

      ${context.statusCode ? `
      <div class="section">
        <div class="label">HTTP Status:</div>
        <div class="value">${context.statusCode}</div>
      </div>
      ` : ''}

      ${stack ? `
      <div class="section">
        <div class="label">Stack Trace:</div>
        <div class="value stack">${escapeHtml(stack)}</div>
      </div>
      ` : ''}

      ${Object.keys(context).length > 0 ? `
      <div class="section">
        <div class="label">Additional Context:</div>
        <div class="value">${escapeHtml(JSON.stringify(context, null, 2))}</div>
      </div>
      ` : ''}
    </div>
  </div>
</body>
</html>
    `;

    const textBody = `
Multi-Perspective AI Error Alert

Error Type: ${type}
Message: ${message}
Timestamp: ${timestamp}

${context.userId ? `User ID: ${context.userId}\n` : ''}
${context.sessionId ? `Session ID: ${context.sessionId}\n` : ''}
${context.method ? `Method: ${context.method}\n` : ''}
${context.statusCode ? `HTTP Status: ${context.statusCode}\n` : ''}

${stack ? `Stack Trace:\n${stack}\n` : ''}

${Object.keys(context).length > 0 ? `Additional Context:\n${JSON.stringify(context, null, 2)}` : ''}
    `;

    const params = {
      Source: FROM_EMAIL,
      Destination: {
        ToAddresses: [ADMIN_EMAIL],
      },
      Message: {
        Subject: {
          Data: `[Multi-Perspective AI] ${type}: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`,
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
    console.log(`📧 Error notification sent to ${ADMIN_EMAIL}`);
  } catch (err) {
    // Don't fail the request if email fails - just log it
    console.error('❌ Failed to send error notification email:', err.message);
  }
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}
