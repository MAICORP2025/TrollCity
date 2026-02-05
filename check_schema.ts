
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching notifications:', error);
  } else {
    if (data && data.length > 0) {
      console.log('Notification keys:', Object.keys(data[0]));
    } else {
      console.log('No notifications found to check schema.');
    }
  }
}

checkSchema();
