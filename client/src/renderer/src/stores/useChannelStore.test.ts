import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

import { apiClient } from '../services/apiClient';
import { useChannelStore } from './useChannelStore';

const getMock = vi.mocked(apiClient.get);

describe('useChannelStore', () => {
  beforeEach(() => {
    getMock.mockReset();
    useChannelStore.setState({
      channels: [],
      activeChannelId: null,
      isLoading: false,
      error: null,
    });
  });

  it('fetchChannels populates channels and sets first text channel active', async () => {
    getMock.mockResolvedValue({
      data: [
        { id: '2', name: 'Voice', type: 'voice', createdAt: new Date().toISOString() },
        { id: '1', name: 'general', type: 'text', createdAt: new Date().toISOString() },
      ],
      count: 2,
    });

    await useChannelStore.getState().fetchChannels();

    const state = useChannelStore.getState();
    expect(state.channels[0].id).toBe('1');
    expect(state.activeChannelId).toBe('1');
    expect(state.error).toBeNull();
  });

  it('setActiveChannel updates activeChannelId', () => {
    useChannelStore.getState().setActiveChannel('channel-123');
    expect(useChannelStore.getState().activeChannelId).toBe('channel-123');
  });

  it('fetchChannels sets error on failure', async () => {
    getMock.mockRejectedValue(new Error('Request failed'));

    await useChannelStore.getState().fetchChannels();

    const state = useChannelStore.getState();
    expect(state.error).toBe('Request failed');
    expect(state.isLoading).toBe(false);
  });
});
