# Broadcast Lockdown & Admin Control System

## Overview
The Broadcast Lockdown system allows admins to control broadcast creation, ensuring only the admin can create broadcasts when activated. Others can still join, view, and participate in the admin's broadcast.

## Features Implemented

### 1. ✅ Broadcast Lockdown Toggle (Admin Dashboard)
**Location**: `Admin Control Panel` → Top Section (Broadcast Lockdown Control)

**What it does**:
- **ON (Lockdown Active 🔴)**: Only admin can create new broadcasts. Everyone else sees error when trying to go live.
- **OFF (Normal Mode 🟢)**: Everyone can create and join broadcasts normally.

**Settings Available**:
- **Lockdown Toggle Button**: Instantly enable/disable lockdown
- **Admin Broadcast Room Name**: Optional - Set a specific room name for the admin's broadcast

### 2. ✅ Go Live Page Restrictions
**Location**: `GoLive.tsx` page

**When Lockdown is Active**:
- Warning banner displays: "🔴 Broadcast Lockdown Active"
- Shows: "Only the admin can create new broadcasts right now. You can still join and participate in the admin's broadcast!"
- Non-admin users get error: "🔴 Broadcasts are currently locked. Only the admin can broadcast right now."
- Admin can bypass and create broadcasts normally

**When Lockdown is OFF**:
- No restrictions
- Everyone can create broadcasts
- Go Live button works for all users

### 3. ✅ Joining Broadcasts (Always Allowed)
**Important**: Broadcast lockdown ONLY restricts CREATION, not joining.

**When Lockdown is Active**:
- ✅ Anyone can join the admin's broadcast
- ✅ Anyone can view/watch the broadcast
- ✅ Anyone can participate (chat, send gifts, use boxes, etc.)
- ✅ Officers, secretaries, admin can take moderation actions
- ✅ All user interactions work normally

**Accessing Admin's Broadcast**:
- Go to Watch/Browse page
- Find the admin's active broadcast
- Click to join/view
- All features available

### 4. ✅ User Action Menus
All user action menus are fully implemented and work across the platform:

#### Username Click Actions (ClickableUsername Component)
When you click on a username (in chat, seats, profiles, etc.):

**View Profile**
- Navigates to user's profile page
- View level, coins, badges, achievements

**Issue Warrant** (Admin/Officer/Secretary)
- Temporarily restrict user access
- Requires reason
- User must appear in court

**Mute User** (Global Mute)
- Prevents user from typing in chat/messages
- Specify mute duration in minutes
- Requires reason
- Optional cost for non-staff (25 coins)

**Delete User** (Admin Only - Requires Confirmation)
- Permanently removes user from system
- Cannot be undone
- Requires admin authorization

**Ban User** (Admin/Officer)
- Restricts all activities
- Requires reason
- User appears on ban list

#### Broadcast Seat Actions (Click on seat user)
When you click on a user in a broadcast seat:

**Send Gift**
- Opens gift selector
- Specify amount and gift type
- User receives coins/rewards

**Mute in Stream** (Officer/Admin/Secretary)
- Prevents audio in current broadcast only
- Doesn't affect user globally
- Can be unmuted later
- Free for staff (25 coins for others)

**Kick from Stream**
- Removes user from seat
- Can rejoin if allowed
- Logged for records

**Unmute User**
- Restores audio if previously muted
- Staff only

**Record Action**
- Logs action for audit trail
- Tracks by officer/admin/secretary
- Includes timestamp and reason

#### General Chat User Actions
When clicking users in chat/messages:

**View Profile**
- Profile page with all info
- Chat history
- Gift history

**Direct Actions** (Officers/Admin have context menu)
- Right-click or button menu
- Take instant action
- Logged automatically

### 5. ✅ Officer/Secretary/Admin Permission Checks

**Who can moderate**:
- Admin (all actions available)
- Officers (most moderation actions)
- Secretaries (limited actions)
- Broadcasters (can moderate their own broadcast)

**Action Validation**:
- Automatic permission check on every action
- Error messages if insufficient permissions
- Audit logging of all actions

## Database Structure

### admin_settings Table
```sql
CREATE TABLE admin_settings (
    id UUID PRIMARY KEY,
    setting_key TEXT UNIQUE,
    setting_value JSONB,  -- {"enabled": true, "admin_broadcast_room": "room-name"}
    description TEXT,
    updated_by UUID,
    updated_at TIMESTAMP,
    created_at TIMESTAMP
)
```

### Broadcast Lockdown Value Format
```json
{
  "enabled": true,  // or false
  "admin_broadcast_room": "room-name-or-null"
}
```

