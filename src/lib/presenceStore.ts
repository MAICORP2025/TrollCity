import { create } from 'zustand';

interface PresenceState {
  onlineCount: number;
  onlineUserIds: string[];
  setOnlineCount: (count: number) => void;
  setOnlineUserIds: (ids: string[]) => void;
}

export const usePresenceStore = create<PresenceState>((set) => ({
  onlineCount: 0,
  onlineUserIds: [],
  setOnlineCount: (count) => set({ onlineCount: count }),
  setOnlineUserIds: (ids) => set({ onlineUserIds: ids }),
}));
