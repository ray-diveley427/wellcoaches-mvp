// ==================================================================
// Create HIPAA Audit Logging Table in DynamoDB
// ==================================================================
// This table stores all audit logs for HIPAA compliance
// Retention: 6 years (enforced via TTL)

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { CreateTableCommand } from '@aws-sdk/client-dynamodb';
import 'dotenv/config';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });

const tableName = process.env.AUDIT_TABLE || 'mpai-audit-logs';

async function createAuditTable() {
  const params = {
    TableName: tableName,
    AttributeDefinitions: [
      { AttributeName: 'audit_id', AttributeType: 'S' },
      { AttributeName: 'timestamp', AttributeType: 'S' },
      { AttributeName: 'user_id', AttributeType: 'S' }
    ],
    KeySchema: [
      { AttributeName: 'audit_id', KeyType: 'HASH' },  // Partition key
      { AttributeName: 'timestamp', KeyType: 'RANGE' }  // Sort key
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'user-timestamp-index',
        KeySchema: [
          { AttributeName: 'user_id', KeyType: 'HASH' },
          { AttributeName: 'timestamp', KeyType: 'RANGE' }
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
    BillingMode: 'PROVISIONED',
    ProvisionedThroughput: {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5
    },
    SSESpecification: {
      Enabled: true,
      SSEType: 'KMS'  // Encryption at rest (HIPAA requirement)
    },
    TimeToLiveSpecification: {
      AttributeName: 'ttl',
      Enabled: true  // Auto-delete after 6 years
    },
    Tags: [
      { Key: 'Purpose', Value: 'HIPAA Audit Logging' },
      { Key: 'Compliance', Value: 'HIPAA' },
      { Key: 'Retention', Value: '6 years' }
    ]
  };

  try {
    console.log(`Creating audit table: ${tableName}...`);
    const response = await client.send(new CreateTableCommand(params));
    console.log('✅ Audit table created successfully!');
    console.log('Table ARN:', response.TableDescription.TableArn);
    console.log('');
    console.log('IMPORTANT: Add this to your .env file:');
    console.log(`AUDIT_TABLE=${tableName}`);
  } catch (error) {
    if (error.name === 'ResourceInUseException') {
      console.log(`⚠️  Table ${tableName} already exists`);
    } else {
      console.error('❌ Error creating table:', error);
      process.exit(1);
    }
  }
}

createAuditTable();
