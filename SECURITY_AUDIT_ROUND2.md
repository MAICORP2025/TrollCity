# Security Audit Report — Round 2
**Date:** 2026-01-16  
**Scope:** Storage policies, service role exposure, SECURITY DEFINER functions, admin authorization, rate limiting

---

## 🔴 CRITICAL — Immediate Action Required

### 1. Service Role Key Exposed in Client Bundle
**File:** `vite.config.ts:48`  
**Issue:** `VITE_SUPABASE_SERVICE_ROLE_KEY` was being injected into the client-side JavaScript bundle via Vite's `define` block. Anyone could extract the service role key from the production JS bundle and use it to bypass all RLS policies.  
**Status:** ✅ **FIXED** — Removed from `define` block.

### 2. Hardcoded Service Role Key in Source Code
**File:** `update_tiers.js:5`  
**Issue:** Service role key was hardcoded as a fallback value in a server script.  
**Status:** ✅ **FIXED** — Removed hardcoded fallback, now throws error if env var missing.

### 3. env.example Contains Real Production Secrets
**File:** `env.example` (committed to git since initial commit)  
**Issue:** Contains real service role key, Mux tokens, PayPal credentials, VAPID keys, Cloudflare R2 credentials, LiveKit secrets, Agora certificate.  
**Status:** ✅ **FIXED** — Replaced all values with placeholders.  
**⚠️ URGENT:** All secrets previously in `env.example` are compromised and must be rotated immediately:
- Supabase service role key → regenerate in Supabase dashboard
- Mux token ID + secret → regenerate in Mux dashboard  
- PayPal client ID + secret → regenerate in PayPal developer dashboard
- VAPID keys → regenerate
- Cloudflare R2 access keys → regenerate in Cloudflare dashboard
- LiveKit API key + secret → regenerate in LiveKit dashboard
- Agora app certificate → regenerate in Agora console

### 4. SECURITY DEFINER RPC Functions — No Server-Side Authorization

These functions are `GRANT EXECUTE TO authenticated` with **zero** server-side role checks. Any authenticated user can call them directly from the browser console:

| Function | What It Does | Risk |
|---|---|---|
| `set_user_role(UUID)` | Sets any user's role to admin | **CRITICAL — Full privilege escalation** |
| `remove_broadofficer(UUID)` | Strips any user's officer roles | **CRITICAL** |
| `troll_bank_credit_coins(UUID, INT)` | Adds unlimited coins to any account | **CRITICAL — Economy exploitation** |
| `troll_bank_spend_coins(UUID, INT)` | Drains coins from any account | **CRITICAL** |
| `try_pay_coins(UUID, UUID, INT)` | Transfers coins between arbitrary users | **CRITICAL** |
| `spend_coins(...)` | Spends coins from any sender to any receiver | **CRITICAL** |
| `send_gift_v2(...)` | Sends gifts from any user | **CRITICAL** |
| `process_gift_with_lucky(...)` | Transfers coins + lucky multipliers between arbitrary users | **CRITICAL** |
| `approve_manual_order(UUID)` | Approves coin orders, credits coins to any user | **CRITICAL** |
| `add_troll_coins(UUID, INT)` | Legacy wrapper — adds coins to any user | **CRITICAL** |
| `add_free_coins(UUID, INT)` | Legacy wrapper — adds free coins to any user | **CRITICAL** |
| `admin_grant_coins(UUID, INT)` | Legacy wrapper — grants coins to any user | **CRITICAL** |
| `apply_troll_pass_bundle(UUID)` | Grants troll pass + 1500 coins to any user | **HIGH** |
| `process_boosted_gift(...)` | Credits coins to any user without auth | **HIGH** |
| `process_stream_billing(...)` | Triggers billing for any user | **HIGH** |

**Location:** `supabase/migrations/20260420000002_mod_actions_rpcs.sql`, `supabase/migrations/20260120000002_troll_bank_spend.sql`, `supabase/migrations/20270327000020_secure_credit_coins.sql`, `supabase/migrations/20260120000600_missing_gift_rpcs.sql`, `supabase/migrations/20260120000300_refactor_more_legacy_functions.sql`, `supabase/migrations/20260120001000_legacy_wrappers.sql`

**Required Fix:** Either:
- (a) Revoke `GRANT EXECUTE ON FUNCTION ... FROM authenticated` and only grant to `service_role`, OR
- (b) Add server-side role checks: `IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin')) THEN RAISE EXCEPTION 'Unauthorized';`

### 5. `troll_bank_credit_coins` Has Empty search_path
**File:** `supabase/migrations/20270327000020_secure_credit_coins.sql`  
**Issue:** `SET search_path = ''` could allow search_path injection attacks.  
**Required Fix:** Change to `SET search_path = public`

### 6. Missing search_path on Most SECURITY DEFINER Functions
**Issue:** The vast majority of `SECURITY DEFINER` functions don't set `search_path`, making them vulnerable to schema injection attacks where an attacker creates objects in schemas that get resolved before `public`.  
**Required Fix:** Add `SET search_path = public` to all `SECURITY DEFINER` functions.

---

## 🟠 HIGH — Storage Bucket Policies

