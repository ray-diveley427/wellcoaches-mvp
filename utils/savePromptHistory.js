import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const client = new DynamoDBClient({ region: process.env.AWS_REGION });

export async function savePromptToHistory(
  userId,
  promptText,
  perspectives,
  synthesis
) {
  const item = {
    user_id: userId,
    session_id: uuidv4(),
    timestamp: Date.now(),
    prompt_text: promptText,
    perspectives_output: JSON.stringify(perspectives),
    synthesis_output: synthesis || '',
  };

  const command = new PutItemCommand({
    TableName: process.env.DYNAMO_TABLE,
    Item: marshall(item),
  });

  await client.send(command);
  console.log('✅ Prompt saved to DynamoDB for user:', userId);
}
