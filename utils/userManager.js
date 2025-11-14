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

      // Usage tracking
      monthly_cost: 0,
      daily_cost: 0,
      last_reset_date: new Date().toISOString(),
      last_daily_reset: new Date().toISOString().split('T')[0],

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
    const { tier, status, subscriptionId, keapContactId } = subscriptionData;

    const updateExpression = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};

    if (tier) {
      updateExpression.push('#tier = :tier');
      expressionAttributeNames['#tier'] = 'subscription_tier';
      expressionAttributeValues[':tier'] = tier;
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

    return user;
  } catch (error) {
    console.error('❌ Error in getOrCreateUser:', error);
    throw error;
  }
}