## File Structure

### New Files Created
1. `/supabase/migrations/20270121100000_broadcast_lockdown_system.sql`
   - Creates admin_settings table
   - Sets up RLS policies
   - Initializes broadcast_lockdown_enabled setting

2. `/src/lib/hooks/useBroadcastLockdown.ts`
   - React hook for broadcast lockdown state
   - Load and update settings
   - Permission checking function
   - Real-time subscription to changes

3. `/src/components/admin/BroadcastLockdownToggle.tsx`
   - Admin dashboard component
   - Toggle button with visual feedback
   - Optional admin broadcast room name input
   - Status information display

### Modified Files
1. `/src/pages/admin/components/AdminControlPanel.tsx`
   - Added BroadcastLockdownToggle import
   - Placed toggle at top of admin dashboard

2. `/src/pages/GoLive.tsx`
   - Added useBroadcastLockdown hook import
   - Added lockdown permission check in stream creation
   - Added visual alert banner when lockdown active
   - Added isAdmin calculation

## Usage Guide

### For Admin Users

**To Activate Broadcast Lockdown**:
1. Go to Admin Control Panel
2. See "Broadcast Lockdown Control" section at top
3. Click "Turn On" button
4. Optionally set admin broadcast room name
5. Lockdown immediately active

**To Deactivate Broadcast Lockdown**:
1. Go to Admin Control Panel
2. Click "Turn Off" button
3. Everyone can now create broadcasts again

**To Take Moderation Actions**:
1. Find user in chat, seat, or profile
2. Click username/user box
3. Select action from menu:
   - View Profile
   - Issue Warrant
   - Mute User (global)
   - Ban User
   - Delete User
4. Confirm action if needed
5. Action logged automatically

**To Moderate a Broadcast**:
1. Join the broadcast
2. Click on user in a seat or in chat
3. Available actions:
   - Send Gift
   - Mute in Stream
   - Kick from Stream
   - Unmute User
4. All actions logged

### For Regular Users

**When Broadcast Lockdown is Active**:
1. Cannot create/go live broadcasts
2. Can join and participate in admin's broadcast
3. Can view all broadcasts
4. All normal interactions work

**To Join Admin's Broadcast**:
1. Go to Watch/Browse page
2. Find admin's active broadcast
3. Click to join/view
4. Full access to broadcast features
5. Can chat, gift, use boxes, etc.

## Error Messages

| Situation | Message | Action |
|-----------|---------|--------|
| Non-admin tries to broadcast during lockdown | "🔴 Broadcasts are currently locked. Only the admin can broadcast right now." | Prompt to join admin's broadcast instead |
| Broadcasting requires 500 coins | "You need at least 500 coins to go live..." | Earn coins or check balance |
| Insufficient permissions for action | "You do not have permission to [action]" | Contact admin if needed |
| User not found for action | "Cannot perform action: User ID not found" | Try again |

## Real-time Updates

The system uses Supabase real-time subscriptions:
- When admin toggles lockdown, all clients update within seconds
- No page refresh needed
- Users see the state change in real-time

## Security

**RLS Policies**:
- Only admin email (trollcity2025@gmail.com) or admin role can update settings
- All users can read broadcast_lockdown_enabled status
- Service role has full access for backend operations

**Audit Logging**:
- All moderation actions logged to action_logs table
- Timestamp, actor, target, action type recorded
- Reason/details stored in metadata
- Non-repudiable record of all actions

## Testing Checklist

- [ ] Toggle lockdown on/off and verify status updates
- [ ] Non-admin user tries to go live during lockdown (should fail with message)
- [ ] Admin can go live during lockdown normally
- [ ] Users can join admin's broadcast during lockdown
- [ ] Click username opens action menu for staff
- [ ] Mute action mutes user globally
- [ ] Seat mute mutes only in that broadcast
- [ ] Kick action removes user from seat
- [ ] Gift sending works and coins transfer
- [ ] Warrant action creates court case
- [ ] All actions logged with timestamps
- [ ] Messages refresh in real-time
- [ ] Officer/secretary actions work per role
- [ ] Admin actions work without restriction

## Future Enhancements

Potential features to add:
1. Whitelist specific users who can broadcast during lockdown
2. Schedule automatic lockdown enable/disable
3. Broadcast quality restrictions during lockdown
4. Max viewers limit during lockdown
5. Special lockdown announcement to all users
6. Lockdown statistics and reporting
7. Broadcast content moderation during lockdown
8. Auto-recording during lockdown for compliance
