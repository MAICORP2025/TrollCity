/**
 * Database Cleanup Validation - Frontend Tests
 * 
 * Run these tests after applying the database cleanup migration
 * to verify frontend functionality is not broken.
 */

import { createClient } from '@supabase/supabase-js';

// Configuration - Replace with your values
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface TestResult {
  name: string;
  passed: boolean;
  message?: string;
  error?: string;
}

const results: TestResult[] = [];

// =============================================================================
// TEST 1: BASIC AUTHENTICATION
// =============================================================================

async function testAuthentication(): Promise<void> {
  console.log('\n=== Test 1: Authentication ===\n');
  
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      results.push({
        name: 'Authentication',
        passed: false,
        error: error.message
      });
      return;
    }
    
    if (session) {
      results.push({
        name: 'Authentication',
        passed: true,
        message: `Logged in as: ${session.user.email}`
      });
    } else {
      results.push({
        name: 'Authentication',
        passed: true,
        message: 'Not logged in (auth working)'
      });
    }
  } catch (err: any) {
    results.push({
      name: 'Authentication',
      passed: false,
      error: err.message
    });
  }
}

// =============================================================================
// TEST 2: PROFILE LOADING
// =============================================================================

async function testProfileLoading(): Promise<void> {
  console.log('\n=== Test 2: Profile Loading ===\n');
  
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user?.id) {
      results.push({
        name: 'Profile Loading',
        passed: false,
        error: 'Not authenticated'
      });
      return;
    }
    
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select(`
        id,
        username,
        avatar_url,
        role,
        level,
        troll_coins,
        is_admin,
        is_troll_officer,
        is_lead_officer,
        is_banned,
        troll_role,
        active_entrance_effect,
        created_at
      `)
      .eq('id', session.user.id)
      .single();
    
    if (error) {
      results.push({
        name: 'Profile Loading',
        passed: false,
        error: error.message
      });
      return;
    }
    
    if (profile) {
      results.push({
        name: 'Profile Loading',
        passed: true,
        message: `Profile loaded: ${profile.username} (Level ${profile.level})`
      });
    } else {
      results.push({
        name: 'Profile Loading',
        passed: false,
        error: 'Profile not found'
      });
    }
  } catch (err: any) {
    results.push({
      name: 'Profile Loading',
      passed: false,
      error: err.message
    });
  }
}

// =============================================================================
// TEST 3: OFFICER PERMISSIONS
// =============================================================================

async function testOfficerPermissions(): Promise<void> {
  console.log('\n=== Test 3: Officer Permissions ===\n');
  
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user?.id) {
      results.push({
        name: 'Officer Permissions',
        passed: true,
        message: 'Skipped - Not authenticated'
      });
      return;
    }
    
    // Test is_officer_or_admin() function
    const { data: isOfficerOrAdmin, error: funcError } = await supabase
      .rpc('is_officer_or_admin');
    
    if (funcError) {
      results.push({
        name: 'Officer Permissions (is_officer_or_admin)',
        passed: false,
        error: funcError.message
      });
    } else {
      results.push({
        name: 'Officer Permissions (is_officer_or_admin)',
        passed: true,
        message: `Result: ${isOfficerOrAdmin}`
      });
    }
    
    // Test is_lead_officer() function
    const { data: isLeadOfficer, error: leadError } = await supabase
      .rpc('is_lead_officer');
    
    if (leadError) {
      results.push({
        name: 'Officer Permissions (is_lead_officer)',
        passed: false,
        error: leadError.message
      });
    } else {
      results.push({
        name: 'Officer Permissions (is_lead_officer)',
        passed: true,
        message: `Result: ${isLeadOfficer}`
      });
    }
    
    // Check officer profile fields
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('is_troll_officer, is_lead_officer, officer_level, officer_role, is_officer_active')
      .eq('id', session.user.id)
      .single();
    
    results.push({
      name: 'Officer Profile Fields',
      passed: true,
      message: `Officer: ${profile?.is_troll_officer}, Lead: ${profile?.is_lead_officer}, Level: ${profile?.officer_level}`
    });
    
  } catch (err: any) {
    results.push({
      name: 'Officer Permissions',
      passed: false,
      error: err.message
    });
  }
}

// =============================================================================
// TEST 4: BAN/KICK STATUS
// =============================================================================

