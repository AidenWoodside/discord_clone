import { create } from 'zustand';
import type { PresenceUpdatePayload } from 'discord-clone-shared';

type ConnectionState = 'connected' | 'connecting' | 'disconnected' | 'reconnecting';

interface PresenceState {
  onlineUsers: Map<string, PresenceUpdatePayload>;
  connectionState: ConnectionState;
  isLoading: boolean;
  error: string | null;
  setUserOnline: (userId: string) => void;
  setUserOffline: (userId: string) => void;
  syncOnlineUsers: (users: PresenceUpdatePayload[]) => void;
  setConnectionState: (state: ConnectionState) => void;
  clearError: () => void;
}

export const usePresenceStore = create<PresenceState>((set) => ({
  onlineUsers: new Map(),
  connectionState: 'disconnected',
  isLoading: false,
  error: null,

  setUserOnline: (userId: string) =>
    set((state) => {
      const next = new Map(state.onlineUsers);
      next.set(userId, { userId, status: 'online' });
      return { onlineUsers: next };
    }),

  setUserOffline: (userId: string) =>
    set((state) => {
      const next = new Map(state.onlineUsers);
      next.delete(userId);
      return { onlineUsers: next };
    }),

  syncOnlineUsers: (users: PresenceUpdatePayload[]) =>
    set(() => {
      const next = new Map<string, PresenceUpdatePayload>();
      for (const user of users) {
        next.set(user.userId, user);
      }
      return { onlineUsers: next };
    }),

  setConnectionState: (connectionState: ConnectionState) => set({ connectionState }),

  clearError: () => set({ error: null }),
}));
