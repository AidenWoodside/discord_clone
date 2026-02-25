import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

import { apiClient } from '../services/apiClient';
import { useMemberStore } from './useMemberStore';

const getMock = vi.mocked(apiClient.get);

describe('useMemberStore', () => {
  beforeEach(() => {
    getMock.mockReset();
    useMemberStore.setState({
      members: [],
      isLoading: false,
      error: null,
    });
  });

  it('fetchMembers populates state', async () => {
    getMock.mockResolvedValue([{ id: '1', username: 'owner', role: 'owner', createdAt: new Date().toISOString() }]);

    await useMemberStore.getState().fetchMembers();

    const state = useMemberStore.getState();
    expect(state.members).toHaveLength(1);
    expect(state.error).toBeNull();
  });

  it('fetchMembers sets error on failure', async () => {
    getMock.mockRejectedValue(new Error('Failed members'));

    await useMemberStore.getState().fetchMembers();

    const state = useMemberStore.getState();
    expect(state.error).toBe('Failed members');
    expect(state.isLoading).toBe(false);
  });
});
