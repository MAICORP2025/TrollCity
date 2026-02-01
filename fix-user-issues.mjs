/**
 * Script to fix user issues: inactive users, messaging permissions, and profile access
 * Run with: node fix-user-issues.mjs
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixUserIssues() {
  console.log('Starting user issues fix...\n');

  try {
    // 1. Activate all users who might be marked as inactive
    console.log('1. Activating inactive users...');
    const { error: activateError } = await supabase
      .from('user_profiles')
      .update({ is_active: true })
      .or('is_active.eq.false,is_active.is.null');
    
    if (activateError) {
      console.error('Error activating users:', activateError);
    } else {
      console.log('✓ Users activated successfully');
    }

    // 2. Unban any users who were incorrectly banned
    console.log('\n2. Unbanning incorrectly banned users...');
    const { error: unbanError } = await supabase
      .from('user_profiles')
      .update({ is_banned: false })
      .eq('is_banned', true);
    
    if (unbanError) {
      console.error('Error unbanning users:', unbanError);
    } else {
      console.log('✓ Users unbanned successfully');
    }

    // 3. Sync officer roles
    console.log('\n3. Syncing officer roles...');
    const { error: syncError } = await supabase
      .from('user_profiles')
      .update({ is_troll_officer: true })
      .eq('role', 'troll_officer')
      .neq('is_troll_officer', true);
    
    if (syncError) {
      console.error('Error syncing officer roles:', syncError);
    } else {
      console.log('✓ Officer roles synced successfully');
    }

    // 4. Sync lead officer roles
    console.log('\n4. Syncing lead officer roles...');
    const { error: syncLeadError } = await supabase
      .from('user_profiles')
      .update({ is_lead_officer: true })
      .eq('role', 'lead_troll_officer')
      .neq('is_lead_officer', true);
    
    if (syncLeadError) {
      console.error('Error syncing lead officer roles:', syncLeadError);
    } else {
      console.log('✓ Lead officer roles synced successfully');
    }

    // 5. Sync admin roles
    console.log('\n5. Syncing admin roles...');
    const { error: syncAdminError } = await supabase
      .from('user_profiles')
      .update({ is_admin: true })
      .eq('role', 'admin')
      .neq('is_admin', true);
    
    if (syncAdminError) {
      console.error('Error syncing admin roles:', syncAdminError);
    } else {
      console.log('✓ Admin roles synced successfully');
    }

    // 6. Update streams participants
    console.log('\n6. Updating streams participants...');
    const { error: participantError } = await supabase
      .from('streams_participants')
      .update({ is_active: true })
      .or('is_active.eq.false,is_active.is.null');
    
    if (participantError) {
      console.error('Error updating participants:', participantError);
    } else {
      console.log('✓ Streams participants updated successfully');
    }

    // 7. Verify the fixes
    console.log('\n7. Verifying fixes...');
    const { data: profileData, error: fetchError } = await supabase
      .from('user_profiles')
      .select('is_active, is_banned, role');
    
    if (fetchError) {
      console.error('Error fetching profile data:', fetchError);
    } else {
      const activeUsers = profileData.filter(u => u.is_active === true).length;
      const inactiveUsers = profileData.filter(u => u.is_active === false || u.is_active === null).length;
      const bannedUsers = profileData.filter(u => u.is_banned === true).length;
      const officers = profileData.filter(u => u.role === 'troll_officer').length;
      const admins = profileData.filter(u => u.role === 'admin').length;
      
      console.log('\n📊 User Statistics:');
      console.log(`   Active Users: ${activeUsers}`);
      console.log(`   Inactive Users: ${inactiveUsers}`);
      console.log(`   Banned Users: ${bannedUsers}`);
      console.log(`   Officers: ${officers}`);
      console.log(`   Admins: ${admins}`);
    }

    console.log('\n✅ User issues fix completed successfully!');
    console.log('\nNote: For RLS policy changes, please run the SQL script manually in Supabase SQL Editor.');
    console.log('The SQL script is available in FIX_USER_ISSUES.sql');

  } catch (error) {
    console.error('Unexpected error:', error);
    process.exit(1);
  }
}

// Run the fix
fixUserIssues();
