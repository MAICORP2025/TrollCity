# Task Checklist - ALL COMPLETED ✅

## Issue 1: Broadcaster Can't Hear Seat Joiners (Bug Fix)
- [x] **Fixed!** RemoteSeatSurface in BroadcastPage.tsx - always render audio element regardless of video track presence
  - Changed from: `if (!videoTrack) return <>{fallback}</>` (early return without audio)
  - Changed to: Conditionally render video/fallback but ALWAYS render `audio` element

## Issue 2: Chat Messages Disappear After 30 Seconds
- [x] **Fixed!** BroadcastChat.tsx - changed MESSAGE_LIFETIME_MS from 60000 (60s) to 30000 (30s)
- [x] **Fixed!** BroadcastPage.tsx - changed floating chat timeout from 60000ms (60s) to 30000ms (30s)
- [x] **Fixed!** ViewerPage.tsx - changed CHAT_FLOAT_MS from 20000/10000ms (20s/10s) to 30000ms (30s)

