// utils/db.js
import sql from 'mssql';
import 'dotenv/config';

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

export async function saveSession(prompt, perspectives, observer, synthesis) {
  try {
    const pool = await sql.connect(dbConfig);
    await pool
      .request()
      .input('prompt', sql.NVarChar(sql.MAX), prompt)
      .input(
        'perspectives',
        sql.NVarChar(sql.MAX),
        JSON.stringify(perspectives || [])
      )
      .input(
        'observer_summary',
        sql.NVarChar(sql.MAX),
        JSON.stringify(observer || {})
      )
      .input('synthesis', sql.NVarChar(sql.MAX), synthesis || '').query(`
        INSERT INTO dbo.session_history (prompt, perspectives, observer_summary, synthesis)
        VALUES (@prompt, @perspectives, @observer_summary, @synthesis)
      `);
    console.log('🗂️ Session saved successfully.');
  } catch (err) {
    console.error('❌ Database insert failed:', err.message);
  }
}
