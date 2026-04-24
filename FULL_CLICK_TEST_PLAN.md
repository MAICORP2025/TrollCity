# 🧪 FULL CLICK TEST PLAN - COMPREHENSIVE ROLE-BASED QA

**Status:** Ready for Manual Testing  
**Date:** April 20, 2026  
**Objective:** Verify every button/action works for all user roles without errors

---

## 📋 TEST ACCOUNTS SETUP

### Test User Accounts (Use these for manual testing):
```
1. Admin Account: admin@test.com / QaRole2026!23
2. Lead Troll Officer: qa_lead_troll_officer@example.test / QaRole2026!23
3. Troll Officer: qa_troll_officer@example.test / QaRole2026!23
4. Secretary: qa_secretary@example.test / QaRole2026!23
5. Pastor: qa_pastor@example.test / QaRole2026!23
6. TCNN: qa_tcnn@example.test / QaRole2026!23
7. Regular User (10x): qa_user_01 through qa_user_10 / QaRole2026!23
8. Broadcaster: qa_broadcaster@example.test / QaRole2026!23
9. Family Leader: qa_family_leader@example.test / QaRole2026!23
```

---

## 🎯 PAGES TO TEST (40+ Routes)

### PUBLIC PAGES (All roles can access)
- [ ] `/` - Home/Landing
- [ ] `/auth?mode=signup` - Signup
- [ ] `/auth?mode=login` - Login
- [ ] `/legal/privacy` - Privacy Policy
- [ ] `/legal/terms` - Terms of Service

### USER PAGES (Logged-in users)
- [ ] `/profile/:id` - User Profile
- [ ] `/profile/edit` - Edit Profile
- [ ] `/wallet` - Coin Wallet
- [ ] `/marketplace` - Marketplace
- [ ] `/messages` - Direct Messages
- [ ] `/notifications` - Notifications
- [ ] `/settings` - User Settings
- [ ] `/leaderboard` - Leaderboards
- [ ] `/challenges` - Battle Challenges

### BROADCAST PAGES
- [ ] `/broadcast/setup` - Start Broadcast
- [ ] `/broadcast/:id` - Watch Broadcast
- [ ] `/broadcast/summary/:id` - Broadcast Summary
- [ ] `/tcnn` - TCNN Dashboard (TCNN role only)

### FAMILY SYSTEM
- [ ] `/families` - Family Directory
- [ ] `/family/:id` - Family Profile
- [ ] `/family/create` - Create Family
- [ ] `/family/:id/chat` - Family Chat

### CITY FEATURES
- [ ] `/city` - City Map
- [ ] `/cityhall` - City Hall (Admin)
- [ ] `/living` - Living Spaces
- [ ] `/jobs` - Job Board
- [ ] `/auctions` - Live Auctions
- [ ] `/marketplace/items` - Marketplace Items

### STAFF PAGES (Role-specific - should be blocked for regular users)
- [ ] `/lead-officer` - Lead Officer Dashboard
- [ ] `/officer/lounge` - Officer Lounge
- [ ] `/officer/dashboard` - Officer Dashboard
- [ ] `/officer/moderation` - Moderation Panel
- [ ] `/officer/scheduling` - Officer Scheduling
- [ ] `/secretary` - Secretary Dashboard
- [ ] `/church/pastor` - Pastor Dashboard
- [ ] `/admin` - Admin Dashboard
- [ ] `/admin/payments` - Payment Management
- [ ] `/admin/hr` - HR Management
- [ ] `/admin/manual-orders` - Manual Orders
- [ ] `/admin/appeals` - Appeals Management
- [ ] `/admin/creator-approvals` - Creator Approvals
- [ ] `/government/streams` - Government Streams
- [ ] `/government/announcements` - Government Announcements
- [ ] `/admin/reports` - Reports & Analytics
- [ ] `/admin/risk` - Risk Management

---

## 🔘 CRITICAL BUTTONS TO TEST

### Authentication Buttons
- [x] Signup Button - All roles should succeed
- [x] Login Button - All credentials should work
- [x] Logout Button - Should clear session
- [x] "Forgot Password" Link
- [x] "Remember Me" Checkbox

