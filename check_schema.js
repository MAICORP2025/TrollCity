
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://yjxpwfalenorzrqxwmtr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqeHB3ZmFsZW5vcnpycXh3bXRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwMjkxMTcsImV4cCI6MjA3OTYwNTExN30.S5Vc1xpZoZ0aemtNFJGcPhL_zvgPA0qgZq8e8KigUx8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  console.log('Checking officer_time_off_requests...');
  const { data: requests, error: requestsError } = await supabase
    .from('officer_time_off_requests')
    .select('*')
    .limit(1);
  
  if (requestsError) {
    console.error('Error fetching officer_time_off_requests:', requestsError.message);
  } else {
    console.log('officer_time_off_requests columns:', requests && requests.length > 0 ? Object.keys(requests[0]) : 'Table empty, cannot infer columns');
    if (requests && requests.length === 0) {
        // Try to insert a dummy row to see errors or just assume it works? 
        // Or better, try to select with a non-existent column to get a hint?
        // Actually, empty table is fine, I just need to know if I can use it.
        // But I specifically want to know if 'status' column exists.
    }
  }

  console.log('\nChecking user_profiles...');
  const { data: profiles, error: profilesError } = await supabase
    .from('user_profiles')
    .select('*')
    .limit(1);

  if (profilesError) {
    console.error('Error fetching user_profiles:', profilesError.message);
  } else {
    console.log('user_profiles columns:', profiles && profiles.length > 0 ? Object.keys(profiles[0]) : 'Table empty');
  }

  console.log('\nChecking officer_shift_slots...');
  const { data: shifts, error: shiftsError } = await supabase
    .from('officer_shift_slots')
    .select('*')
    .limit(1);

  if (shiftsError) {
    console.error('Error fetching officer_shift_slots:', shiftsError.message);
  } else {
    console.log('officer_shift_slots columns:', shifts && shifts.length > 0 ? Object.keys(shifts[0]) : 'Table empty');
  }
}

checkSchema();
