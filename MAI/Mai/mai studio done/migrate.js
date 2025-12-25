import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function executeSql(sql) {
  const { data, error } = await supabase.rpc('exec_sql', { sql });
  if (error) throw error;
  return data;
}

async function migrate() {
  try {
    console.log('📦 Reading SUPABASE_SETUP.sql...\n');
    
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const sqlPath = path.join(__dirname, 'SUPABASE_SETUP.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf-8');

    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`🔄 Found ${statements.length} SQL statements\n`);

    let successCount = 0;
    let skipCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      try {
        await executeSql(statement);
        successCount++;
      } catch (error) {
        const msg = error.message || '';
        if (msg.includes('already exists') || msg.includes('IF NOT EXISTS')) {
          skipCount++;
        } else {
          console.error(`⚠️  Statement ${i + 1}: ${msg}`);
        }
      }
      
      process.stdout.write(`\r✅ Processed: ${successCount + skipCount}/${statements.length}`);
    }

    console.log(`\n\n✨ Migration Complete!`);
    console.log(`✅ Executed: ${successCount}`);
    console.log(`⏭️  Skipped: ${skipCount} (IF NOT EXISTS)\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

migrate();
