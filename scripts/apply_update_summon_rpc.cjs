require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function apply() {
  if (!process.env.DATABASE_URL) {
      console.error('DATABASE_URL is not set in .env');
      process.exit(1);
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } 
  });

  try {
    await client.connect();
    const sqlPath = path.join(__dirname, '../supabase/migrations/20270121020000_update_summon_rpc.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('Running migration...');
    await client.query(sql);
    console.log('Migration applied successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await client.end();
  }
}

apply();
