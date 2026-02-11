# Database Cleanup Analysis

## Overview
This document provides a comprehensive analysis of unused tables and columns in the public schema, with specific instructions on what to keep vs remove.

---

# STATUS SUMMARY

## Tables Status
| Table | Action |
|-------|--------|
| `public.asset_auctions` | REMOVE (scheduled) |
| `public.auction_bids` | REMOVE (scheduled) |
| `public.visitor_stats` | REMOVE (scheduled) |
| `public.troll_events` | REMOVE (scheduled) |
| `public.user_health_records` | REMOVE (scheduled) |
| `public.staff_profiles` | REMOVE |
| `public.troll_dna_profiles` | REMOVE |
| `public.profiles` | REMOVE (use user_profiles instead) |

## Columns Status
| Category | Action |
|----------|--------|
| Economy columns | REMOVE unused ones |
| Insurance | IMPLEMENT with KTauto Dealership/Properties |
| Multipliers | REMOVE |
| Payout/Financial | REMOVE |
| Empire/Partner | REMOVE |
| Troll Officer | REMOVE (use role column) |
| Restrictions | REMOVE |
| Influencer/Tier | REMOVE |
| ID Verification | REMOVE |
| Employment | REMOVE |
| Username Effects | REMOVE |
| Address Fields | REMOVE |
| Coin History | REMOVE (use troll_coins) |
| IP Address History | REMOVE |

---

# REMOVE TABLES SQL

```sql
-- Drop unused tables

DROP TABLE IF EXISTS public.asset_auctions CASCADE;
DROP TABLE IF EXISTS public.auction_bids CASCADE;
DROP TABLE IF EXISTS public.visitor_stats CASCADE;
DROP TABLE IF EXISTS public.troll_events CASCADE;
DROP TABLE IF EXISTS public.user_health_records CASCADE;
DROP TABLE IF EXISTS public.staff_profiles CASCADE;
DROP TABLE IF EXISTS public.troll_dna_profiles CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
```

---

# REMOVE COLUMNS SQL

## Economy Columns (Remove)
```sql
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS sav_bonus_coins;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS owc_balance;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS total_owc_earned;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS vivied_bonus_coins;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS reserved_paid_coins;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS reserved_troll_coins;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS trollmonds;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS earned_coins;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS total_coins_earned;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS total_coins_spent;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS coin_balance;
```

## Multipliers (Remove)
```sql
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS multiplier_active;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS multiplier_value;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS multiplier_expires;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS xp_multiplier;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS coin_multiplier;
```

## Payout/Financial (Remove)
```sql
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS payout_method;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS payout_details;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS payout_destination_masked;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS preferred_payout_method;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS payout_paypal_email;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS tax_status;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS tax_id_last4;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS tax_classification;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS w9_status;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS w9_verified_at;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS payout_frozen;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS payout_freeze_reason;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS payout_freeze_at;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS last_payout_at;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS lifetime_payout_total;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS total_earned_usd;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS creator_trust_score;
```

## Empire/Partner (Remove)
```sql
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS empire_role;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS empire_partner;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS partner_status;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS is_empire_partner;
```

## Troll Officer (Remove - use role column instead)
```sql
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS is_troller;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS troller_level;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS is_officer;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS officer_level;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS officer_role;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS officer_tier_badge;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS is_officer_active;
```

## Restrictions (Remove)
```sql
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS no_kick_until;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS no_ban_until;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS live_restricted_until;
```

## Influencer/Tier (Remove)
```sql
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS influence_tier;
```

## ID Verification (Remove)
```sql
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS id_document_url;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS id_uploaded_at;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS id_verification_status;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS verified_creator;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS verification_paid_amount;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS verification_payment_method;
```

## Employment (Remove)
```sql
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS is_employee;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS employee_role;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS hire_date;
```

## Username Effects (Remove)
```sql
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS username_effect;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS username_effect_expires_at;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS active_entrance_effect_id;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS has_paid;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS first_seen_at;
```

## Address Fields (Remove)
```sql
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS address_line1;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS address_line2;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS state_region;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS postal_code;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS street_address;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS city;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS state;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS country;
```

## IP Address History (Remove)
```sql
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS ip_address_history;
```

## Other Unused (Remove)
```sql
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS platform_fee_last_charged;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS user_id;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS boost_reduced_fees_until;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS boost;
```

---

# KEEP COLUMNS

These columns should be kept and potentially implemented/used:

