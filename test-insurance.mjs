// Test script to check insurance insertion
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnZWVlZ3d5dHVvdHd1cWF5Z3BzIiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTcwODQ0OTAsImV4cCI6MjAxMzY2MDQ5MH0.RjLDWnXQzw5pQkEhQFVi9aJ-pNGY5XD8CnG7L2Z8xw4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsurance() {
  try {
    // First check if insurance_options exists and has data
    const { data: options, error: optionsError } = await supabase
      .from('insurance_options')
      .select('*')
      .limit(5);
    
    console.log('Insurance Options:');
    console.log('Error:', optionsError);
    console.log('Data:', options);
    console.log('---');

    // Try to insert into user_insurances
    const { data, error } = await supabase.from('user_insurances').insert({
      user_id: '00000000-0000-0000-0000-000000000000',
      insurance_id: 'insurance_full_24h',
      expires_at: new Date(Date.now() + 24 * 3600000).toISOString(),
      protection_type: 'full'
    });

    if (error) {
      console.error('Insert Error:', error);
      console.error('Code:', error.code);
      console.error('Message:', error.message);
      console.error('Details:', error.details);
      console.error('Hint:', error.hint);
    } else {
      console.log('Insert Success:', data);
    }
  } catch (err) {
    console.error('Exception:', err);
  }
}

testInsurance();
