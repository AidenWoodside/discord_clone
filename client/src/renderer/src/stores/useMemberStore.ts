import { create } from 'zustand';
import type { UserPublic } from 'discord-clone-shared';
import { apiClient } from '../services/apiClient';

interface MemberState {
  members: UserPublic[];
  isLoading: boolean;
  error: string | null;
  fetchMembers: () => Promise<void>;
  clearError: () => void;
}

export const useMemberStore = create<MemberState>((set) => ({
  members: [],
  isLoading: false,
  error: null,
  fetchMembers: async () => {
    set({ isLoading: true, error: null });

    try {
      const members = await apiClient.get<UserPublic[]>('/api/users');
      set({ members, isLoading: false, error: null });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load members';
      set({ isLoading: false, error: message });
    }
  },
  clearError: () => set({ error: null }),
}));
