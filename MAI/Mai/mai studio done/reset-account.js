import bcrypt from 'bcrypt';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase configuration');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const resetAccount = async () => {
  try {
    const email = 'trollcity2025@gmail.com';
    const newPassword = 'Trollcity95@';

    console.log(`Resetting account for ${email}...`);

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const { data, error } = await supabase
      .from('users')
      .update({ password: hashedPassword })
      .eq('email', email)
      .select();

    if (error) {
      console.error('Error resetting password:', error);
      process.exit(1);
    }

    if (data && data.length > 0) {
      console.log(`✓ Account reset successfully for ${email}`);
      console.log(`✓ New password: ${newPassword}`);
      console.log(`✓ User ID: ${data[0].id}`);
    } else {
      console.log(`✗ Account not found for ${email}`);
    }

    process.exit(0);
  } catch (err) {
    console.error('Failed to reset account:', err);
    process.exit(1);
  }
};

resetAccount();
