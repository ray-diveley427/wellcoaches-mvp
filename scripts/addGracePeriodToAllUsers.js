// Add grace period to all existing users in the database
import 'dotenv/config';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const docClient = DynamoDBDocumentClient.from(client);
const USERS_TABLE = 'mpai-users';
const GRACE_PERIOD_END = '2026-01-15T23:59:59.999Z';

async function addGracePeriodToAllUsers() {
  try {
    console.log('🔍 Scanning all users in database...');

    // Scan all users
    const scanCommand = new ScanCommand({
      TableName: USERS_TABLE
    });

    const result = await docClient.send(scanCommand);
    const users = result.Items || [];

    console.log(`📊 Found ${users.length} users`);

    let updated = 0;
    let skipped = 0;

    for (const user of users) {
      // Check if user already has grace period
      if (user.grace_period_end) {
        console.log(`⏭️  Skipping ${user.email} - already has grace period until ${user.grace_period_end}`);
        skipped++;
        continue;
      }

      // Add grace period
      const updateCommand = new UpdateCommand({
        TableName: USERS_TABLE,
        Key: { user_id: user.user_id },
        UpdateExpression: 'SET grace_period_end = :grace_end',
        ExpressionAttributeValues: {
          ':grace_end': GRACE_PERIOD_END
        }
      });

      await docClient.send(updateCommand);
      console.log(`✅ Added grace period to ${user.email} (${user.user_id})`);
      updated++;
    }

    console.log('\n📊 Summary:');
    console.log(`   ✅ Updated: ${updated} users`);
    console.log(`   ⏭️  Skipped: ${skipped} users (already had grace period)`);
    console.log(`   📅 Grace period expires: ${GRACE_PERIOD_END}`);

  } catch (error) {
    console.error('❌ Error adding grace periods:', error);
    throw error;
  }
}

addGracePeriodToAllUsers();
