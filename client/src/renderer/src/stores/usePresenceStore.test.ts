import { describe, it, expect, beforeEach } from 'vitest';
import { usePresenceStore } from './usePresenceStore';

beforeEach(() => {
  usePresenceStore.setState({
    onlineUsers: new Map(),
    connectionState: 'disconnected',
    hasConnectedOnce: false,
    isLoading: false,
    error: null,
  });
});

describe('usePresenceStore', () => {
  describe('setUserOnline', () => {
    it('should add user to online users', () => {
      usePresenceStore.getState().setUserOnline('user-1');

      const { onlineUsers } = usePresenceStore.getState();
      expect(onlineUsers.has('user-1')).toBe(true);
      expect(onlineUsers.get('user-1')).toEqual({ userId: 'user-1', status: 'online' });
    });

    it('should preserve existing online users', () => {
      usePresenceStore.getState().setUserOnline('user-1');
      usePresenceStore.getState().setUserOnline('user-2');

      const { onlineUsers } = usePresenceStore.getState();
      expect(onlineUsers.size).toBe(2);
      expect(onlineUsers.has('user-1')).toBe(true);
      expect(onlineUsers.has('user-2')).toBe(true);
    });
  });

  describe('setUserOffline', () => {
    it('should remove user from online users', () => {
      usePresenceStore.getState().setUserOnline('user-1');
      usePresenceStore.getState().setUserOffline('user-1');

      const { onlineUsers } = usePresenceStore.getState();
      expect(onlineUsers.has('user-1')).toBe(false);
    });

    it('should not error when removing non-existent user', () => {
      usePresenceStore.getState().setUserOffline('nonexistent');
      expect(usePresenceStore.getState().onlineUsers.size).toBe(0);
    });
  });

  describe('syncOnlineUsers', () => {
    it('should replace all online users with synced list', () => {
      usePresenceStore.getState().setUserOnline('old-user');

      usePresenceStore.getState().syncOnlineUsers([
        { userId: 'user-1', status: 'online' },
        { userId: 'user-2', status: 'online' },
      ]);

      const { onlineUsers } = usePresenceStore.getState();
      expect(onlineUsers.size).toBe(2);
      expect(onlineUsers.has('old-user')).toBe(false);
      expect(onlineUsers.has('user-1')).toBe(true);
      expect(onlineUsers.has('user-2')).toBe(true);
    });

    it('should handle empty sync', () => {
      usePresenceStore.getState().setUserOnline('user-1');
      usePresenceStore.getState().syncOnlineUsers([]);

      expect(usePresenceStore.getState().onlineUsers.size).toBe(0);
    });
  });

  describe('setConnectionState', () => {
    it('should update connection state', () => {
      usePresenceStore.getState().setConnectionState('connecting');
      expect(usePresenceStore.getState().connectionState).toBe('connecting');

      usePresenceStore.getState().setConnectionState('connected');
      expect(usePresenceStore.getState().connectionState).toBe('connected');

      usePresenceStore.getState().setConnectionState('reconnecting');
      expect(usePresenceStore.getState().connectionState).toBe('reconnecting');

      usePresenceStore.getState().setConnectionState('disconnected');
      expect(usePresenceStore.getState().connectionState).toBe('disconnected');
    });

    it('should set hasConnectedOnce to true when connected', () => {
      expect(usePresenceStore.getState().hasConnectedOnce).toBe(false);

      usePresenceStore.getState().setConnectionState('connecting');
      expect(usePresenceStore.getState().hasConnectedOnce).toBe(false);

      usePresenceStore.getState().setConnectionState('connected');
      expect(usePresenceStore.getState().hasConnectedOnce).toBe(true);
    });

    it('should keep hasConnectedOnce true after disconnect', () => {
      usePresenceStore.getState().setConnectionState('connected');
      expect(usePresenceStore.getState().hasConnectedOnce).toBe(true);

      usePresenceStore.getState().setConnectionState('disconnected');
      expect(usePresenceStore.getState().hasConnectedOnce).toBe(true);
    });
  });

  describe('clearError', () => {
    it('should clear error state', () => {
      usePresenceStore.setState({ error: 'Some error' });
      usePresenceStore.getState().clearError();
      expect(usePresenceStore.getState().error).toBeNull();
    });
  });
});
