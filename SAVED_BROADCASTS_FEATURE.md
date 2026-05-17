# Save Broadcast to Profile Feature

## Overview
Allows users to save their broadcasts to their profile for later viewing. Streams are automatically saved when they end, and can optionally be manually saved before starting from the setup page.

## Database Schema

### Table: `saved_streams`
```sql
CREATE TABLE saved_streams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    stream_id UUID NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
    saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source TEXT DEFAULT 'manual', -- 'manual' | 'auto_stream_end' | 'auto_summary'
    UNIQUE(user_id, stream_id)
);
```

**Indexes:**
- `idx_saved_streams_user_id` on `(user_id, saved_at DESC)` - fast lookup of user's saved streams
- `idx_saved_streams_stream_id` on `(stream_id)` - check if stream already saved

**RLS Policies:**
- Users can view their own saved streams
- Users can insert their own saved streams
- Users can delete their own saved streams

## Feature Components

### 1. Setup Page (`/broadcast/setup`)

**UI Changes:**
- Added **"Save Broadcast"** button next to "Start Broadcast"
- Button is secondary styling (zinc/gray) when not saved
- Button turns green with checkmark after clicking
- Disabled after saved to prevent duplicate saves

**Behavior:**
- User clicks "Save Broadcast" → optimistic UI update (button turns green)
- When stream is created, the save is recorded in `saved_streams` table with `source='manual'`
- If stream fails to create, the optimistic state is not persisted (acceptable edge case)

**Code Location:** `src/pages/broadcast/SetupPage.tsx`
- State: `const [isSaved, setIsSaved] = useState(false);`
- Handler: `handleSaveStream()` sets `isSaved = true` and shows toast
- Insert happens after stream creation: `INSERT INTO saved_streams ...`

### 2. Stream Summary Page (`/broadcast/summary/:streamId`)

**Auto-Save on Stream End:**
- When stream ends, the summary page automatically saves the stream to the broadcaster's profile
- Uses database trigger + front-end double-save for reliability
- Shows green status banner: **"Saved to Profile"**

**Code Location:** `src/pages/broadcast/StreamSummary.tsx`
- State: `const [isSaved, setIsSaved] = useState(false);`
- Effect: Auto-saves on mount if broadcaster and not already saved
- UI: Green status box below user info

### 3. Database Trigger (Auto-Save)

**Trigger Function:** `auto_save_stream_on_end()`
- Fires when `streams.status` changes to `'ended'`
- Saves stream for broadcaster automatically (`source='auto_stream_end'`)
- Also saves for all participants with `stream_seat_sessions` who joined the stream
- Uses `ON CONFLICT DO NOTHING` to avoid duplicates

**Location:** `supabase/migrations/20250425000000_saved_streams.sql`

## User Experience Flow

1. **Pre-Stream (Setup Page):**
   - User configures stream (title, category, theme)
   - Optionally clicks "Save Broadcast" to mark for later viewing
   - Clicks "Start Broadcast"

2. **During Stream:**
   - Stream runs normally
   - Save status is tracked in client state only

3. **Post-Stream (Summary Page):**
   - User sees stream stats (likes, gifts, viewers)
   - Green "Saved to Profile" banner appears if save succeeded
   - Stream is now available in user's profile "Past Broadcasts" section

## Profile Integration

The "Past Broadcasts" component (`src/components/profile/PastBroadcasts.tsx`) shows:
- All streams where `broadcaster_id = user.id` AND `status = 'ended'` AND `recording_url IS NOT NULL`
- The `saved_streams` join is NOT yet implemented - future enhancement could show "Saved" tab separate from own broadcasts

## Migration

Run the migration to create the table and trigger:
```bash
supabase db push 20250425000000_saved_streams.sql
```

Or apply manually via Supabase SQL Editor.

## Testing

1. Go to `/broadcast/setup`
2. Configure and click "Save Broadcast" (button turns green)
3. Click "Start Broadcast"
4. End stream (or let it time out)
5. On summary page, verify "Saved to Profile" green banner appears
6. Check database: `SELECT * FROM saved_streams WHERE user_id = 'your-user-id'`

## Edge Cases Handled

- **Duplicate saves:** `ON CONFLICT DO NOTHING` prevents duplicates
- **Unauthenticated users:** Save button disabled/hidden
- **Stream creation fails:** Optimistic UI may be wrong, but next load correct
- **Non-broadcaster viewers:** Cannot save (only broadcaster gets auto-save)
- **Tab closed before stream end:** No auto-save (trigger runs on DB update, so still saves if stream ended)

## Future Enhancements

- Allow viewers to save other users' broadcasts (bookmark feature)
- Show saved streams count on profile
- Add "Unsave" button on summary page
- Include saved streams in a separate "Saved" tab on profile
- Push notification when a saved stream ends (if user wasn't watching)
