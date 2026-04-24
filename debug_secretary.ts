
import { supabase } from './src/lib/supabase';

async function checkSecretaryAccess() {
  console.log('Checking secretary access...');
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.log('No user logged in.');
    return;
  }
  console.log('User ID:', user.id);

  // Check profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
    
  if (profileError) {
    console.error('Profile fetch error:', profileError);
  } else {
    console.log('Profile Role:', profile.role);
    console.log('Profile Troll Role:', profile.troll_role);
    console.log('Is Admin?', profile.role === 'admin' || profile.troll_role === 'admin');
  }

  // Check secretary assignments
  const { data: secData, error: secError } = await supabase
    .from('secretary_assignments')
    .select('*')
    .eq('secretary_id', user.id);
    
  if (secError) {
    console.error('Secretary assignment fetch error:', secError);
  } else {
    console.log('Secretary Assignments:', secData);
  }
}

checkSecretaryAccess();
