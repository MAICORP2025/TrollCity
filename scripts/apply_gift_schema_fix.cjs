
require('dotenv').config();
const { Client } = require('pg');

async function apply() {
  if (!process.env.DATABASE_URL) {
      console.error('DATABASE_URL is not set in .env');
      // Fallback: Try to construct it if we have other vars? No, unsafe.
      process.exit(1);
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } 
  });

  const sql = `
    ALTER TABLE gift_transactions ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;
    ALTER TABLE gift_transactions ADD COLUMN IF NOT EXISTS coins_value INTEGER DEFAULT 0;
    ALTER TABLE gift_ledger ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;
  `;

  try {
    await client.connect();
    console.log('Connected to DB. Applying fix...');
    await client.query(sql);
    console.log('Fix applied successfully!');
  } catch (err) {
    console.error('Fix failed:', err);
  } finally {
    await client.end();
  }
}

apply();
