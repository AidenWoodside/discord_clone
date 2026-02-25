import { create } from 'zustand';
import type { Channel } from 'discord-clone-shared';
import { apiRequest } from '../services/apiClient';

export type ChannelListItem = Pick<Channel, 'id' | 'name' | 'type' | 'createdAt'>;

function sortChannels(list: ChannelListItem[]): ChannelListItem[] {
  return [...list].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'text' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

interface ChannelState {
  channels: ChannelListItem[];
  activeChannelId: string | null;
  isLoading: boolean;
  error: string | null;
  fetchChannels: () => Promise<void>;
  setActiveChannel: (channelId: string) => void;
  clearError: () => void;
  addChannel: (channel: ChannelListItem) => void;
  removeChannel: (channelId: string) => void;
  createChannel: (name: string, type: 'text' | 'voice') => Promise<void>;
  deleteChannel: (channelId: string) => Promise<void>;
}

export const useChannelStore = create<ChannelState>((set) => ({
  channels: [],
  activeChannelId: null,
  isLoading: false,
  error: null,
  fetchChannels: async () => {
    set({ isLoading: true, error: null });
    try {
      const channels = await apiRequest<ChannelListItem[]>('/api/channels');
      set({ channels: sortChannels(channels), isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },
  setActiveChannel: (channelId) => set({ activeChannelId: channelId }),
  clearError: () => set({ error: null }),

  addChannel: (channel) => {
    set((state) => ({
      channels: sortChannels([...state.channels, channel]),
    }));
  },

  removeChannel: (channelId) => {
    set((state) => {
      const remaining = state.channels.filter((c) => c.id !== channelId);
      let { activeChannelId } = state;

      if (activeChannelId === channelId) {
        const firstText = remaining.find((c) => c.type === 'text');
        activeChannelId = firstText?.id ?? null;
      }

      return { channels: remaining, activeChannelId };
    });
  },

  createChannel: async (name, type) => {
    await apiRequest('/api/channels', {
      method: 'POST',
      body: JSON.stringify({ name, type }),
    });
    // Do NOT optimistically add — wait for WS channel:created broadcast
  },

  deleteChannel: async (channelId) => {
    await apiRequest(`/api/channels/${channelId}`, {
      method: 'DELETE',
    });
    // Do NOT optimistically remove — wait for WS channel:deleted broadcast
  },
}));
