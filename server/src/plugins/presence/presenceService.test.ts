import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  addUser,
  removeUser,
  getOnlineUsers,
  isUserOnline,
  broadcastPresenceUpdate,
  sendPresenceSync,
  clearAllPresence,
} from './presenceService.js';

function createMockSocket(readyState = 1) {
  return {
    send: vi.fn(),
    close: vi.fn(),
    readyState,
    OPEN: 1,
  } as unknown as import('ws').WebSocket;
}

describe('presenceService', () => {
  beforeEach(() => {
    clearAllPresence();
  });

  describe('addUser / removeUser', () => {
    it('should add user to online users', () => {
      addUser('user-1');
      expect(isUserOnline('user-1')).toBe(true);
    });

    it('should remove user from online users', () => {
      addUser('user-1');
      removeUser('user-1');
      expect(isUserOnline('user-1')).toBe(false);
    });

    it('should handle removing non-existent user', () => {
      removeUser('nonexistent');
      expect(isUserOnline('nonexistent')).toBe(false);
    });
  });

  describe('getOnlineUsers', () => {
    it('should return all online users', () => {
      addUser('user-1');
      addUser('user-2');

      const users = getOnlineUsers();
      expect(users).toHaveLength(2);
      expect(users).toEqual(
        expect.arrayContaining([
          { userId: 'user-1', status: 'online' },
          { userId: 'user-2', status: 'online' },
        ]),
      );
    });

    it('should return empty array when no users online', () => {
      expect(getOnlineUsers()).toHaveLength(0);
    });
  });

  describe('broadcastPresenceUpdate', () => {
    it('should broadcast to all clients except the source user', () => {
      const ws1 = createMockSocket();
      const ws2 = createMockSocket();
      const ws3 = createMockSocket();
      const clients = new Map([
        ['user-1', ws1],
        ['user-2', ws2],
        ['user-3', ws3],
      ]) as Map<string, import('ws').WebSocket>;

      broadcastPresenceUpdate(clients, 'user-1', 'online');

      expect(ws1.send).not.toHaveBeenCalled();
      expect(ws2.send).toHaveBeenCalledOnce();
      expect(ws3.send).toHaveBeenCalledOnce();

      const sentData = JSON.parse((ws2.send as ReturnType<typeof vi.fn>).mock.calls[0][0] as string);
      expect(sentData.type).toBe('presence:update');
      expect(sentData.payload.userId).toBe('user-1');
      expect(sentData.payload.status).toBe('online');
    });

    it('should not send to clients with closed connections', () => {
      const wsOpen = createMockSocket(1); // OPEN
      const wsClosed = createMockSocket(3); // CLOSED
      const clients = new Map([
        ['user-2', wsOpen],
        ['user-3', wsClosed],
      ]) as Map<string, import('ws').WebSocket>;

      broadcastPresenceUpdate(clients, 'user-1', 'offline');

      expect(wsOpen.send).toHaveBeenCalledOnce();
      expect(wsClosed.send).not.toHaveBeenCalled();
    });
  });

  describe('sendPresenceSync', () => {
    it('should send full online user list', () => {
      addUser('user-1');
      addUser('user-2');

      const ws = createMockSocket();
      sendPresenceSync(ws);

      expect(ws.send).toHaveBeenCalledOnce();
      const sentData = JSON.parse((ws.send as ReturnType<typeof vi.fn>).mock.calls[0][0] as string);
      expect(sentData.type).toBe('presence:sync');
      expect(sentData.payload.users).toHaveLength(2);
    });
  });
});
