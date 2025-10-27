import { DynamoDBClient, PutItemCommand, ScanCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import dotenv from 'dotenv';

dotenv.config();

console.log('Testing DynamoDB connection...');
console.log('Region:', process.env.AWS_REGION);
console.log('Table:', process.env.DYNAMO_TABLE);
console.log('Access Key:', process.env.AWS_ACCESS_KEY_ID?.substring(0, 10) + '...');

const client = new DynamoDBClient({ region: process.env.AWS_REGION });

// Test write
try {
  const putCommand = new PutItemCommand({
    TableName: process.env.DYNAMO_TABLE,
    Item: marshall({
      PK: 'TEST',
      SK: `TEST-${Date.now()}`,
      test: 'test123'
    })
  });
  
  await client.send(putCommand);
  console.log('✅ Write successful!');
} catch (err) {
  console.error('❌ Write failed:', err.message);
}

// Test read
try {
  const scanCommand = new ScanCommand({
    TableName: process.env.DYNAMO_TABLE,
    Limit: 1
  });
  
  const result = await client.send(scanCommand);
  console.log('✅ Read successful! Items:', result.Items?.length || 0);
} catch (err) {
  console.error('❌ Read failed:', err.message);
}