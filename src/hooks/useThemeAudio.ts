
import { create } from 'zustand';

interface ThemeAudioState {
  isPlaying: boolean;
  playTheme: () => void;
  stopTheme: () => void;
  toggleTheme: () => void;
}

export const useThemeAudio = create<ThemeAudioState>((set) => ({
  isPlaying: false,
  playTheme: () => set({ isPlaying: true }),
  stopTheme: () => set({ isPlaying: false }),
  toggleTheme: () => set((state) => ({ isPlaying: !state.isPlaying })),
}));