| Column | Data Type | Notes |
|--------|-----------|-------|
| `ghost_mode_expires_at` | timestamp with time zone | Ghost mode functionality |
| `court_recording_consent_at` | timestamp with time zone | Court recording consent |
| `troll_pass_last_purchased_at` | timestamp with time zone | Troll pass purchase history |
| `application_submitted` | boolean | Application submission status |
| `application_required` | boolean | Application requirement flag |
| `seller_verified` | boolean | Seller verification |
| `onboarded_at` | timestamp with time zone | Onboarding completion time |
| `profile_view_price` | integer | Profile view pricing |
| `platform_fee_last_charged` | timestamp with time zone | Platform fee tracking |
| `user_id` | uuid | May have legacy uses |
| `last_kicked_at` | timestamp with time zone | Kick history |
| `ban_expires_at` | timestamp with time zone | Ban expiration |
| `rank` | character varying(50) | User ranking |

---

# INSURANCE SYSTEM

## Current Status: IMPLEMENT WITH KTAUTO DEALERSHIP AND PROPERTIES

**Note:** Insurance columns should be integrated with the KTauto Dealership and Properties systems unless there's a separate dedicated insurance system.

If implementing with KTauto/Properties:
```sql
-- Remove old insurance columns when new system is in place
-- Reference: has_insurance, insurance_type, insurance_expires_at, insurance_level
```

If separate insurance system is not planned:
```sql
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS has_insurance;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS insurance_type;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS insurance_expires_at;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS insurance_level;
```

---

# COMPLETE REMOVAL MIGRATION

```sql
-- Complete cleanup migration
-- Run this in a single migration file

-- Drop unused tables
DROP TABLE IF EXISTS public.asset_auctions CASCADE;
DROP TABLE IF EXISTS public.auction_bids CASCADE;
DROP TABLE IF EXISTS public.visitor_stats CASCADE;
DROP TABLE IF EXISTS public.troll_events CASCADE;
DROP TABLE IF EXISTS public.user_health_records CASCADE;
DROP TABLE IF EXISTS public.staff_profiles CASCADE;
DROP TABLE IF EXISTS public.troll_dna_profiles CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Economy columns
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS sav_bonus_coins;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS owc_balance;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS total_owc_earned;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS vivied_bonus_coins;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS reserved_paid_coins;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS reserved_troll_coins;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS trollmonds;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS earned_coins;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS total_coins_earned;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS total_coins_spent;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS coin_balance;

-- Multipliers
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS multiplier_active;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS multiplier_value;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS multiplier_expires;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS xp_multiplier;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS coin_multiplier;

-- Payout/Financial
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS payout_method;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS payout_details;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS payout_destination_masked;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS preferred_payout_method;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS payout_paypal_email;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS tax_status;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS tax_id_last4;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS tax_classification;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS w9_status;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS w9_verified_at;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS payout_frozen;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS payout_freeze_reason;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS payout_freeze_at;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS last_payout_at;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS lifetime_payout_total;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS total_earned_usd;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS creator_trust_score;

-- Empire/Partner
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS empire_role;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS empire_partner;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS partner_status;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS is_empire_partner;

-- Troll Officer (use role column)
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS is_troller;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS troller_level;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS is_officer;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS officer_level;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS officer_role;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS officer_tier_badge;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS is_officer_active;

-- Restrictions
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS no_kick_until;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS no_ban_until;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS live_restricted_until;

-- Influencer/Tier
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS influence_tier;

-- ID Verification
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS id_document_url;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS id_uploaded_at;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS id_verification_status;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS verified_creator;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS verification_paid_amount;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS verification_payment_method;

-- Employment
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS is_employee;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS employee_role;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS hire_date;

-- Username Effects
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS username_effect;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS username_effect_expires_at;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS active_entrance_effect_id;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS has_paid;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS first_seen_at;

-- Address Fields
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS address_line1;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS address_line2;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS state_region;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS postal_code;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS street_address;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS city;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS state;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS country;

-- IP Address History
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS ip_address_history;

-- Other Unused
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS platform_fee_last_charged;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS user_id;
```

---

# VALIDATION

Before running cleanup:

1. ✅ Backup database
2. ✅ Run in development environment first
3. ✅ Check for any missed code references
4. ✅ Test all core functionality
5. ✅ Verify RLS policies still work
6. ✅ Check edge functions don't break

---

# Generated
Date: 2026-02-10
Based on user feedback and codebase analysis
