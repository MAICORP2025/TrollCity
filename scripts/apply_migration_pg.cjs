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
    
    // Get file from args or default
    const fileArg = process.argv[2];
    if (!fileArg) {
        throw new Error('Please provide a migration file path argument');
    }
    
    const sqlPath = path.resolve(process.cwd(), fileArg);
    console.log(`Reading migration from: ${sqlPath}`);
    
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
