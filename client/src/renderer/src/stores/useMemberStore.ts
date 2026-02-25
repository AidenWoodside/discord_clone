import { create } from 'zustand';
import { apiRequest } from '../services/apiClient';
import type { UserPublic } from 'discord-clone-shared';

interface MemberState {
  members: UserPublic[];
  isLoading: boolean;
  error: string | null;
  fetchMembers: () => Promise<void>;
  removeMember: (userId: string) => void;
  clearError: () => void;
}

export const useMemberStore = create<MemberState>((set) => ({
  members: [],
  isLoading: false,
  error: null,
  fetchMembers: async () => {
    set({ isLoading: true, error: null });
    try {
      const members = await apiRequest<UserPublic[]>('/api/users');
      set({ members, isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },
  removeMember: (userId: string) => set((state) => ({
    members: state.members.filter((m) => m.id !== userId),
  })),
  clearError: () => set({ error: null }),
}));
