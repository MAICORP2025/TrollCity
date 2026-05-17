# Mux CDN Integration - Broadcaster API Flow Guide

## Overview

When a broadcaster goes live, the system needs to:
1. Create a Mux live stream (gets RTMP ingestion URL + playback ID)
2. Start LiveKit Egress to send the room composite to the RTMP URL  
3. Store all IDs in `stream_mux_outputs` table
4. Update the `streams` table with playback ID + other metadata
5. Return playback ID to frontend for MuxViewer component

## Architecture

```
SetupPage (stream created with status='live')
    ↓
BroadcastPage (loads + joins LiveKit room)
    ↓
[NEW] Call POST /api/broadcasts/start when room is ready
    ↓
Backend: Create Mux stream → Start LiveKit egress → Save to DB
    ↓
Frontend: Render MuxViewer with muxPlaybackId
    ↓
Viewers watch via HLS (Mux playback) + optional participant mode (LiveKit)
```

## Database Schema Changes

**Migration:** `20250425000001_add_mux_fields_to_streams.sql`

Adds to `streams` table:
- `mux_id` - FK to stream_mux_outputs
- `mux_playback_id` - Used by MuxViewer component (safe to expose)
- `mux_stream_key` - Reference only (never expose actual stream key)
- `mux_rtmp_url` - Internal only (never expose to client)
- `broadcaster_id` - Mirror of user_id for clarity
- `is_live` - Boolean tracking actual broadcast status
- `start_time`, `end_time` - Timestamps
- `livekit_room_name` - Room name for egress
- `egress_id` - ID for stopping egress

## Backend API Endpoints

### POST /api/broadcasts/start
**Location:** `server/routes/broadcasts.ts`

**Body:**
```json
{
  "streamId": "uuid",
  "roomName": "room-name",
  "broadcasterId": "uuid",
  "title": "Stream Title"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "muxPlaybackId": "playback-id",
  "muxLiveStreamId": "live-stream-id",
  "rtmpUrl": "rtmp://...",
  "roomName": "room-name",
  "outputId": "stream-mux-output-id"
}
```

**Errors:**
- 400: Missing required parameters
- 500: Mux API error or DB error

**Security:**
- Never returns `stream_key` or `stream_secret`
- Only returns `muxPlaybackId` (safe for frontend)
- Server holds all secrets in environment variables

### POST /api/broadcasts/stop
**Location:** `server/routes/broadcasts.ts`

**Body:**
```json
{
  "streamId": "uuid"
}
```

**Security:**
- Server internally looks up muxLiveStreamId from DB
- Disables Mux stream via API
- Updates stream_mux_outputs status
- Updates streams table status to 'ended'

### GET /api/broadcasts/:streamId/status
**Location:** `server/routes/broadcasts.ts`

**Response (200 OK):**
```json
{
  "id": "uuid",
  "title": "Stream Title",
  "status": "live|ended",
  "isLive": true|false,
  "muxPlaybackId": "playback-id",
  "broadcasterId": "uuid",
  "roomName": "room-name",
  "startTime": "ISO-8601",
  "endTime": "ISO-8601"
}
```

## Frontend Hook: useBroadcastStreaming

**Location:** `src/hooks/useBroadcastStreaming.ts`

```typescript
import { useBroadcastStreaming } from '../../hooks/useBroadcastStreaming';

function BroadcasterControls() {
  const { status, loading, startBroadcast, stopBroadcast } = useBroadcastStreaming(streamId);

  return (
    <>
      <button onClick={() => startBroadcast('Stream Title', roomName)} disabled={loading}>
        {loading ? 'Starting...' : 'Go Live'}
      </button>
      <button onClick={stopBroadcast} disabled={loading || !status.isLive}>
        {loading ? 'Stopping...' : 'End Broadcast'}
      </button>
      <p>Status: {status.status}</p>
      {status.muxPlaybackId && <p>Playback ID: {status.muxPlaybackId}</p>}
    </>
  );
}
```

### Hook Functions

#### `startBroadcast(title: string, roomName: string)`
- Calls POST `/api/broadcasts/start`
- Updates local state with muxPlaybackId
- Shows toast notification
- Returns response data (includes muxPlaybackId)

#### `stopBroadcast()`
- Calls POST `/api/broadcasts/stop`
- Updates local state to ended
- Shows toast notification

#### `getStatus()`
- Calls GET `/api/broadcasts/:streamId/status`
- Updates local state with current status
- Returns response data

## Integration Points

### 1. In BroadcastPage.tsx - After LiveKit Room Joins

```typescript
import { useBroadcastStreaming } from '../../hooks/useBroadcastStreaming';

function BroadcastPage() {
  const streamId = params.id || params.streamId;
  const { status, startBroadcast } = useBroadcastStreaming(streamId);

  // After room joins successfully
  useEffect(() => {
    if (isHost && room && stream?.status === 'live' && !muxStarted.current) {
      muxStarted.current = true;
      console.log('[BroadcastPage] Starting Mux streaming...');
      startBroadcast(stream.title || 'Live Stream', stream.agora_channel)
        .catch(err => console.error('[BroadcastPage] Mux start failed:', err));
    }
  }, [isHost, room, stream]);
}
```

### 2. In BroadcastPage.tsx - When Stream Ends

```typescript
// When broadcaster clicks "End Broadcast"
const handleEndBroadcast = async () => {
  await stopBroadcast();
  // Then proceed with stream cleanup
  // Update stream status to 'ended'
  // etc.
};
```

### 3. In MuxViewer Component - Real-time Updates

The `MuxViewer.tsx` component already handles real-time subscription to `stream_mux_outputs` table and updates the playback ID when it becomes available.

