// =====================================================================
// User Manager - DynamoDB User Management with Subscription Support
// =====================================================================

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand
} from '@aws-sdk/lib-dynamodb';
import { SUBSCRIPTION_TIERS, SUBSCRIPTION_STATUS } from './subscriptionConfig.js';
import { getUserSubscriptionTier } from './keapIntegration.js';
import { initializeBillingCycle, getCurrentBillingPeriod } from './billingCycleManager.js';

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const docClient = DynamoDBDocumentClient.from(client);
const USERS_TABLE = 'mpai-users';

/**
 * Get user by ID
 */
export async function getUser(userId) {
  try {
    const command = new GetCommand({
      TableName: USERS_TABLE,
      Key: { user_id: userId }
    });

    const response = await docClient.send(command);
    return response.Item || null;
  } catch (error) {
    console.error('❌ Error getting user:', error);
    throw error;
  }
}

/**
 * Create new user with default subscription
 */
export async function createUser(userData) {
  try {
    const { user_id, email, given_name, family_name } = userData;

    // Initialize billing cycle starting today
    const billingCycleStartDate = initializeBillingCycle();
    const { periodStart, periodEnd } = getCurrentBillingPeriod(billingCycleStartDate);

    const user = {
      user_id,
      email,
      given_name: given_name || '',
      family_name: family_name || '',

      // Subscription fields
      subscription_tier: SUBSCRIPTION_TIERS.FREE,
      subscription_status: SUBSCRIPTION_STATUS.ACTIVE,
      subscription_id: null,
      keap_contact_id: null,

      // Billing cycle fields
      billing_cycle_start_date: billingCycleStartDate,
      current_period_start: periodStart.toISOString(),
      current_period_end: periodEnd.toISOString(),

      // Usage tracking
      monthly_cost: 0,
      daily_cost: 0,
      last_reset_date: new Date().toISOString(),
      last_daily_reset: new Date().toISOString().split('T')[0],
      last_cost_update: new Date().toISOString(),

      // Privacy preferences
      conversation_retention_days: 90, // Default: 3 months (can be 30 or 90)

      // Metadata
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_login: new Date().toISOString()
    };

    const command = new PutCommand({
      TableName: USERS_TABLE,
      Item: user,
      ConditionExpression: 'attribute_not_exists(user_id)'
    });

    await docClient.send(command);
    console.log(`✅ Created user: ${email}`);
    return user;
  } catch (error) {
    if (error.name === 'ConditionalCheckFailedException') {
      // User already exists, return existing user
      return await getUser(userData.user_id);
    }
    console.error('❌ Error creating user:', error);
    throw error;
  }
}

/**
 * Update user subscription
 */
