// test-db.js
import sql from 'mssql';
import 'dotenv/config';

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: {
    encrypt: false, // disable for local or non-Azure
    trustServerCertificate: true, // accept self-signed certs
  },
};

async function testConnection() {
  try {
    console.log('🔄 Connecting to database...');
    const pool = await sql.connect(config);
    const result = await pool.request().query('SELECT TOP 1 * FROM sys.tables');
    console.log('✅ Connection successful!');
    console.log('Tables in DB:', result.recordset);
    await sql.close();
  } catch (err) {
    console.error('❌ Connection failed:', err);
  }
}

testConnection();