```typescript
// In MuxViewer component - listens for mux_playback_id updates
useEffect(() => {
  const channel = supabase
    .channel(`stream_mux_${streamId}`)
    .on('postgres_changes', { 
      event: 'UPDATE', 
      schema: 'public', 
      table: 'stream_mux_outputs',
      filter: `stream_id=eq.${streamId}`
    }, (payload) => {
      if (payload.new.mux_playback_id) {
        setPlaybackId(payload.new.mux_playback_id);
      }
    })
    .subscribe();
}, [streamId]);
```

## Data Flow Example

### Broadcaster Goes Live
```
1. User clicks "Start Broadcast" in SetupPage
   └─> Stream created: id=abc123, status='live', is_live=true

2. Navigate to BroadcastPage
   └─> Stream fetched from DB

3. LiveKit room joined successfully
   └─> Call startBroadcast('My Stream', 'room-abc123')

4. Backend receives POST /api/broadcasts/start
   └─> Create Mux live stream
   └─> Get mux_playback_id, rtmp_ingest_url
   └─> Insert into stream_mux_outputs
   └─> Start LiveKit egress to RTMP
   └─> Update streams table with mux_id, mux_playback_id, egress_id
   └─> Return muxPlaybackId to frontend

5. Frontend updates local state
   └─> MuxViewer component detects mux_playback_id
   └─> Renders <mux-player playbackId={muxPlaybackId} />

6. Viewer navigates to /broadcast/abc123
   └─> ViewerPage loads stream + mux_playback_id
   └─> Option A: Watch via MuxViewer (HLS/CDN - cheapest)
   └─> Option B: Join as participant (LiveKit - higher quality/interactivity)

7. Broadcaster clicks "End Broadcast"
   └─> Call stopBroadcast()
   └─> Backend disables Mux stream
   └─> Backend stops LiveKit egress
   └─> Frontend navigates to summary page
```

## Environment Variables

**Backend (.env):**
```
MUX_TOKEN_ID=a796ed09-0368-498e-ad3f-9523ad69a0d5
MUX_TOKEN_SECRET=CfqzUp0nKTr1Ut3W9h8VNBKAiwAmRAI+HZC1dy9cGkZma+8mAl18BSjc/h2KV2kCIp1Ez4QA/HX
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
LIVEKIT_URL=http://localhost:7880  # or your cloud URL
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret
```

**Frontend (.env.local):**
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_BROADCAST_API_URL=http://localhost:3000  # or your server URL
```

## Testing Checklist

- [ ] Migration applied to database (`20250425000001_add_mux_fields_to_streams.sql`)
- [ ] Backend server running (listens on port 3000 or configured port)
- [ ] Environment variables set (.env for backend, .env.local for frontend)
- [ ] Start a broadcast and verify:
  - [ ] Stream created with is_live=true, status='live'
  - [ ] After joining room, startBroadcast is called
  - [ ] POST /api/broadcasts/start returns 200 with muxPlaybackId
  - [ ] streams table updated: mux_playback_id, mux_id, is_live=true
  - [ ] stream_mux_outputs table has record with mux_playback_id
  - [ ] MuxViewer component displays playback (if integrated)
- [ ] Stop broadcast and verify:
  - [ ] POST /api/broadcasts/stop returns 200
  - [ ] stream_mux_outputs.mux_status = 'completed'
  - [ ] streams.is_live = false, status = 'ended'

## Troubleshooting

### "Stream not found" in startBroadcast
- Verify streamId passed to useBroadcastStreaming is correct
- Check that stream exists in DB with is_live=true

### "Failed to create Mux live stream"
- Verify MUX_TOKEN_ID and MUX_TOKEN_SECRET are correct
- Check Mux API status at status.mux.com
- Review backend logs for Mux API error details

### muxPlaybackId is null after calling startBroadcast
- Verify POST /api/broadcasts/start completed successfully (check response)
- Query DB: `SELECT * FROM stream_mux_outputs WHERE stream_id='abc123'`
- Verify mux_playback_id was set in streams table
- Check MuxViewer real-time subscription is working

### "Cannot read properties of undefined (reading 'rtmp')" in backend
- Verify Mux response includes data.playback_ids array
- Add error handling for missing Mux response fields
- Check Mux API documentation for live stream response schema

## Cost Analysis

- **Mux viewers only:** ~$0.01/hour per concurrent viewer
- **LiveKit + Mux hybrid:** Viewers start on Mux (cheap), can join as participants (interactive)
- **Est. savings:** 72% cheaper than all-LiveKit viewers

## Security Considerations

**NEVER expose to frontend:**
- MUX_TOKEN_SECRET
- stream_key (actual RTMP key)
- stream_secret
- LIVEKIT_API_SECRET

**ALWAYS expose to frontend (safe):**
- mux_playback_id (read-only, viewer mode only)
- mux_status (informational)
- is_live (informational)

**Implement on backend:**
- Validate streamId ownership before returning data
- Rate limit /api/broadcasts/start to prevent abuse
- Log all Mux API calls for audit trail
- Implement webhook handlers for Mux events (optional)

## Mux Events (Optional Webhooks)

Mux can send webhooks for:
- Stream started
- Stream ended
- Playback ID created
- Errors

To implement: Set webhook URL in Mux dashboard → Backend handler processes events.

## Next Steps After Integration

1. **Deploy backend** to Render or other hosting
2. **Add mux-player script** to index.html: `<script src="https://cdn.jsdelivr.net/npm/@mux/mux-player@latest"></script>`
3. **Integrate MuxViewer** into viewer pages
4. **Test end-to-end** with actual broadcast
5. **Monitor costs** in Mux dashboard
6. **Set up webhook handlers** for stream events (optional)
7. **Implement fallback modes** if Mux API unavailable
