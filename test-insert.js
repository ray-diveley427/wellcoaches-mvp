// test-insert.js
import sql from 'mssql';
import 'dotenv/config';

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: { encrypt: false, trustServerCertificate: true },
};

async function testInsert() {
  try {
    console.log('🔄 Connecting...');
    const pool = await sql.connect(dbConfig);

    const result = await pool
      .request()
      .input('prompt', sql.NVarChar(sql.MAX), 'Test prompt from MVP')
      .input(
        'perspectives',
        sql.NVarChar(sql.MAX),
        JSON.stringify([{ name: 'Achiever', insight: 'Example insight' }])
      )
      .input('observer_summary', sql.NVarChar(sql.MAX), 'Observer test summary')
      .input('synthesis', sql.NVarChar(sql.MAX), 'Synthesis test').query(`
        INSERT INTO dbo.session_history (prompt, perspectives, observer_summary, synthesis)
        VALUES (@prompt, @perspectives, @observer_summary, @synthesis)
      `);

    console.log('✅ Insert successful:', result.rowsAffected);
    await sql.close();
  } catch (err) {
    console.error('❌ Insert failed:', err);
  }
}

testInsert();