### Profile Buttons
- [ ] Upload Avatar Button
- [ ] Edit Profile Button
- [ ] Change Password Button
- [ ] Delete Account Button (if available)
- [ ] Save Profile Changes Button

### Wallet/Payment Buttons
- [ ] Buy Coins Button
- [ ] Send Gift Button (during broadcast)
- [ ] Withdraw/Cashout Button (broadcasters only)
- [ ] Add Payment Method Button
- [ ] Remove Payment Method Button
- [ ] Complete Payment Button

### Broadcast Buttons
- [ ] "Start Broadcasting" Button
- [ ] "End Broadcast" Button
- [ ] Camera Toggle Button
- [ ] Microphone Toggle Button
- [ ] Screen Share Button
- [ ] Record Stream Button
- [ ] Settings Button
- [ ] Chat Buttons (Send Message, React, etc.)

### Moderation Buttons (Officers/Admins only)
- [ ] Approve User Button
- [ ] Reject User Button
- [ ] Mute/Unmute User Button
- [ ] Ban User Button
- [ ] Unban User Button
- [ ] Issue Warning Button
- [ ] Suspend Account Button
- [ ] Freeze Account Button
- [ ] Assign Role Button
- [ ] Remove Role Button

### Family System Buttons
- [ ] Create Family Button
- [ ] Join Family Button
- [ ] Leave Family Button
- [ ] Invite Member Button
- [ ] Remove Member Button
- [ ] Accept Invite Button
- [ ] Reject Invite Button
- [ ] Send Family Gift Button
- [ ] Accept Gift Button

### City/Economy Buttons
- [ ] Buy Property Button
- [ ] Sell Property Button
- [ ] Rent Room Button
- [ ] Post Job Button
- [ ] Apply for Job Button
- [ ] Cancel Job Application Button
- [ ] Place Auction Bid Button
- [ ] Cancel Bid Button

### Admin Actions (Admin only)
- [ ] Create Announcement Button
- [ ] Delete Announcement Button
- [ ] Generate Reports Button
- [ ] Export Data Button
- [ ] Bulk Action Buttons
- [ ] System Settings Buttons

---

## 🚨 PERMISSION ERRORS TO CHECK

### Regular User Restrictions (Should be BLOCKED)
Regular users attempting these should see error messages:
- [ ] Cannot access `/admin` - Should redirect
- [ ] Cannot access `/officer/moderation` - Should redirect
- [ ] Cannot access `/lead-officer` - Should redirect
- [ ] Cannot access `/secretary` - Should redirect
- [ ] Cannot access `/government/streams` - Should redirect
- [ ] Cannot broadcast if not approved broadcaster
- [ ] Cannot moderate/ban users
- [ ] Cannot freeze accounts
- [ ] Cannot access `/tcnn` (if not TCNN)

### Officer Restrictions
- [ ] Officers cannot access `/lead-officer` (unless promoted)
- [ ] Officers cannot access `/admin` (unless promoted)
- [ ] Officers cannot access `/secretary` (unless promoted)
- [ ] Officers cannot approve roles (only lead officers)

### Role-Specific Pages
- [ ] Pastors can only access `/church/pastor`
- [ ] TCNN can only access `/tcnn` and `/tcnn/dashboard`
- [ ] Secretaries can only access `/secretary`, `/government/streams`, `/admin/manual-orders`, `/admin/appeals`

---

## 🔍 ERROR SCENARIOS TO TEST

### Database-Related (POST-FIX VALIDATION)
- [x] ~~Missing `last_active` column~~ - FIXED
- [x] ~~Missing `recipient_id` column~~ - FIXED
- [x] ~~Foreign key violation in `user_entrance_effects`~~ - FIXED
- [ ] Profile updates should not fail
- [ ] Message sending should work
- [ ] Online status tracking should update

