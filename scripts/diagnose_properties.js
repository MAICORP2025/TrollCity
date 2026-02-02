import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseKey) {
  throw new Error('SUPABASE_ANON_KEY environment variable is required');
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
  console.log('Fetching properties...');
  
  const { data: properties, error } = await supabase
    .from('properties')
    .select('*');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Total: ${properties.length}`);
  console.log(`For Rent: ${properties.filter(p => p.is_for_rent).length}`);
}

diagnose();