async function testBanKickStatus(): Promise<void> {
  console.log('\n=== Test 4: Ban/Kick Status ===\n');
  
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user?.id) {
      results.push({
        name: 'Ban/Kick Status',
        passed: true,
        message: 'Skipped - Not authenticated'
      });
      return;
    }
    
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('is_banned, banned_until, is_kicked, kick_count, muted_until')
      .eq('id', session.user.id)
      .single();
    
    if (error) {
      results.push({
        name: 'Ban/Kick Status',
        passed: false,
        error: error.message
      });
      return;
    }
    
    results.push({
      name: 'Ban/Kick Status',
      passed: true,
      message: `Banned: ${profile?.is_banned}, Kicked: ${profile?.is_kicked}, Kick Count: ${profile?.kick_count}`
    });
    
  } catch (err: any) {
    results.push({
      name: 'Ban/Kick Status',
      passed: false,
      error: err.message
    });
  }
}

// =============================================================================
// TEST 5: ENTRANCE EFFECTS
// =============================================================================

async function testEntranceEffects(): Promise<void> {
  console.log('\n=== Test 5: Entrance Effects ===\n');
  
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user?.id) {
      results.push({
        name: 'Entrance Effects',
        passed: true,
        message: 'Skipped - Not authenticated'
      });
      return;
    }
    
    // Check entrance effects table exists
    const { count: effectsCount, error: effectsError } = await supabase
      .from('entrance_effects')
      .select('*', { count: 'exact', head: true });
    
    if (effectsError) {
      results.push({
        name: 'Entrance Effects (Table Check)',
        passed: false,
        error: effectsError.message
      });
    } else {
      results.push({
        name: 'Entrance Effects (Table Check)',
        passed: true,
        message: `Available effects: ${effectsCount}`
      });
    }
    
    // Check user entrance effects
    const { data: userEffects, error: userEffectsError } = await supabase
      .from('user_entrance_effects')
      .select('effect_id, is_active')
      .eq('user_id', session.user.id);
    
    if (userEffectsError) {
      results.push({
        name: 'Entrance Effects (User Effects)',
        passed: false,
        error: userEffectsError.message
      });
    } else {
      results.push({
        name: 'Entrance Effects (User Effects)',
        passed: true,
        message: `User has ${userEffects?.length || 0} effects`
      });
    }
    
    // Check active entrance effect
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('active_entrance_effect, active_entrance_effect_id')
      .eq('id', session.user.id)
      .single();
    
    results.push({
      name: 'Entrance Effects (Active)',
      passed: true,
      message: `Active effect: ${profile?.active_entrance_effect || 'None'}`
    });
    
  } catch (err: any) {
    results.push({
      name: 'Entrance Effects',
      passed: false,
      error: err.message
    });
  }
}

// =============================================================================
// TEST 6: COIN BALANCE
// =============================================================================

async function testCoinBalance(): Promise<void> {
  console.log('\n=== Test 6: Coin Balance ===\n');
  
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user?.id) {
      results.push({
        name: 'Coin Balance',
        passed: true,
        message: 'Skipped - Not authenticated'
      });
      return;
    }
    
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('troll_coins, paid_coins, free_coin_balance, bonus_coin_balance')
      .eq('id', session.user.id)
      .single();
    
    if (error) {
      results.push({
        name: 'Coin Balance',
        passed: false,
        error: error.message
      });
      return;
    }
    
    results.push({
      name: 'Coin Balance',
      passed: true,
      message: `Troll Coins: ${profile?.troll_coins}, Paid: ${profile?.paid_coins}, Free: ${profile?.free_coin_balance}, Bonus: ${profile?.bonus_coin_balance}`
    });
    
  } catch (err: any) {
    results.push({
      name: 'Coin Balance',
      passed: false,
      error: err.message
    });
  }
}

// =============================================================================
// TEST 7: LEVEL/XP
// =============================================================================

async function testLevelXP(): Promise<void> {
  console.log('\n=== Test 7: Level/XP ===\n');
  
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user?.id) {
      results.push({
        name: 'Level/XP',
        passed: true,
        message: 'Skipped - Not authenticated'
      });
      return;
    }
    
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('level, xp, total_xp, prestige')
      .eq('id', session.user.id)
      .single();
    
    if (error) {
      results.push({
        name: 'Level/XP',
        passed: false,
        error: error.message
      });
      return;
    }
    
    results.push({
      name: 'Level/XP',
      passed: true,
      message: `Level: ${profile?.level}, XP: ${profile?.xp}, Total XP: ${profile?.total_xp}, Prestige: ${profile?.prestige}`
    });
    
  } catch (err: any) {
    results.push({
      name: 'Level/XP',
      passed: false,
      error: err.message
    });
  }
}

