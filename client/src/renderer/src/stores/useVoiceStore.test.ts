import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../services/wsClient', () => ({
  wsClient: {
    request: vi.fn(),
  },
}));

vi.mock('../services/mediaService', () => ({
  initDevice: vi.fn().mockResolvedValue({ rtpCapabilities: { codecs: [] } }),
  createSendTransport: vi.fn().mockReturnValue({
    id: 'send-transport-id',
    on: vi.fn(),
    produce: vi.fn(),
    close: vi.fn(),
  }),
  createRecvTransport: vi.fn().mockReturnValue({
    id: 'recv-transport-id',
    on: vi.fn(),
    consume: vi.fn(),
    close: vi.fn(),
  }),
  produceAudio: vi.fn().mockResolvedValue({
    producer: { id: 'producer-1', close: vi.fn() },
    stream: { getTracks: () => [] },
  }),
  cleanup: vi.fn(),
}));

vi.mock('../utils/soundPlayer', () => ({
  playConnectSound: vi.fn(),
  playDisconnectSound: vi.fn(),
}));

import { useVoiceStore } from './useVoiceStore';
import { wsClient } from '../services/wsClient';
import * as mediaService from '../services/mediaService';
import { playConnectSound, playDisconnectSound } from '../utils/soundPlayer';

const mockRequest = vi.mocked(wsClient.request);

beforeEach(() => {
  useVoiceStore.setState({
    currentChannelId: null,
    connectionState: 'disconnected',
    isLoading: false,
    error: null,
    channelParticipants: new Map(),
    isMuted: false,
    isDeafened: false,
  });
  vi.clearAllMocks();
});

