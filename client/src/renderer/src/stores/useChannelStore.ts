import { create } from 'zustand';
import type { Channel } from 'discord-clone-shared';
import { apiClient } from '../services/apiClient';

interface ChannelState {
  channels: Channel[];
  activeChannelId: string | null;
  isLoading: boolean;
  error: string | null;
  fetchChannels: () => Promise<void>;
  setActiveChannel: (channelId: string) => void;
  clearError: () => void;
}

function sortChannels(channels: Channel[]): Channel[] {
  return [...channels].sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'text' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}

export const useChannelStore = create<ChannelState>((set, get) => ({
  channels: [],
  activeChannelId: null,
  isLoading: false,
  error: null,
  fetchChannels: async () => {
    set({ isLoading: true, error: null });

    try {
      const channels = sortChannels(await apiClient.get<Channel[]>('/api/channels'));
      const currentActive = get().activeChannelId;
      const hasCurrentActive = currentActive ? channels.some((channel) => channel.id === currentActive) : false;
      const firstTextChannel = channels.find((channel) => channel.type === 'text');

      set({
        channels,
        activeChannelId: hasCurrentActive ? currentActive : (firstTextChannel?.id ?? channels[0]?.id ?? null),
        isLoading: false,
        error: null,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load channels';
      set({ isLoading: false, error: message });
    }
  },
  setActiveChannel: (channelId: string) => set({ activeChannelId: channelId }),
  clearError: () => set({ error: null }),
}));
