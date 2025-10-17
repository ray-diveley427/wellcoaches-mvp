import 'dotenv/config';
import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { v4 as uuidv4 } from 'uuid';

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const tableName = process.env.DYNAMO_TABLE || 'PromptHistory';

const user_id = 'test-user';
const session_id = 'test-session-' + uuidv4();
const item = {
  user_id,
  session_id,
  timestamp: Date.now(),
  prompt_text: 'Testing DynamoDB write connection',
  synthesis_output:
    'This is a test record written at ' + new Date().toISOString(),
};

async function testDynamo() {
  try {
    console.log('🪣 Attempting to write item to DynamoDB...');
    console.log('   Table:', tableName);
    console.log('   Region:', process.env.AWS_REGION);

    // Write item
    await client.send(
      new PutItemCommand({
        TableName: tableName,
        Item: marshall(item),
      })
    );
    console.log('✅ Successfully wrote item to DynamoDB.');

    // Read it back
    const result = await client.send(
      new GetItemCommand({
        TableName: tableName,
        Key: marshall({
          user_id,
          session_id,
        }),
      })
    );

    if (result.Item) {
      console.log('📦 Read back item from DynamoDB:');
      console.log(JSON.stringify(unmarshall(result.Item), null, 2));
    } else {
      console.warn(
        '⚠️ Write succeeded but read returned no item. Check your key schema!'
      );
    }
  } catch (err) {
    console.error('❌ DynamoDB test failed:', err);
  }
}

testDynamo();
