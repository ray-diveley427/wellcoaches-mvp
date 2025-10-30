import express from 'express';
import { docClient, TABLE_NAME } from '../db/dynamoClient.js';
import { QueryCommand, PutCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Fetch user history
router.get('/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const pk = userId.startsWith("USER#") ? userId : `USER#${userId}`;
    const data = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: { ":pk": pk },
        ScanIndexForward: false,
        Limit: 50,
      })
    );
    res.json(data.Items || []);
  } catch (err) {
    console.error("❌ Error fetching DynamoDB history:", err);
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

// Create one conversation (end-of-analysis)
router.post('/', async (req, res) => {
  try {
    const { userId, sessionId, userQuery, response } = req.body;
    const item = {
      PK: `USER#${userId}`,
      SK: `SESSION#${sessionId || uuidv4()}`,
      user_id: userId,
      user_query: userQuery,
      response,
      timestamp: new Date().toISOString(),
      ttl: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
    };
    await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Error saving history:", err);
    res.status(500).json({ error: "Failed to save history" });
  }
});

// Add additional endpoints as needed (delete, etc.)

export default router;