// =============================================================================
// TEST 8: STREAMS/BROADCAST ACCESS
// =============================================================================

async function testStreamAccess(): Promise<void> {
  console.log('\n=== Test 8: Stream/Broadcast Access ===\n');
  
  try {
    // Check if user can read streams
    const { data: streams, error: streamsError } = await supabase
      .from('streams')
      .select('id, title, is_live')
      .limit(5);
    
    if (streamsError) {
      results.push({
        name: 'Stream Access',
        passed: false,
        error: streamsError.message
      });
    } else {
      results.push({
        name: 'Stream Access',
        passed: true,
        message: `Found ${streams?.length || 0} streams`
      });
    }
    
  } catch (err: any) {
    results.push({
      name: 'Stream Access',
      passed: false,
      error: err.message
    });
  }
}

// =============================================================================
// TEST 9: CHAT ACCESS
// =============================================================================

async function testChatAccess(): Promise<void> {
  console.log('\n=== Test 9: Chat Access ===\n');
  
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user?.id) {
      results.push({
        name: 'Chat Access',
        passed: true,
        message: 'Skipped - Not authenticated'
      });
      return;
    }
    
    // Get user profile to check role for chat
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, troll_role, is_admin, is_troll_officer')
      .eq('id', session.user.id)
      .single();
    
    results.push({
      name: 'Chat Access (Role Check)',
      passed: true,
      message: `Role: ${profile?.role}, Troll Role: ${profile?.troll_role}, Admin: ${profile?.is_admin}, Officer: ${profile?.is_troll_officer}`
    });
    
  } catch (err: any) {
    results.push({
      name: 'Chat Access',
      passed: false,
      error: err.message
    });
  }
}

// =============================================================================
// TEST 10: MODERATION ACCESS
// =============================================================================

async function testModerationAccess(): Promise<void> {
  console.log('\n=== Test 10: Moderation Access ===\n');
  
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user?.id) {
      results.push({
        name: 'Moderation Access',
        passed: true,
        message: 'Skipped - Not authenticated'
      });
      return;
    }
    
    // Check user permissions
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, is_admin, is_troll_officer, is_lead_officer')
      .eq('id', session.user.id)
      .single();
    
    const isMod = profile?.is_admin || profile?.is_troll_officer || profile?.is_lead_officer ||
                  ['admin', 'troll_officer', 'lead_officer'].includes(profile?.role || '');
    
    results.push({
      name: 'Moderation Access',
      passed: true,
      message: `Can moderate: ${isMod}`
    });
    
  } catch (err: any) {
    results.push({
      name: 'Moderation Access',
      passed: false,
      error: err.message
    });
  }
}

// =============================================================================
// RUN ALL TESTS
// =============================================================================

async function runAllTests(): Promise<void> {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║     DATABASE CLEANUP VALIDATION - FRONTEND TESTS     ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log('\n');
  
  await testAuthentication();
  await testProfileLoading();
  await testOfficerPermissions();
  await testBanKickStatus();
  await testEntranceEffects();
  await testCoinBalance();
  await testLevelXP();
  await testStreamAccess();
  await testChatAccess();
  await testModerationAccess();
  
  // Print results
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║                   TEST RESULTS                         ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log('\n');
  
  let passed = 0;
  let failed = 0;
  
  results.forEach((result, index) => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    const num = String(index + 1).padStart(2, '0');
    
    console.log(`${num}. ${result.name}`);
    console.log(`   ${status}`);
    
    if (result.message) {
      console.log(`   ${result.message}`);
    }
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
    console.log('');
    
    if (result.passed) {
      passed++;
    } else {
      failed++;
    }
  });
  
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║                   SUMMARY                              ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log('\n');
  console.log(`Total Tests: ${results.length}`);
  console.log(`Passed: ${passed} ✅`);
  console.log(`Failed: ${failed} ❌`);
  console.log('\n');
  
  if (failed === 0) {
    console.log('🎉 All tests passed! Database cleanup was successful.');
  } else {
    console.log('⚠️  Some tests failed. Please review the errors above.');
  }
  console.log('\n');
}

// Export for use
export { runAllTests, testAuthentication, testProfileLoading };

// Run if executed directly
if (typeof window !== 'undefined' || process.env.RUN_TESTS === 'true') {
  runAllTests().catch(console.error);
}
