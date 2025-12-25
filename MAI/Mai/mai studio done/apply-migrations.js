import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Missing Supabase credentials in .env file');
  process.exit(1);
}

async function applySchemaMigrations() {
  try {
    console.log('📦 Reading SUPABASE_SETUP.sql...');
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const sqlPath = path.join(__dirname, 'SUPABASE_SETUP.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf-8');

    // Split SQL by semicolon but preserve multi-line statements
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`\n🔄 Found ${statements.length} SQL statements to execute`);
    console.log(`🌐 Connecting to Supabase database...\n`);

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/`, {
          method: 'POST',
          headers: {
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({
            query: statement
          })
        });

        // Alternative approach: use the direct SQL endpoint if available
        // Most Supabase projects don't expose raw SQL execution via REST
        // So we'll provide instructions instead
        throw new Error('REST API approach not available - see instructions below');
        
      } catch (err) {
        errorCount++;
        errors.push(err.message);
      }
    }

    console.log('\n❌ Migration Script Limitation\n');
    console.log('The REST API does not support direct SQL execution for security reasons.');
    console.log('\n✨ To apply your migrations, use one of these methods:\n');
    
    console.log('📊 Option 1: Supabase Dashboard (Easiest)');
    console.log('─'.repeat(50));
    console.log('1. Go to: https://app.supabase.com');
    console.log('2. Select your project');
    console.log('3. Go to SQL Editor → New Query');
    console.log('4. Copy the entire SUPABASE_SETUP.sql file');
    console.log('5. Paste it into the SQL editor');
    console.log('6. Click Run\n');

    console.log('🖥️  Option 2: Supabase CLI (Recommended)');
    console.log('─'.repeat(50));
    console.log('1. Install Supabase CLI: npm install -g supabase');
    console.log('2. Run: supabase db push');
    console.log('3. If prompted, log in to your Supabase account\n');

    console.log('⚡ Option 3: psql Command Line');
    console.log('─'.repeat(50));
    const projectId = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)[1];
    console.log(`psql "postgresql://postgres:${supabaseServiceKey}@${projectId}.supabase.co:5432/postgres" < SUPABASE_SETUP.sql\n`);

  } catch (error) {
    console.error('Error reading migrations file:', error.message);
    process.exit(1);
  }
}

applySchemaMigrations();
