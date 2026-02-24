import { describe, it, expect } from 'vitest';
import { MAX_PARTICIPANTS, MAX_MESSAGE_LENGTH, WS_RECONNECT_DELAY } from './constants.js';

describe('Shared Constants', () => {
  it('should export voice limits', () => {
    expect(MAX_PARTICIPANTS).toBe(25);
  });

  it('should export message limits', () => {
    expect(MAX_MESSAGE_LENGTH).toBe(2000);
  });

  it('should export WebSocket config', () => {
    expect(WS_RECONNECT_DELAY).toBe(1000);
  });
});
