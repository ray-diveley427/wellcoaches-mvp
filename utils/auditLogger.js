// ==================================================================
// HIPAA Audit Logger
// ==================================================================
// Logs all access to PHI/PII for HIPAA compliance
// Required retention: 6 years minimum

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

const AUDIT_TABLE = process.env.AUDIT_TABLE || 'mpai-audit-logs';

/**
 * Log an audit event for HIPAA compliance
 * @param {Object} eventData - Event information
 * @param {string} eventData.userId - User ID performing the action
 * @param {string} eventData.action - Action performed (READ, WRITE, DELETE, etc.)
 * @param {string} eventData.resource - Resource accessed (session, user, etc.)
 * @param {string} eventData.resourceId - ID of the resource
 * @param {Object} eventData.metadata - Additional metadata
 * @param {string} eventData.ipAddress - User's IP address
 * @param {string} eventData.userAgent - User's browser/client
 */
export async function logAuditEvent({
  userId,
  action,
  resource,
  resourceId,
  metadata = {},
  ipAddress = 'unknown',
  userAgent = 'unknown',
  status = 'success'
}) {
  const timestamp = new Date().toISOString();
  const auditId = uuidv4();

  const auditEntry = {
    audit_id: auditId,
    timestamp,
    user_id: userId || 'anonymous',
    action,
    resource,
    resource_id: resourceId,
    status,
    ip_address: ipAddress,
    user_agent: userAgent,
    metadata,
    ttl: Math.floor(Date.now() / 1000) + (6 * 365 * 24 * 60 * 60) // 6 years retention
  };

  try {
    await docClient.send(new PutCommand({
      TableName: AUDIT_TABLE,
      Item: auditEntry
    }));

    // Also log to CloudWatch for immediate visibility
    console.log('AUDIT:', JSON.stringify(auditEntry));

  } catch (error) {
    // CRITICAL: Audit logging failure should be logged but not break functionality
    console.error('❌ AUDIT LOG FAILED:', error);
    console.error('Failed audit entry:', auditEntry);
  }
}

/**
 * Middleware to automatically log all API requests
 */
export function auditMiddleware(req, res, next) {
  const startTime = Date.now();

  // Capture response
  const originalJson = res.json;
  res.json = function(data) {
    const duration = Date.now() - startTime;
    const status = res.statusCode >= 400 ? 'error' : 'success';

    // Log the API request
    logAuditEvent({
      userId: req.user?.sub || req.headers['x-user-id'] || 'anonymous',
      action: req.method,
      resource: req.path,
      resourceId: req.params?.id || req.params?.sessionId || 'n/a',
      metadata: {
        query: req.query,
        duration_ms: duration,
        status_code: res.statusCode
      },
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      status
    });

    return originalJson.call(this, data);
  };

  next();
}

/**
 * Log data access (for PHI/PII)
 */
export function logDataAccess(userId, action, dataType, dataId, metadata = {}) {
  return logAuditEvent({
    userId,
    action,
    resource: dataType,
    resourceId: dataId,
    metadata,
    status: 'success'
  });
}

export default {
  logAuditEvent,
  auditMiddleware,
  logDataAccess
};
