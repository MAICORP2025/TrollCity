# Database Cleanup Comprehensive Report

## Summary of Changes Applied

Based on the cleanup migration that was executed:

### ✅ Successfully Removed

**Tables:**
- `public.visitor_stats`
- `public.troll_events`
- `public.user_health_records`
- `public.staff_profiles`
- `public.troll_dna_profiles`
- `public.profiles`

**Columns:**

| Category | Columns Removed |
|----------|-----------------|
| Economy | `sav_bonus_coins`, `owc_balance`, `total_owc_earned`, `vivied_bonus_coins`, `reserved_paid_coins`, `trollmonds`, `earned_coins`, `total_coins_earned`, `total_coins_spent`, `coin_balance` |
| Multipliers | `multiplier_active`, `multiplier_value`, `multiplier_expires`, `coin_multiplier` |
| Payout/Financial | `payout_method`, `payout_details`, `payout_destination_masked`, `preferred_payout_method`, `payout_paypal_email`, `tax_status`, `tax_id_last4`, `tax_classification`, `w9_status`, `w9_verified_at`, `payout_frozen`, `payout_freeze_reason`, `payout_freeze_at`, `last_payout_at`, `lifetime_payout_total`, `total_earned_usd`, `creator_trust_score` |
| Empire/Partner | `empire_role`, `empire_partner`, `partner_status`, `is_empire_partner` |
| Influencer/Tier | `influence_tier` |
| Address Fields | `address_line1`, `address_line2`, `state_region`, `postal_code`, `street_address`, `city`, `state`, `country` |

---

# VALIDATION

## Validation Scripts Created

Two validation scripts have been created to test the cleanup:

### 1. `validate_database_cleanup.sql` (Database-level)

Run this in your Supabase SQL Editor or via psql:

```bash
# Run in Supabase SQL Editor
\i validate_database_cleanup.sql

# Or copy-paste the contents into the SQL Editor
```

**What it tests:**
- ✅ FK errors - Verifies no broken foreign keys
- ✅ Critical columns exist - Officer, ban, troll_role columns
- ✅ Officer permissions - `is_officer_or_admin()`, `is_lead_officer()` functions
- ✅ Ban/kick functionality - Ban columns exist and work
- ✅ Entrance effects - Tables and columns exist
- ✅ Frontend profile display - Core profile fields
- ✅ RLS policies - Policies still enabled
- ✅ Moderation functions - Functions exist
- ✅ Removed columns are gone
- ✅ Removed tables are dropped

### 2. `validate_database_cleanup.ts` (Frontend-level)

Run this in your frontend environment:

```bash
# Set environment variables
export VITE_SUPABASE_URL=your_supabase_url
export VITE_SUPABASE_ANON_KEY=your_anon_key

# Run the tests
npx ts-node validate_database_cleanup.ts

# Or import and run in your app
import { runAllTests } from './validate_database_cleanup';
runAllTests();
```

**What it tests:**
- ✅ Authentication - Auth system working
- ✅ Profile loading - Profile data loads correctly
- ✅ Officer permissions - Officer functions work
- ✅ Ban/kick status - Ban columns accessible
- ✅ Entrance effects - Effects system working
- ✅ Coin balance - Currency columns accessible
- ✅ Level/XP - Progression system working
- ✅ Stream access - Broadcast access works
- ✅ Chat access - Chat permissions work
- ✅ Moderation access - Moderation functions work

---

# COLUMNS THAT CANNOT BE REMOVED

## 1. OFFICER COLUMNS - CRITICAL ⚠️

| Column | Data Type | Used In |
|--------|-----------|---------|
| `is_troll_officer` | boolean | Functions, RLS policies, triggers |
| `is_lead_officer` | boolean | Functions, RLS policies, triggers |
| `officer_level` | integer | Functions, RLS policies, triggers |
| `officer_role` | text | Functions, RLS policies, triggers |
| `is_officer_active` | boolean | Functions, RLS policies, triggers |
| `officer_reputation_score` | integer | Functions, launch reset |
| `officer_tier_badge` | text | Triggers |

### Verdict: **CANNOT REMOVE** - System will fail

---

## 2. BAN COLUMNS - CRITICAL ⚠️

| Column | Data Type | Used In |
|--------|-----------|---------|
| `is_banned` | boolean | Functions, RLS policies |
| `banned_until` | timestamp | Functions, RLS policies |
| `ban_reason` | text | Functions, RLS policies |
| `ban_expires_at` | timestamp | Functions, triggers |

### Verdict: **CANNOT REMOVE** - Moderation system depends on this

---

