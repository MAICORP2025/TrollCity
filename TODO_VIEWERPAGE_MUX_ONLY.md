# TODO_VIEWERPAGE_MUX_ONLY

## Goal
Make **passive viewers** use **ViewerPage (Mux HLS only)**.

## Steps
1. Rewrite `src/pages/broadcast/ViewerPage.tsx`:
   - Remove LiveKit viewer logic (LiveKit imports, token requests, Room connect, RemoteParticipant state/components).
   - Add `MuxHlsVideo` component (hls_url or mux playback derived M3U8, hls.js fallback, muted autoplay + tap-to-sound, error recovery, cleanup).
   - Ensure stream-ended redirect only on `status === 'ended' || is_live === false`.
2. Viewer seat UI correction:
   - Stop rendering `BroadcastControls` / `BroadcastGrid` in ViewerPage.
   - Add a lightweight ViewerSeatBar that uses `useStreamSeats` to display seats and calls `joinSeat(index, price)`.
   - After successful join, navigate to seat-mode: `/broadcast/:streamId?seat=${index+1}&mode=seat`.
3. Compile check + runtime verification.

## Progress
- [ ] Step 1: ViewerPage rewrite to Mux-only + MuxHlsVideo
- [ ] Step 2: Viewer seat bar + navigation to BroadcastPage seat mode
- [ ] Step 3: TypeScript build/lint + verify logs

