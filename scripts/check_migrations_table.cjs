const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');

const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
  // Check standard supabase migrations table
  const { data, error } = await supabase.rpc('exec_sql', { 
    sql: "SELECT version FROM supabase_migrations.schema_migrations ORDER BY version" 
  });
  
  if (!error) {
    console.log('Found standard migrations table!');
    console.log(JSON.stringify(data));
    return;
  }
  
  console.log('Standard migrations table check failed:', error.message);
}

check();