## 3. TROLL_ROLE - CRITICAL ⚠️

| Column | Data Type | Used In |
|--------|-----------|---------|
| `troll_role` | text | Functions, RLS policies, triggers |

### Verdict: **CANNOT REMOVE** - Role sync system depends on this

---

## 4. ENTRANCE EFFECTS - CRITICAL ⚠️

| Column | Data Type | Used In |
|--------|-----------|---------|
| `active_entrance_effect` | text | Functions, triggers |
| `active_entrance_effect_id` | text | Functions, triggers |
| `entrance_effects` | jsonb | Functions, triggers |

### Verdict: **CANNOT REMOVE** - Feature is actively used

---

## 5. KICK/MUTE COLUMNS - CRITICAL ⚠️

| Column | Data Type | Used In |
|--------|-----------|---------|
| `is_kicked` | boolean | Functions |
| `kick_count` | integer | Functions |
| `muted_until` | timestamp | Functions |
| `kicked_until` | timestamp | Functions |
| `last_kicked_at` | timestamp | Functions |

### Verdict: **CANNOT REMOVE** - Moderation features

---

## 6. IP ADDRESS COLUMNS - KEEP

| Column | Data Type | Used In |
|--------|-----------|---------|
| `last_known_ip` | inet | Moderation functions |

---

## 7. XP/LEVEL COLUMNS - KEEP

| Column | Data Type | Status |
|--------|-----------|--------|
| `xp` | bigint | **Keep** |
| `total_xp` | bigint | **Keep** |
| `prestige` | integer | **Keep** |
| `xp_multiplier` | numeric | **Keep** |

---

# REMAINING CLEANUP OPTIONS

## Optional Cleanup (Lower Priority)

### Remove (Safe)
| Column | Data Type |
|--------|-----------|
| `no_kick_until` | timestamp |
| `no_ban_until` | timestamp |
| `live_restricted_until` | timestamp |
| `is_employee` | boolean |
| `employee_role` | text |
| `hire_date` | date |
| `troller_level` | integer |
| `account_deleted_at` | timestamp |
| `account_deletion_cooldown_until` | timestamp |
| `account_reset_after_ban` | boolean |
| `account_state` | text |
| `app_access_enabled` | boolean |
| `ip_address_history` | jsonb |

### Keep (Required)
| Column | Data Type | Reason |
|--------|-----------|--------|
| `id_verification_status` | text | Used in UI |
| `id_document_url` | text | Used in UI |
| `has_insurance` | boolean | Implement with KTauto |
| `insurance_type` | text | Implement with KTauto |
| `insurance_expires_at` | timestamp | Implement with KTauto |
| `insurance_level` | text | Implement with KTauto |

---

# HOW TO RUN VALIDATION

## Step 1: Database Validation

1. Open Supabase Dashboard
2. Go to SQL Editor
3. Copy contents of `validate_database_cleanup.sql`
4. Run the script
5. Review results - all checks should pass

## Step 2: Frontend Validation

1. Set environment variables:
   ```bash
   export VITE_SUPABASE_URL=your_supabase_url
   export VITE_SUPABASE_ANON_KEY=your_anon_key
   ```

2. Run validation:
   ```bash
   npx ts-node validate_database_cleanup.ts
   ```

3. Or test manually:
   - Log in as different user types (regular, officer, admin)
   - Test profile loading
   - Test coin balance
   - Test level/XP
   - Test chat permissions
   - Test broadcast access

## Step 3: Manual Testing

- [ ] Officer can access officer-only features
- [ ] Admins can access admin features
- [ ] Regular users cannot access admin features
- [ ] Banned users are properly restricted
- [ ] Entrance effects display correctly
- [ ] Profile displays correctly
- [ ] Coin balance shows correctly
- [ ] Level/XP displays correctly

---

# TROUBLESHOOTING

## Common Issues

### "Column does not exist" errors
This is expected for columns that were intentionally removed. If you see errors for critical columns, something went wrong.

### RLS policy errors
Check that RLS is still enabled on `user_profiles`:
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'user_profiles';
```

Should return `user_profiles | t`

### Function errors
Verify critical functions exist:
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('is_officer_or_admin', 'is_lead_officer', 'sync_troll_role');
```

### Missing data
If profile data is missing, check the user's auth record:
```sql
SELECT id, email, created_at 
FROM auth.users 
WHERE id = 'user-uuid-here';
```

Then ensure a profile exists:
```sql
SELECT * FROM user_profiles WHERE id = 'user-uuid-here';
```

---

# Generated
Date: 2026-02-10
Validation scripts added
