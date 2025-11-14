// =====================================================================
// Create DynamoDB Users Table
// =====================================================================
// Run this script once to create the mpai-users table in DynamoDB

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { CreateTableCommand, DescribeTableCommand } from '@aws-sdk/client-dynamodb';

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const TABLE_NAME = 'mpai-users';

async function createUsersTable() {
  try {
    // Check if table already exists
    try {
      const describeCommand = new DescribeTableCommand({ TableName: TABLE_NAME });
      await client.send(describeCommand);
      console.log(`✅ Table '${TABLE_NAME}' already exists`);
      return;
    } catch (error) {
      if (error.name !== 'ResourceNotFoundException') {
        throw error;
      }
      // Table doesn't exist, create it
    }

    const command = new CreateTableCommand({
      TableName: TABLE_NAME,
      KeySchema: [
        { AttributeName: 'user_id', KeyType: 'HASH' } // Partition key
      ],
      AttributeDefinitions: [
        { AttributeName: 'user_id', AttributeType: 'S' },
        { AttributeName: 'email', AttributeType: 'S' }
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'email-index',
          KeySchema: [
            { AttributeName: 'email', KeyType: 'HASH' }
          ],
          Projection: {
            ProjectionType: 'ALL'
          },
          ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 5
          }
        }
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5
      }
    });

    console.log(`⏳ Creating table '${TABLE_NAME}'...`);
    await client.send(command);

    console.log(`✅ Table '${TABLE_NAME}' created successfully!`);
    console.log(`
Table Structure:
- Primary Key: user_id (String)
- Global Secondary Index: email-index
- Attributes stored:
  - user_id
  - email
  - given_name
  - family_name
  - subscription_tier
  - subscription_status
  - subscription_id
  - keap_contact_id
  - monthly_cost
  - daily_cost
  - last_reset_date
  - last_daily_reset
  - created_at
  - updated_at
  - last_login
    `);
  } catch (error) {
    console.error('❌ Error creating table:', error);
    throw error;
  }
}

// Run the script
createUsersTable()
  .then(() => {
    console.log('✅ Setup complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  });
