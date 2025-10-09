// utils/saveSession.js
import sql from 'mssql';

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER, // e.g. 'localhost'
  database: process.env.DB_NAME, // 'MMPlus'
  options: {
    encrypt: true, // required for Azure; OK for local too
    trustServerCertificate: true,
  },
};

export async function saveSession({
  prompt,
  perspectives,
  observerSummary,
  synthesis,
}) {
  let pool;
  try {
    pool = await sql.connect(dbConfig);

    const request = pool.request();
    request.input('prompt', sql.NVarChar(sql.MAX), prompt);
    request.input(
      'perspectives',
      sql.NVarChar(sql.MAX),
      JSON.stringify(perspectives || [])
    );
    request.input(
      'observer_summary',
      sql.NVarChar(sql.MAX),
      JSON.stringify(observerSummary || {})
    );
    request.input('synthesis', sql.NVarChar(sql.MAX), synthesis);

    await request.query(`
      INSERT INTO dbo.session_history (prompt, perspectives, observer_summary, synthesis)
      VALUES (@prompt, @perspectives, @observer_summary, @synthesis)
    `);

    console.log('🗄️ Session saved to SQL database successfully.');
  } catch (err) {
    console.error('❌ Failed to save session:', err);
  } finally {
    if (pool) await pool.close();
  }
}
