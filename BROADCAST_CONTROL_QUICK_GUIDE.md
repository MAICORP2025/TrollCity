# 🎛️ Admin Broadcast Control - Quick Reference

## Where to Find It

**Admin Control Panel** → Top Section → "Broadcast Lockdown Control"

## What It Does

### 🟢 Lockdown OFF (Normal Mode)
- Everyone can create broadcasts
- Everyone can join broadcasts
- No restrictions

### 🔴 Lockdown ON (Admin Only Mode)
- **Only you (admin) can create broadcasts**
- Others can **ONLY join your broadcast**
- Others can chat, gift, and interact normally
- Officers/secretaries can still moderate

## How to Use It

### Enable Lockdown (One Click)
1. Go to Admin Control Panel
2. See "Broadcast Lockdown Control" box at top
3. Click **"Turn On"** button
4. Status changes to red 🔴

### Disable Lockdown (One Click)
1. Go to Admin Control Panel
2. Click **"Turn Off"** button
3. Status changes to green 🟢

### Optional: Set Admin Broadcast Room Name
- Type room name in the text field
- Leave empty for default
- Helps organize multiple broadcast sessions
- Updates automatically

## What Users See

### When Trying to Broadcast During Lockdown
```
🔴 Broadcasts are currently locked. 
Only the admin can broadcast right now. 
Try again later or join the admin's broadcast!
```

### When Accessing Go Live Page
- Red alert banner explaining lockdown
- "Go Live Now!" button is disabled (for non-admins)
- Helpful message suggesting to join admin's broadcast

## User Actions Still Work

When lockdown is ON, all these still work normally:

✅ Clicking usernames to view profiles  
✅ Issuing warrants  
✅ Muting users  
✅ Banning users  
✅ Sending gifts  
✅ Moderating in broadcast  
✅ Chat and interactions  
✅ Officer/Secretary actions  

## Real-Time Updates

- Changes apply **instantly** across all users
- No need to refresh browsers
- Users see changes in real-time
- Status visible to everyone

## Common Scenarios

### Scenario 1: Morning Stream
1. Admin wants exclusive broadcast time
2. Turn ON lockdown
3. Create your broadcast
4. Users join your broadcast
5. Everyone participates together
6. Turn OFF lockdown when done

### Scenario 2: Event Control
1. Special event happening
2. Turn ON to centralize streaming
3. Only admin broadcasts the event
4. Everyone watches and participates
5. Officers moderate interaction
6. Turn OFF after event ends

### Scenario 3: Server Issues
1. Server experiencing problems
2. Turn ON lockdown
3. Limit active broadcasts to one
4. Reduces server load
5. Easier to monitor and control
6. Turn OFF when issues resolved

## What Can Still Happen (Even During Lockdown)

✅ Users can join broadcasts  
✅ Users can chat and message  
✅ Users can send gifts and boxes  
✅ Users can earn coins  
✅ Users can use perks  
✅ Officers can moderate  
✅ Admin can do anything normally  
✅ Everything runs smoothly  

## What CANNOT Happen (When Locked)

❌ Regular users cannot CREATE broadcasts  
❌ Regular users cannot go live  
❌ Non-admin cannot start new streams  

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Lockdown won't turn on | Refresh page, try again |
| Users still see old status | Wait 2-3 seconds, real-time syncing |
| Can't find the toggle | Verify you're admin, check Admin Control Panel |
| Button is disabled/greyed | May be updating, wait a moment |

## Tips & Tricks

💡 **Set room name before going live** - Helps users find your broadcast easily  
💡 **Announce lockdown in chat first** - Users will understand why broadcast is restricted  
💡 **Use for special events** - Great for exclusive streams or server management  
💡 **Check it weekly** - Remember to turn it off after special occasions  

## Under the Hood

- Setting stored in: `admin_settings` database table
- Real-time using: Supabase subscriptions
- Updated instantly: No lag or delays
- Secure: Only admin can change, all users can see status

## Admin Tips

### Best Practices
1. **Always announce** when enabling lockdown
2. **Set a clear room name** for organization
3. **Turn off when done** - Don't forget!
4. **Check status** before major streams
5. **Use for events** - Perfect for controlled content

### Command Reference
```
Turn ON Lockdown:  Click "Turn On" button
Turn OFF Lockdown: Click "Turn Off" button
Set Room Name:     Type in text field (optional)
Update Name:       Changes save automatically
View Status:       Red = Locked, Green = Open
```

---

**Need Help?** Check BROADCAST_LOCKDOWN_ADMIN_GUIDE.md for detailed info!
