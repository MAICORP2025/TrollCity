import { create } from 'zustand'

interface ChatBubbleState {
  isOpen: boolean
  activeUserId: string | null
  activeUsername: string | null
  activeUserAvatar: string | null
  openChatBubble: (userId: string, username: string, avatarUrl: string | null) => void
  closeChatBubble: () => void
  toggleChatBubble: () => void
}

export const useChatStore = create<ChatBubbleState>((set) => ({
  isOpen: false,
  activeUserId: null,
  activeUsername: null,
  activeUserAvatar: null,
  openChatBubble: (userId, username, avatarUrl) => set({
    isOpen: true,
    activeUserId: userId,
    activeUsername: username,
    activeUserAvatar: avatarUrl
  }),
  closeChatBubble: () => set({ isOpen: false }),
  toggleChatBubble: () => set((state) => ({ isOpen: !state.isOpen }))
}))
