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

// Delete a session (deletes all analyses in that session)
router.delete('/:userId/:sessionId', async (req, res) => {
  const { userId, sessionId } = req.params;
  
  try {
    const pk = userId.startsWith("USER#") ? userId : `USER#${userId}`;
    const sessionPrefix = `SESSION#${sessionId}`;
    
    // Query all items for this session
    const queryResult = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues: {
          ":pk": pk,
          ":sk": sessionPrefix,
        },
      })
    );
    
    if (!queryResult.Items || queryResult.Items.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: "Session not found" 
      });
    }
    
    // Delete all items in this session
    const deletePromises = queryResult.Items.map(item => 
      docClient.send(
        new DeleteCommand({
          TableName: TABLE_NAME,
          Key: {
            PK: item.PK,
            SK: item.SK,
          },
        })
      )
    );
    
    await Promise.all(deletePromises);
    
    console.log(`✅ Deleted ${queryResult.Items.length} items for session ${sessionId}`);
    
    res.json({ 
      success: true, 
      message: `Deleted ${queryResult.Items.length} exchange(s)` 
    });
  } catch (err) {
    console.error("❌ Error deleting session:", err);
    res.status(500).json({ 
      success: false, 
      error: "Failed to delete session" 
    });
  }
});

export default router;
