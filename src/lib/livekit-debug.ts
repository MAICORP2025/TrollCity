import { 
   RoomEvent, 
   ConnectionState, 
   Track 
 } from "livekit-client" 
 
 export function attachLiveKitDebug(room: any) { 
   if (!room) return 
 
   console.log("✅ LiveKit debug attached") 
 
   room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => { 
     console.log("🔌 ConnectionStateChanged:", state) 
   }) 
 
   room.on(RoomEvent.Disconnected, (reason: any) => { 
     console.error("❌ LIVEKIT DISCONNECTED. Reason:", reason) 
   }) 
 
   room.on(RoomEvent.Reconnecting, () => { 
     console.warn("⚠️ LIVEKIT RECONNECTING...") 
   }) 
 
   room.on(RoomEvent.Reconnected, () => { 
     console.log("✅ LIVEKIT RECONNECTED") 
   }) 
 
   room.on(RoomEvent.ParticipantConnected, (p: any) => { 
     console.log("👤 ParticipantConnected:", p.identity) 
   }) 
 
   room.on(RoomEvent.ParticipantDisconnected, (p: any) => { 
     console.log("👤 ParticipantDisconnected:", p.identity) 
   }) 
 
   room.on(RoomEvent.LocalTrackPublished, (pub: any) => { 
     console.log("🎥 LocalTrackPublished:", pub.trackSid, pub.source) 
   }) 
 
   room.on(RoomEvent.LocalTrackUnpublished, (pub: any) => { 
     console.warn("🎥 LocalTrackUnpublished:", pub.trackSid, pub.source) 
   }) 
 
   room.on(RoomEvent.TrackPublishFailed, (track: Track, err: any) => { 
     console.error("❌ TrackPublishFailed:", track?.source, err) 
   }) 
 
   room.on(RoomEvent.MediaDevicesError, (err: any) => { 
     console.error("❌ MediaDevicesError:", err) 
   }) 
 }