export async function updateSubscription(userId, subscriptionData) {
  try {
    const { tier, status, subscriptionId, keapContactId, initializeBillingCycleOnUpgrade } = subscriptionData;

    const updateExpression = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};

    if (tier) {
      updateExpression.push('#tier = :tier');
      expressionAttributeNames['#tier'] = 'subscription_tier';
      expressionAttributeValues[':tier'] = tier;

      // If upgrading from free to paid tier, initialize billing cycle
      if (initializeBillingCycleOnUpgrade && tier !== SUBSCRIPTION_TIERS.FREE) {
        const billingCycleStartDate = initializeBillingCycle();
        const { periodStart, periodEnd } = getCurrentBillingPeriod(billingCycleStartDate);

        updateExpression.push('billing_cycle_start_date = :billing_start');
        updateExpression.push('current_period_start = :period_start');
        updateExpression.push('current_period_end = :period_end');
        expressionAttributeValues[':billing_start'] = billingCycleStartDate;
        expressionAttributeValues[':period_start'] = periodStart.toISOString();
        expressionAttributeValues[':period_end'] = periodEnd.toISOString();

        console.log(`🔄 Initializing billing cycle for user ${userId} starting ${billingCycleStartDate}`);
      }
    }

    if (status) {
      updateExpression.push('#status = :status');
      expressionAttributeNames['#status'] = 'subscription_status';
      expressionAttributeValues[':status'] = status;
    }

    if (subscriptionId !== undefined) {
      updateExpression.push('subscription_id = :sub_id');
      expressionAttributeValues[':sub_id'] = subscriptionId;
    }

    if (keapContactId !== undefined) {
      updateExpression.push('keap_contact_id = :keap_id');
      expressionAttributeValues[':keap_id'] = keapContactId;
    }

    updateExpression.push('updated_at = :updated');
    expressionAttributeValues[':updated'] = new Date().toISOString();

    const command = new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { user_id: userId },
      UpdateExpression: `SET ${updateExpression.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW'
    });

    const response = await docClient.send(command);
    console.log(`✅ Updated subscription for user: ${userId}`);
    return response.Attributes;
  } catch (error) {
    console.error('❌ Error updating subscription:', error);
    throw error;
  }
}

/**
 * Update user's usage costs
 */
export async function updateUsageCosts(userId, costData) {
  try {
    const { monthlyCost, dailyCost } = costData;

    const command = new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { user_id: userId },
      UpdateExpression: 'SET monthly_cost = :monthly, daily_cost = :daily, updated_at = :updated',
      ExpressionAttributeValues: {
        ':monthly': monthlyCost,
        ':daily': dailyCost,
        ':updated': new Date().toISOString()
      },
      ReturnValues: 'ALL_NEW'
    });

    const response = await docClient.send(command);
    return response.Attributes;
  } catch (error) {
    console.error('❌ Error updating usage costs:', error);
    throw error;
  }
}

/**
 * Reset monthly costs (call this on the first of each month)
 */
export async function resetMonthlyCosts(userId) {
  try {
    const command = new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { user_id: userId },
      UpdateExpression: 'SET monthly_cost = :zero, last_reset_date = :date, updated_at = :updated',
      ExpressionAttributeValues: {
        ':zero': 0,
        ':date': new Date().toISOString(),
        ':updated': new Date().toISOString()
      },
      ReturnValues: 'ALL_NEW'
    });

    const response = await docClient.send(command);
    return response.Attributes;
  } catch (error) {
    console.error('❌ Error resetting monthly costs:', error);
    throw error;
  }
}

/**
 * Reset daily costs (call this daily)
 */
export async function resetDailyCosts(userId) {
  try {
    const today = new Date().toISOString().split('T')[0];

    const command = new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { user_id: userId },
      UpdateExpression: 'SET daily_cost = :zero, last_daily_reset = :date, updated_at = :updated',
      ExpressionAttributeValues: {
        ':zero': 0,
        ':date': today,
        ':updated': new Date().toISOString()
      },
      ReturnValues: 'ALL_NEW'
    });

    const response = await docClient.send(command);
    return response.Attributes;
  } catch (error) {
    console.error('❌ Error resetting daily costs:', error);
    throw error;
  }
}

/**
 * Update last login timestamp
 */
export async function updateLastLogin(userId) {
  try {
    const command = new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { user_id: userId },
      UpdateExpression: 'SET last_login = :now',
      ExpressionAttributeValues: {
        ':now': new Date().toISOString()
      }
    });

    await docClient.send(command);
  } catch (error) {
    console.error('❌ Error updating last login:', error);
    // Don't throw - this is not critical
  }
}

/**
 * Get or create user (convenience method)
 * Now includes Keap tag checking to set subscription tier
 */
export async function getOrCreateUser(userData) {
  try {
    let user = await getUser(userData.user_id);

    if (!user) {
      user = await createUser(userData);
    } else {
      // Update last login
      await updateLastLogin(userData.user_id);
    }

    // Check Keap for subscription tier based on tags
    if (userData.email && userData.email !== `${userData.user_id}@temp.local`) {
      try {
        const keapTier = await getUserSubscriptionTier(userData.email);

        // Update user's tier if it changed
        if (keapTier && keapTier !== user.subscription_tier) {
          console.log(`🔄 Updating user ${userData.email} tier from ${user.subscription_tier} to ${keapTier}`);
          await updateSubscription(userData.user_id, {
            tier: keapTier,
            status: SUBSCRIPTION_STATUS.ACTIVE
          });
          user.subscription_tier = keapTier;
        }
      } catch (error) {
        console.error('⚠️ Error checking Keap subscription, using cached tier:', error);
        // Continue with cached tier from database
      }
    }

    return user;
  } catch (error) {
    console.error('❌ Error in getOrCreateUser:', error);
    throw error;
  }
}

/**
 * Update conversation retention preference
 * @param {string} userId - User ID
 * @param {number} retentionDays - Number of days (30 or 90)
 */
export async function updateConversationRetention(userId, retentionDays) {
  try {
    // Validate input
    if (retentionDays !== 30 && retentionDays !== 90) {
      throw new Error('Retention days must be 30 or 90');
    }

    const command = new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { user_id: userId },
      UpdateExpression: 'SET conversation_retention_days = :retention, updated_at = :updated',
      ExpressionAttributeValues: {
        ':retention': retentionDays,
        ':updated': new Date().toISOString()
      },
      ReturnValues: 'ALL_NEW'
    });

    const response = await docClient.send(command);
    console.log(`✅ Updated conversation retention for ${userId}: ${retentionDays} days`);
    return response.Attributes;
  } catch (error) {
    console.error('❌ Error updating conversation retention:', error);
    throw error;
  }
}
