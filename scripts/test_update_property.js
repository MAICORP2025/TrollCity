import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseKey) {
  throw new Error('SUPABASE_ANON_KEY environment variable is required');
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testUpdate() {
  const propertyId = process.env.PROPERTY_ID || 'your-property-id';
  console.log(`Updating: ${propertyId}`);

  const { data, error } = await supabase
    .from('properties')
    .update({ is_for_rent: true })
    .eq('id', propertyId)
    .select();

  if (error) console.error('Failed:', error);
  else console.log('Success:', data);
}

testUpdate();