### 7. Buckets With NO Policies (Inactive/Commented Out)
These buckets have all policies commented out, making them accessible only via service_role:
- `verification_docs` — ID verification documents
- `avatars` — User profile pictures
- `troll-city-assets` — Fallback upload bucket
- `hls` — HLS streaming segments
- `pod-covers` — Podcast cover images

**Impact:** If the application expects users to upload to these buckets, uploads will fail silently. If these buckets store sensitive data (like ID documents), they may be inaccessible even to admins through normal channels.

### 8. Buckets With NO SQL Definition At All
These buckets are actively used in frontend code but have **zero** policy definitions in the codebase:
- `auction-items` — Auction lot images
- `payout_receipts` — Payout receipt uploads
- `music_tracks` — Music uploads
- `post-images` — Shop/product/marketplace/vehicle images
- `family-banners` — Family profile banners
- `vehicle-documents` — VIN verification PDFs
- `tax_forms` — W9 tax form PDFs
- `user-verification` — Generic verification files
- `gift-videos` — Gift animation videos

**Risk:** If policies were configured manually in the Supabase dashboard, they may be permissive by default. If no policies exist at all, the buckets are inaccessible (Supabase default-deny).

### 9. Overly Permissible Bucket Policies
- **`treelz-videos`**: Any authenticated user can delete ANY file (no folder/owner restriction)
- **`review-images`**: Any authenticated user can upload without folder restrictions
- **`appeal-media`**: Any authenticated user can upload without folder restrictions

---

## 🟡 MEDIUM — Admin Authorization

### 10. Frontend-Only Admin Checks
The `RequireRole` component (`src/components/RequireRole.tsx`) uses client-side profile data from the Zustand store. While this is acceptable for UX (showing/hiding UI), it means:
- A user could manipulate client-side state to render admin pages
- The actual API protection depends entirely on RLS and server-side function checks

**Verified:** Most sensitive operations (ban, set_role, approve_payout, etc.) DO have proper server-side RLS enforcement. The frontend checks are defense-in-depth.

### 11. Direct Client Operations on Sensitive Tables
- `moderation_actions` — Direct `.update()` from `noah-assistant-dashboard.tsx` and `ceo-assistant-dashboard.tsx` with no visible server-side check
- `coin_transactions` — Direct `.insert()` from multiple service files
- `user_profiles` — Direct `.delete()` from `ClickableUsername.tsx:546` (only protected by RLS)

---

## 🟡 MEDIUM — Missing Rate Limiting

### 12. Report Submission — No Rate Limiting
**Files:** `treelzService.ts:495`, `utromailService.ts:585`  
**Issue:** No rate limiting on report submission. An attacker could spam reports to harass users or overwhelm moderation.  
**Recommendation:** Add per-user rate limiting (e.g., max 10 reports/hour) via `security_check_rate_limit` RPC.

### 13. Battle Invitations — No Rate Limiting
**File:** `supabase/functions/battles/index.ts`  
**Issue:** No rate limiting on battle creation/invitation.  
**Recommendation:** Add `security_check_rate_limit` with per-user bucket.

### 14. Stream Creation — No Rate Limiting
**File:** `server/routes/broadcasts.ts:48`  
**Issue:** No rate limit on starting broadcasts.  
**Recommendation:** Add per-user rate limiting.

### 15. Signup Edge Function — Weak Rate Limiting
**File:** `supabase/functions/auth/index.ts:459`  
**Issue:** Only relies on Supabase Auth's built-in IP-level limits. No CAPTCHA, no email-based rate limiting.  
**Recommendation:** Add server-side rate limiting + CAPTCHA.

---

## ✅ Well-Protected Operations

These operations have proper server-side authorization:
- `approve_payout` / `reject_payout` — Edge function checks `isAdmin`
- `ban_user` (via admin panel) — SQL function checks actor role
- `set_user_role` (via edge function) — SQL function checks admin role
- `approve_manual_order` — Edge function checks role
- `moderation take_action` — Edge function checks officer role
- Gift sending (`trg_gift_rate_limit`) — DB trigger: 6 gifts/min per sender
- Chat messages (`trg_stream_chat_rate_limit`) — DB trigger: 30 msg/min per stream

---

## Summary

| Severity | Count | Status |
|---|---|---|
| 🔴 CRITICAL | 6 | 3 fixed, 3 need RPC function updates |
| 🟠 HIGH | 3 | Need storage bucket policy creation |
| 🟡 MEDIUM | 6 | Need rate limiting + RLS hardening |

### Files Modified in This Round
1. `vite.config.ts` — Removed service role key from client bundle
2. `update_tiers.js` — Removed hardcoded service role key
3. `env.example` — Replaced all real secrets with placeholders

### Immediate Next Steps Required
1. **Rotate all secrets** that were in `env.example` (see list in section 3)
2. **Create migration** to fix the 13+ critical RPC functions with no auth checks
3. **Create storage bucket policies** for the 9+ buckets with no SQL-defined policies
4. **Add `SET search_path = public`** to all SECURITY DEFINER functions
5. **Add rate limiting** to report submission and battle creation