describe('useVoiceStore', () => {
  it('should have correct initial state', () => {
    const state = useVoiceStore.getState();
    expect(state.currentChannelId).toBeNull();
    expect(state.connectionState).toBe('disconnected');
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.channelParticipants.size).toBe(0);
    expect(state.isMuted).toBe(false);
    expect(state.isDeafened).toBe(false);
  });

  describe('joinChannel', () => {
    it('sets connection state to connecting then connected', async () => {
      mockRequest
        .mockResolvedValueOnce({ routerRtpCapabilities: { codecs: [] }, existingPeers: [] })
        .mockResolvedValueOnce({ transportParams: { id: 's1', iceParameters: {}, iceCandidates: [], dtlsParameters: {} }, iceServers: [] })
        .mockResolvedValueOnce({ transportParams: { id: 'r1', iceParameters: {}, iceCandidates: [], dtlsParameters: {} }, iceServers: [] });

      await useVoiceStore.getState().joinChannel('voice-ch-1');

      const state = useVoiceStore.getState();
      expect(state.connectionState).toBe('connected');
      expect(state.currentChannelId).toBe('voice-ch-1');
      expect(state.isLoading).toBe(false);
    });

    it('calls wsClient.request with voice:join', async () => {
      mockRequest
        .mockResolvedValueOnce({ routerRtpCapabilities: { codecs: [] }, existingPeers: [] })
        .mockResolvedValueOnce({ transportParams: { id: 's1', iceParameters: {}, iceCandidates: [], dtlsParameters: {} }, iceServers: [] })
        .mockResolvedValueOnce({ transportParams: { id: 'r1', iceParameters: {}, iceCandidates: [], dtlsParameters: {} }, iceServers: [] });

      await useVoiceStore.getState().joinChannel('voice-ch-1');

      expect(mockRequest).toHaveBeenCalledWith('voice:join', { channelId: 'voice-ch-1' });
    });

    it('initializes mediasoup Device with routerRtpCapabilities', async () => {
      const caps = { codecs: [{ mimeType: 'audio/opus' }] };
      mockRequest
        .mockResolvedValueOnce({ routerRtpCapabilities: caps, existingPeers: [] })
        .mockResolvedValueOnce({ transportParams: { id: 's1', iceParameters: {}, iceCandidates: [], dtlsParameters: {} }, iceServers: [] })
        .mockResolvedValueOnce({ transportParams: { id: 'r1', iceParameters: {}, iceCandidates: [], dtlsParameters: {} }, iceServers: [] });

      await useVoiceStore.getState().joinChannel('voice-ch-1');

      expect(mediaService.initDevice).toHaveBeenCalledWith(caps);
    });

    it('updates channelParticipants with existingPeers', async () => {
      mockRequest
        .mockResolvedValueOnce({ routerRtpCapabilities: { codecs: [] }, existingPeers: ['user-1', 'user-2'] })
        .mockResolvedValueOnce({ transportParams: { id: 's1', iceParameters: {}, iceCandidates: [], dtlsParameters: {} }, iceServers: [] })
        .mockResolvedValueOnce({ transportParams: { id: 'r1', iceParameters: {}, iceCandidates: [], dtlsParameters: {} }, iceServers: [] });

      await useVoiceStore.getState().joinChannel('voice-ch-1');

      const participants = useVoiceStore.getState().channelParticipants.get('voice-ch-1');
      expect(participants).toEqual(['user-1', 'user-2']);
    });

    it('plays connect sound on success', async () => {
      mockRequest
        .mockResolvedValueOnce({ routerRtpCapabilities: { codecs: [] }, existingPeers: [] })
        .mockResolvedValueOnce({ transportParams: { id: 's1', iceParameters: {}, iceCandidates: [], dtlsParameters: {} }, iceServers: [] })
        .mockResolvedValueOnce({ transportParams: { id: 'r1', iceParameters: {}, iceCandidates: [], dtlsParameters: {} }, iceServers: [] });

      await useVoiceStore.getState().joinChannel('voice-ch-1');

      expect(playConnectSound).toHaveBeenCalled();
    });

    it('sets error state on failure', async () => {
      mockRequest.mockRejectedValueOnce(new Error('Connection failed'));

      await useVoiceStore.getState().joinChannel('voice-ch-1');

      const state = useVoiceStore.getState();
      expect(state.connectionState).toBe('disconnected');
      expect(state.currentChannelId).toBeNull();
      expect(state.error).toBe('Connection failed');
      expect(state.isLoading).toBe(false);
    });

    it('cleans up mediaService on failure', async () => {
      mockRequest.mockRejectedValueOnce(new Error('Connection failed'));

      await useVoiceStore.getState().joinChannel('voice-ch-1');

      expect(mediaService.cleanup).toHaveBeenCalled();
    });

    it('leaves current channel before joining new one', async () => {
      // Set up as already connected
      useVoiceStore.setState({
        currentChannelId: 'old-channel',
        connectionState: 'connected',
      });

      mockRequest
        .mockResolvedValueOnce(undefined) // voice:leave for old channel
        .mockResolvedValueOnce({ routerRtpCapabilities: { codecs: [] }, existingPeers: [] })
        .mockResolvedValueOnce({ transportParams: { id: 's1', iceParameters: {}, iceCandidates: [], dtlsParameters: {} }, iceServers: [] })
        .mockResolvedValueOnce({ transportParams: { id: 'r1', iceParameters: {}, iceCandidates: [], dtlsParameters: {} }, iceServers: [] });

      await useVoiceStore.getState().joinChannel('new-channel');

      expect(mockRequest).toHaveBeenCalledWith('voice:leave', { channelId: 'old-channel' });
      expect(useVoiceStore.getState().currentChannelId).toBe('new-channel');
    });
  });

  describe('leaveChannel', () => {
    it('resets state and calls cleanup', async () => {
      useVoiceStore.setState({
        currentChannelId: 'voice-ch-1',
        connectionState: 'connected',
      });
      mockRequest.mockResolvedValueOnce(undefined);

      await useVoiceStore.getState().leaveChannel();

      const state = useVoiceStore.getState();
      expect(state.currentChannelId).toBeNull();
      expect(state.connectionState).toBe('disconnected');
      expect(state.isMuted).toBe(false);
      expect(state.isDeafened).toBe(false);
      expect(mediaService.cleanup).toHaveBeenCalled();
    });

    it('sends voice:leave request', async () => {
      useVoiceStore.setState({ currentChannelId: 'voice-ch-1', connectionState: 'connected' });
      mockRequest.mockResolvedValueOnce(undefined);

      await useVoiceStore.getState().leaveChannel();

      expect(mockRequest).toHaveBeenCalledWith('voice:leave', { channelId: 'voice-ch-1' });
    });

    it('plays disconnect sound', async () => {
      useVoiceStore.setState({ currentChannelId: 'voice-ch-1', connectionState: 'connected' });
      mockRequest.mockResolvedValueOnce(undefined);

      await useVoiceStore.getState().leaveChannel();

      expect(playDisconnectSound).toHaveBeenCalled();
    });

    it('does nothing if not in a channel', async () => {
      await useVoiceStore.getState().leaveChannel();

      expect(mockRequest).not.toHaveBeenCalled();
      expect(mediaService.cleanup).not.toHaveBeenCalled();
    });

    it('still cleans up locally even if ws request fails', async () => {
      useVoiceStore.setState({ currentChannelId: 'voice-ch-1', connectionState: 'connected' });
      mockRequest.mockRejectedValueOnce(new Error('WS down'));

      await useVoiceStore.getState().leaveChannel();

      expect(mediaService.cleanup).toHaveBeenCalled();
      expect(useVoiceStore.getState().currentChannelId).toBeNull();
    });
  });

  describe('addPeer', () => {
    it('adds user to channelParticipants', () => {
      useVoiceStore.getState().addPeer('ch-1', 'user-1');

      const participants = useVoiceStore.getState().channelParticipants.get('ch-1');
      expect(participants).toEqual(['user-1']);
    });

    it('does not add duplicate user', () => {
      useVoiceStore.getState().addPeer('ch-1', 'user-1');
      useVoiceStore.getState().addPeer('ch-1', 'user-1');

      const participants = useVoiceStore.getState().channelParticipants.get('ch-1');
      expect(participants).toEqual(['user-1']);
    });

    it('adds multiple users to same channel', () => {
      useVoiceStore.getState().addPeer('ch-1', 'user-1');
      useVoiceStore.getState().addPeer('ch-1', 'user-2');

      const participants = useVoiceStore.getState().channelParticipants.get('ch-1');
      expect(participants).toEqual(['user-1', 'user-2']);
    });
  });

  describe('removePeer', () => {
    it('removes user from channelParticipants', () => {
      useVoiceStore.setState({
        channelParticipants: new Map([['ch-1', ['user-1', 'user-2']]]),
      });

      useVoiceStore.getState().removePeer('ch-1', 'user-1');

      const participants = useVoiceStore.getState().channelParticipants.get('ch-1');
      expect(participants).toEqual(['user-2']);
    });

    it('removes channel entry when last user leaves', () => {
      useVoiceStore.setState({
        channelParticipants: new Map([['ch-1', ['user-1']]]),
      });

      useVoiceStore.getState().removePeer('ch-1', 'user-1');

      expect(useVoiceStore.getState().channelParticipants.has('ch-1')).toBe(false);
    });
  });

  describe('toggleMute', () => {
    it('toggles isMuted flag', () => {
      expect(useVoiceStore.getState().isMuted).toBe(false);
      useVoiceStore.getState().toggleMute();
      expect(useVoiceStore.getState().isMuted).toBe(true);
      useVoiceStore.getState().toggleMute();
      expect(useVoiceStore.getState().isMuted).toBe(false);
    });
  });

  describe('toggleDeafen', () => {
    it('toggles isDeafened flag', () => {
      expect(useVoiceStore.getState().isDeafened).toBe(false);
      useVoiceStore.getState().toggleDeafen();
      expect(useVoiceStore.getState().isDeafened).toBe(true);
      useVoiceStore.getState().toggleDeafen();
      expect(useVoiceStore.getState().isDeafened).toBe(false);
    });
  });

  describe('clearError', () => {
    it('clears the error state', () => {
      useVoiceStore.setState({ error: 'some error' });
      useVoiceStore.getState().clearError();
      expect(useVoiceStore.getState().error).toBeNull();
    });
  });

  describe('syncParticipants', () => {
    it('rebuilds channelParticipants from presence data', () => {
      useVoiceStore.getState().syncParticipants([
        { userId: 'u1', channelId: 'ch-1' },
        { userId: 'u2', channelId: 'ch-1' },
        { userId: 'u3', channelId: 'ch-2' },
      ]);

      const state = useVoiceStore.getState();
      expect(state.channelParticipants.get('ch-1')).toEqual(['u1', 'u2']);
      expect(state.channelParticipants.get('ch-2')).toEqual(['u3']);
    });
  });

  describe('localCleanup', () => {
    it('resets all voice state without sending WS message', () => {
      useVoiceStore.setState({
        currentChannelId: 'voice-ch-1',
        connectionState: 'connected',
        channelParticipants: new Map([['voice-ch-1', ['u1']]]),
        isMuted: true,
        isDeafened: true,
      });

      useVoiceStore.getState().localCleanup();

      const state = useVoiceStore.getState();
      expect(state.currentChannelId).toBeNull();
      expect(state.connectionState).toBe('disconnected');
      expect(state.channelParticipants.size).toBe(0);
      expect(state.isMuted).toBe(false);
      expect(state.isDeafened).toBe(false);
      expect(mediaService.cleanup).toHaveBeenCalled();
      expect(mockRequest).not.toHaveBeenCalled();
    });
  });
});
