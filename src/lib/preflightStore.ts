import type { LocalVideoTrack, LocalAudioTrack, Room } from 'livekit-client';

interface PreflightState {
  token: string | null;
  roomName: string | null;
  url: string | null;
  // Track enabled states from setup page
  isVideoEnabled: boolean;
  isAudioEnabled: boolean;
  // Battle mode flag - when true, TrollEngine should be hidden
  isInBattle: boolean;
  // Broadcast mode flag - when true, TrollEngine should be hidden (hosting or watching)
  isInBroadcast: boolean;
  // Global flag to disable battles - no users can start battles when true
  battlesDisabled: boolean;
  // Tutorial mode flag - when true, TrollEngine should be hidden
  inTutorial: boolean;
  // LiveKit room and tracks from SetupPage
  livekitRoom: Room | null;
  livekitTracks: [LocalAudioTrack | null, LocalVideoTrack | null] | null;
  // Screen share mode flag for gaming category
  isScreenShareMode: boolean;
  // Screen track for gaming screen share
  screenTrack: LocalVideoTrack | null;
}

const state: PreflightState = {
  token: null,
  roomName: null,
  url: null,
  isVideoEnabled: true,
  isAudioEnabled: true,
  isInBattle: false,
  isInBroadcast: false,
  battlesDisabled: false, // Battles enabled for all users
  inTutorial: false, // Tutorial mode - disables TrollEngine
  livekitRoom: null,
  livekitTracks: null,
  isScreenShareMode: false,
  screenTrack: null,
};

export const PreflightStore = {
  setToken(token: string | null, roomName: string | null, url: string | null) {
    state.token = token;
    state.roomName = roomName;
    state.url = url;
  },

  getToken() {
    return { token: state.token, roomName: state.roomName, url: state.url };
  },

  // Track enabled states from setup page
  setTrackEnabledStates(isVideoEnabled: boolean, isAudioEnabled: boolean) {
    state.isVideoEnabled = isVideoEnabled;
    state.isAudioEnabled = isAudioEnabled;
  },

  getTrackEnabledStates() {
    return { isVideoEnabled: state.isVideoEnabled, isAudioEnabled: state.isAudioEnabled };
  },

  // Set battle mode - used to hide TrollEngine during battles
  setInBattle(inBattle: boolean) {
    state.isInBattle = inBattle;
    console.log('[PreflightStore] setInBattle:', inBattle);
  },

  // Get battle mode status
  getInBattle(): boolean {
    return state.isInBattle;
  },

  // Set broadcast mode - used to hide TrollEngine when broadcasting or watching
  setInBroadcast(inBroadcast: boolean) {
    if (state.isInBroadcast === inBroadcast) return;
    state.isInBroadcast = inBroadcast;
    if (import.meta.env.DEV) {
      console.log('[PreflightStore] setInBroadcast:', inBroadcast);
    }
  },

  // Get broadcast mode status
  getInBroadcast(): boolean {
    return state.isInBroadcast;
  },

  // Set battles disabled/enabled - globally blocks battle functionality when true
  setBattlesDisabled(disabled: boolean) {
    state.battlesDisabled = disabled;
    console.log('[PreflightStore] setBattlesDisabled:', disabled);
  },

  // Get battles disabled status
  getBattlesDisabled(): boolean {
    return state.battlesDisabled;
  },

  // Set tutorial mode - used to hide TrollEngine during onboarding
  setInTutorial(inTutorial: boolean) {
    state.inTutorial = inTutorial;
    console.log('[PreflightStore] setInTutorial:', inTutorial);
  },

  // Get tutorial mode status
  getInTutorial(): boolean {
    return state.inTutorial;
  },

  // Store LiveKit room from SetupPage
  setLivekitRoom(room: Room | null) {
    state.livekitRoom = room;
  },

  // Get LiveKit room for reuse in BroadcastPage
  getLivekitRoom(): Room | null {
    return state.livekitRoom;
  },

  // Store LiveKit tracks from SetupPage
  setLivekitTracks(tracks: [LocalAudioTrack | null, LocalVideoTrack | null] | null) {
    state.livekitTracks = tracks;
  },

  // Get LiveKit tracks for reuse in BroadcastPage
  getLivekitTracks(): [LocalAudioTrack | null, LocalVideoTrack | null] | null {
    return state.livekitTracks;
  },

  // Get tracks as object for easier access (alternative to tuple)
  getTracks(): { audioTrack: LocalAudioTrack | null; videoTrack: LocalVideoTrack | null } | null {
    if (!state.livekitTracks) return null;
    return {
      audioTrack: state.livekitTracks[0],
      videoTrack: state.livekitTracks[1],
    };
  },

  // Set screen share mode flag
  setScreenShareMode(isScreenShare: boolean) {
    state.isScreenShareMode = isScreenShare;
    console.log('[PreflightStore] setScreenShareMode:', isScreenShare);
  },

  // Get screen share mode flag
  getScreenShareMode(): boolean {
    return state.isScreenShareMode;
  },

  // Store screen track for gaming screen share
  setScreenTrack(track: LocalVideoTrack | null) {
    state.screenTrack = track;
    console.log('[PreflightStore] setScreenTrack:', track ? 'available' : 'null');
  },

  // Get screen track for gaming screen share
  getScreenTrack(): LocalVideoTrack | null {
    return state.screenTrack;
  },

  clear() {
    state.token = null;
    state.roomName = null;
    state.url = null;
    state.isVideoEnabled = true;
    state.isAudioEnabled = true;
    state.isInBattle = false;
    state.isInBroadcast = false;
    state.battlesDisabled = false; // Battles remain enabled on clear
    state.livekitRoom = null;
    state.livekitTracks = null;
    state.isScreenShareMode = false;
    state.screenTrack = null;
  }
};
