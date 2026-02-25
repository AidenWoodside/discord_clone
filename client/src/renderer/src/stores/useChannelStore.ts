import { create } from 'zustand';
import { apiRequest } from '../services/apiClient';

export interface ChannelItem {
  id: string;
  name: string;
  type: 'text' | 'voice';
  createdAt: string;
}

interface ChannelState {
  channels: ChannelItem[];
  activeChannelId: string | null;
  isLoading: boolean;
  error: string | null;
  fetchChannels: () => Promise<void>;
  setActiveChannel: (channelId: string) => void;
  clearError: () => void;
}

export const useChannelStore = create<ChannelState>((set) => ({
  channels: [],
  activeChannelId: null,
  isLoading: false,
  error: null,
  fetchChannels: async () => {
    set({ isLoading: true, error: null });
    try {
      const channels = await apiRequest<ChannelItem[]>('/api/channels');
      const sorted = [...channels].sort((a, b) => {
        if (a.type !== b.type) return a.type === 'text' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      set({ channels: sorted, isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },
  setActiveChannel: (channelId) => set({ activeChannelId: channelId }),
  clearError: () => set({ error: null }),
}));