### Network/Realtime Issues (POST-FIX VALIDATION)
- [x] ~~Connection leaks after 20-30 page visits~~ - FIXED
- [x] ~~Broadcast presence storm with 4+ users~~ - FIXED
- [x] ~~Heartbeat_presence not debounced~~ - FIXED
- [ ] Presence subscriptions should cleanup properly
- [ ] Channels should unsubscribe on unmount
- [ ] No resource exhaustion errors

### Form Submission Issues
- [ ] All forms should submit without console errors
- [ ] Validation messages should display correctly
- [ ] File uploads should complete successfully
- [ ] Error messages should be user-friendly

---

## ✅ MANUAL TEST CHECKLIST

### Setup Phase
- [ ] Clear browser cache
- [ ] Close all tabs except development server
- [ ] Open DevTools Console (F12)
- [ ] Monitor Console for any errors
- [ ] Monitor Network tab for failed requests
- [ ] Test with desktop browser (Chrome/Firefox)
- [ ] Test with mobile viewport (DevTools)

### Role-Based Testing (Test each role separately)
For each role:
1. **Login**
   - [ ] Login succeeds
   - [ ] Profile loads
   - [ ] No console errors

2. **Navigation**
   - [ ] Click each navigation link
   - [ ] Verify correct page loads
   - [ ] No 404 or 403 errors
   - [ ] Breadcrumbs work correctly

3. **Button Testing**
   - [ ] Click every visible button
   - [ ] Verify action completes
   - [ ] No console errors
   - [ ] Loading states show correctly

4. **Permission Testing**
   - [ ] Access denied pages redirect correctly
   - [ ] No 401/403 errors in console
   - [ ] Error messages display to user
   - [ ] Redirect to login/home works

5. **Form Testing**
   - [ ] Fill out all forms
   - [ ] Submit each form
   - [ ] Validation works
   - [ ] Success messages display
   - [ ] Data persists on refresh

---

## 🎬 BROADCAST STRESS TEST (if applicable)

- [ ] Host can start broadcast without errors
- [ ] Viewers can join broadcast without errors
- [ ] Officers can moderate broadcast without errors
- [ ] Chat functions properly with multiple users
- [ ] Gifts can be sent during broadcast
- [ ] Stream summary loads after broadcast ends

---

## 📊 ISSUE TRACKING

### Critical Issues Found
| Issue | Role Affected | Page | Action | Status |
|-------|---------------|------|--------|--------|
| | | | | |

### Non-Critical Issues Found
| Issue | Role Affected | Page | Action | Status |
|-------|---------------|------|--------|--------|
| | | | | |

### Permission Violations
| Issue | Expected | Actual | Status |
|-------|----------|--------|--------|
| | | | |

---

## 🔧 FIXES APPLIED (April 20, 2026)

### Database Fixes ✅
- Added `last_active` column to `user_profiles`
- Added `online_status` column to `user_profiles`
- Added `recipient_id` column to `messages`
- Verified foreign keys in `user_entrance_effects`

### Code Fixes ✅
- Fixed React hooks error in `GlobalPresenceTracker.tsx`
- Debounced `heartbeat_presence` calls (60s minimum interval)
- Debounced online count fetch (45s minimum interval)
- Improved channel subscription cleanup in BroadcastPage
- Improved channel subscription cleanup in ViewerPage

### Performance Improvements ✅
- Presence updates limited to max once per 10 seconds per status change
- Heartbeat calls limited to max once per 60 seconds per user
- Connection pool management improved
- Subscription cleanup enforced on all useEffect cleanups

---

## 📝 TEST EXECUTION LOG

**Tester Name:** ________________  
**Date:** ________________  
**Total Accounts Tested:** ______  
**Total Pages Tested:** ______  
**Total Buttons Tested:** ______  
**Passed:** ______  
**Failed:** ______  
**Blocked:** ______  

---

## ✨ SIGN-OFF

- [ ] All critical buttons tested for all roles
- [ ] No permission violations detected
- [ ] No console errors encountered
- [ ] All error messages are user-friendly
- [ ] Performance is acceptable
- [ ] Ready for public launch

**Approved By:** ________________  
**Date:** ________________

