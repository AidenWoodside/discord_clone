import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../services/apiClient', () => ({
  apiRequest: vi.fn(),
}));

import { useChannelStore } from './useChannelStore';
import { apiRequest } from '../services/apiClient';

const mockApiRequest = vi.mocked(apiRequest);

beforeEach(() => {
  useChannelStore.setState({
    channels: [],
    activeChannelId: null,
    isLoading: false,
    error: null,
  });
  vi.clearAllMocks();
});

describe('useChannelStore', () => {
  it('should have correct initial state', () => {
    const state = useChannelStore.getState();
    expect(state.channels).toEqual([]);
    expect(state.activeChannelId).toBeNull();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('should fetch channels and sort by type then name', async () => {
    mockApiRequest.mockResolvedValueOnce([
      { id: '1', name: 'Gaming', type: 'voice', createdAt: '2024-01-01' },
      { id: '2', name: 'general', type: 'text', createdAt: '2024-01-01' },
      { id: '3', name: 'help', type: 'text', createdAt: '2024-01-01' },
    ]);

    await useChannelStore.getState().fetchChannels();

    const state = useChannelStore.getState();
    expect(state.isLoading).toBe(false);
    expect(state.channels).toHaveLength(3);
    expect(state.channels[0].name).toBe('general');
    expect(state.channels[1].name).toBe('help');
    expect(state.channels[2].name).toBe('Gaming');
  });

  it('should set isLoading during fetch', async () => {
    let resolvePromise: (value: unknown) => void;
    mockApiRequest.mockReturnValueOnce(new Promise((resolve) => { resolvePromise = resolve; }));

    const fetchPromise = useChannelStore.getState().fetchChannels();
    expect(useChannelStore.getState().isLoading).toBe(true);

    resolvePromise!([]);
    await fetchPromise;
    expect(useChannelStore.getState().isLoading).toBe(false);
  });

  it('should handle fetch error', async () => {
    mockApiRequest.mockRejectedValueOnce(new Error('Network error'));

    await useChannelStore.getState().fetchChannels();

    const state = useChannelStore.getState();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBe('Network error');
    expect(state.channels).toEqual([]);
  });

  it('should set active channel', () => {
    useChannelStore.getState().setActiveChannel('channel-1');
    expect(useChannelStore.getState().activeChannelId).toBe('channel-1');
  });

  it('should clear error', () => {
    useChannelStore.setState({ error: 'some error' });
    useChannelStore.getState().clearError();
    expect(useChannelStore.getState().error).toBeNull();
  });

  describe('addChannel', () => {
    it('inserts channel in sorted order (text first, then alphabetical)', () => {
      useChannelStore.setState({
        channels: [
          { id: '1', name: 'general', type: 'text', createdAt: '2024-01-01' },
          { id: '3', name: 'Gaming', type: 'voice', createdAt: '2024-01-01' },
        ],
      });

      useChannelStore.getState().addChannel({ id: '2', name: 'help', type: 'text', createdAt: '2024-01-01' });

      const { channels } = useChannelStore.getState();
      expect(channels).toHaveLength(3);
      expect(channels[0].name).toBe('general');
      expect(channels[1].name).toBe('help');
      expect(channels[2].name).toBe('Gaming');
    });
  });

  describe('removeChannel', () => {
    it('removes channel from list', () => {
      useChannelStore.setState({
        channels: [
          { id: '1', name: 'general', type: 'text', createdAt: '2024-01-01' },
          { id: '2', name: 'help', type: 'text', createdAt: '2024-01-01' },
        ],
      });

      useChannelStore.getState().removeChannel('1');

      const { channels } = useChannelStore.getState();
      expect(channels).toHaveLength(1);
      expect(channels[0].id).toBe('2');
    });

    it('redirects activeChannelId to first text channel when active channel is removed', () => {
      useChannelStore.setState({
        channels: [
          { id: '1', name: 'general', type: 'text', createdAt: '2024-01-01' },
          { id: '2', name: 'help', type: 'text', createdAt: '2024-01-01' },
        ],
        activeChannelId: '1',
      });

      useChannelStore.getState().removeChannel('1');

      expect(useChannelStore.getState().activeChannelId).toBe('2');
    });

    it('sets activeChannelId to null when no channels remain', () => {
      useChannelStore.setState({
        channels: [{ id: '1', name: 'general', type: 'text', createdAt: '2024-01-01' }],
        activeChannelId: '1',
      });

      useChannelStore.getState().removeChannel('1');

      expect(useChannelStore.getState().activeChannelId).toBeNull();
    });

    it('does not change activeChannelId when a different channel is removed', () => {
      useChannelStore.setState({
        channels: [
          { id: '1', name: 'general', type: 'text', createdAt: '2024-01-01' },
          { id: '2', name: 'help', type: 'text', createdAt: '2024-01-01' },
        ],
        activeChannelId: '1',
      });

      useChannelStore.getState().removeChannel('2');

      expect(useChannelStore.getState().activeChannelId).toBe('1');
    });
  });

  describe('createChannel', () => {
    it('calls API with correct params', async () => {
      mockApiRequest.mockResolvedValueOnce(undefined);

      await useChannelStore.getState().createChannel('new-channel', 'text');

      expect(mockApiRequest).toHaveBeenCalledWith('/api/channels', {
        method: 'POST',
        body: JSON.stringify({ name: 'new-channel', type: 'text' }),
      });
    });
  });

  describe('deleteChannel', () => {
    it('calls API with correct params', async () => {
      mockApiRequest.mockResolvedValueOnce(undefined);

      await useChannelStore.getState().deleteChannel('ch-1');

      expect(mockApiRequest).toHaveBeenCalledWith('/api/channels/ch-1', {
        method: 'DELETE',
      });
    });
  });
});
