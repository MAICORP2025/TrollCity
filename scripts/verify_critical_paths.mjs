import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Load env
dotenv.config({ path: path.resolve(rootDir, '.env') });
if (!process.env.VITE_SUPABASE_URL) {
    dotenv.config({ path: path.resolve(rootDir, '.env.local') });
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (serviceRoleKey === anonKey) {
    console.warn('⚠️ WARNING: Service Role Key is IDENTICAL to Anon Key! Admin commands will fail.');
} else {
    console.log('✅ Service Role Key is different from Anon Key.');
}

if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing Supabase URL or Service Role Key in .env');
    console.error('Please ensure .env contains VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

console.log('Connecting to Supabase at:', supabaseUrl);
console.log('Using Service Key (first 10 chars):', serviceRoleKey.substring(0, 10) + '...');
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Simple connection check
try {
    const { error } = await supabase.from('system_settings').select('count').limit(1);
    if (error) console.error('⚠️ Initial connection check failed:', error.message);
    else console.log('✅ Initial connection check passed.');
} catch (e) {
    console.error('⚠️ Initial connection check exception:', e);
}

async function runTests() {
    console.log('🚀 Starting Critical Path Verification...');

    // ---------------------------------------------------------
    // Test 1: Signup / User Creation Check
    // ---------------------------------------------------------
    console.log('\n--- Test 1: User Profile Creation (Signup Flow) ---');
    const testEmail = `test_critical_${Date.now()}@example.com`;
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: testEmail,
        password: 'password123',
        email_confirm: true
    });
    
    if (authError) {
        console.error('❌ Failed to create auth user:', authError.message);
    } else {
        console.log('✅ Auth user created:', authUser.user.id);
        
        // Wait for trigger to create profile
        console.log('⏳ Waiting for profile creation trigger...');
        await new Promise(r => setTimeout(r, 2000));
        
        const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', authUser.user.id).single();
        if (profile) {
            console.log('✅ User profile auto-created successfully.');
            console.log(`   - Username: ${profile.username}`);
            console.log(`   - Role: ${profile.role}`);
        } else {
            console.error('❌ User profile NOT created. Trigger failure?');
        }
    }

    // ---------------------------------------------------------
    // Test 2: Officer Actions (Logging)
    // ---------------------------------------------------------
    console.log('\n--- Test 2: Officer Action Logging ---');
    const actionType = 'TEST_ACTION_' + Date.now();
    const { data: logId, error: logError } = await supabase.rpc('log_admin_action', {
        p_action_type: actionType,
        p_target_id: null,
        p_details: { test: true, runner: 'verify_script' }
    });

    if (logError) {
        console.error('❌ Log Admin Action RPC Failed:', logError.message);
        if (logError.message.includes('function not found')) {
             console.error('   -> HINT: Migration "20260107_security_and_logging_consolidation.sql" might not have run.');
        }
    } else {
        console.log('✅ Log Admin Action RPC success. Log ID:', logId);
        // Verify read
        const { data: logEntry } = await supabase.from('action_logs').select('*').eq('id', logId).single();
        if (logEntry && logEntry.action_type === actionType) {
            console.log('✅ Log entry verified in database.');
        } else {
            console.error('❌ Log entry not found in DB after RPC success.');
        }
    }

    // ---------------------------------------------------------
    // Test 3: Cashout + Payout Lock
    // ---------------------------------------------------------
    console.log('\n--- Test 3: Cashout Payout Lock ---');
    
    // Ensure system_settings exists
    const { data: existingSettings } = await supabase.from('system_settings').select('*').limit(1);
    let initialLockState = false;
    
    if (!existingSettings || existingSettings.length === 0) {
        console.log('Creating initial system_settings...');
        await supabase.from('system_settings').insert({ payout_lock_enabled: false });
    } else {
        initialLockState = existingSettings[0].payout_lock_enabled;
        console.log(`ℹ️ Initial Payout Lock State: ${initialLockState}`);
    }

    try {
        // 1. Enable Lock
        console.log('🔒 Enabling Payout Lock...');
        await supabase.from('system_settings').update({ payout_lock_enabled: true }).gt('id', 0);

        // Use the authUser from Test 1 or create new if failed
        let payoutUserId = authUser?.user?.id;
        if (!payoutUserId) {
            // Fallback if Test 1 failed
            const { data: temp } = await supabase.auth.admin.createUser({ email: `payout_fallback_${Date.now()}@test.com`, password: 'pw', email_confirm: true });
            payoutUserId = temp?.user?.id;
        }

        if (payoutUserId) {
             console.log('Attempting payout request with Lock ON...');
             const { error: lockError } = await supabase.from('payout_requests').insert({
                 user_id: payoutUserId,
                 requested_coins: 100,
                 amount_usd: 10,
                 status: 'pending'
             });

             if (lockError && (lockError.message.includes('locked') || lockError.message.includes('Launch Trial Mode'))) {
                 console.log('✅ Payout Request BLOCKED as expected.');
                 console.log(`   - Error message: "${lockError.message}"`);
             } else if (lockError) {
                 console.log('⚠️ Payout Request failed but not due to lock:', lockError.message);
             } else {
                 console.error('❌ Payout Request SUCCEEDED despite Lock ON! (Security Failure)');
             }

             // 3. Disable Lock
             console.log('🔓 Disabling Payout Lock...');
             await supabase.from('system_settings').update({ payout_lock_enabled: false }).gt('id', 0);

             // 4. Attempt Payout Request (Should SUCCEED)
             console.log('Attempting payout request with Lock OFF...');
             const { error: successError } = await supabase.from('payout_requests').insert({
                 user_id: payoutUserId,
                 requested_coins: 100,
                 amount_usd: 10,
                 status: 'pending'
             });

             if (!successError) {
                 console.log('✅ Payout Request SUCCEEDED as expected (Lock is OFF).');
             } else {
                 if (successError.message.includes('locked')) {
                     console.error('❌ Payout Request STILL BLOCKED after disabling lock!');
                 } else {
                     console.log('✅ Lock check passed (Failed on other constraint: ' + successError.message + ')');
                 }
             }
             
             // Cleanup user
             if (payoutUserId) await supabase.auth.admin.deleteUser(payoutUserId);
             console.log('✅ Cleanup: Test user deleted.');
        } else {
            console.error('❌ Could not get valid user for Payout Test');
        }
    } finally {
        // Restore initial state
        console.log(`Restoring Payout Lock to: ${initialLockState}`);
        await supabase.from('system_settings').update({ payout_lock_enabled: initialLockState }).gt('id', 0);
    }

    console.log('\n🏁 Verification Complete.');
    process.exit(0);
}

runTests().catch(e => {
    console.error('Script Error:', e);
    process.exit(1);
});
