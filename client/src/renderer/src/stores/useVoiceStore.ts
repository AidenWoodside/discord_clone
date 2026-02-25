import { create } from 'zustand';
import { wsClient } from '../services/wsClient';
import * as mediaService from '../services/mediaService';
import { playConnectSound, playDisconnectSound } from '../utils/soundPlayer';
import type {
  VoiceJoinPayload,
  VoiceJoinResponse,
  VoiceCreateTransportPayload,
  VoiceCreateTransportResponse,
} from 'discord-clone-shared';

type ConnectionState = 'disconnected' | 'connecting' | 'connected';

interface VoiceState {
  currentChannelId: string | null;
  connectionState: ConnectionState;
  isLoading: boolean;
  error: string | null;
  channelParticipants: Map<string, string[]>;
  isMuted: boolean;
  isDeafened: boolean;

  joinChannel: (channelId: string) => Promise<void>;
  leaveChannel: () => Promise<void>;
  localCleanup: () => void;
  addPeer: (channelId: string, userId: string) => void;
  removePeer: (channelId: string, userId: string) => void;
  setConnectionState: (state: ConnectionState) => void;
  toggleMute: () => void;
  toggleDeafen: () => void;
  clearError: () => void;
  syncParticipants: (participants: { userId: string; channelId: string }[]) => void;
}

export const useVoiceStore = create<VoiceState>((set, get) => ({
  currentChannelId: null,
  connectionState: 'disconnected',
  isLoading: false,
  error: null,
  channelParticipants: new Map(),
  isMuted: false,
  isDeafened: false,

  joinChannel: async (channelId: string) => {
    const state = get();

    // Leave current channel first if already in one
    if (state.currentChannelId) {
      await get().leaveChannel();
    }

    set({ connectionState: 'connecting', isLoading: true, error: null });

    try {
      // 1. Join voice channel on server
      const { routerRtpCapabilities, existingPeers } = await wsClient.request<VoiceJoinResponse>(
        'voice:join',
        { channelId } satisfies VoiceJoinPayload,
      );

      // 2. Initialize mediasoup Device
      await mediaService.initDevice(routerRtpCapabilities as Parameters<typeof mediaService.initDevice>[0]);

      // 3. Create send transport
      const sendTransportResponse = await wsClient.request<VoiceCreateTransportResponse>(
        'voice:create-transport',
        { direction: 'send' } satisfies VoiceCreateTransportPayload,
      );
      const sendTransport = mediaService.createSendTransport(
        sendTransportResponse.transportParams as Parameters<typeof mediaService.createSendTransport>[0],
        sendTransportResponse.iceServers as RTCIceServer[],
      );

      // 4. Create recv transport
      const recvTransportResponse = await wsClient.request<VoiceCreateTransportResponse>(
        'voice:create-transport',
        { direction: 'recv' } satisfies VoiceCreateTransportPayload,
      );
      mediaService.createRecvTransport(
        recvTransportResponse.transportParams as Parameters<typeof mediaService.createRecvTransport>[0],
        recvTransportResponse.iceServers as RTCIceServer[],
      );

      // 5. Produce audio (capture mic and start sending)
      await mediaService.produceAudio(sendTransport);

      // 6. Build participants map with existing peers + self
      const participants = new Map(get().channelParticipants);
      const peerList = [...existingPeers];
      // Add self — we'll get our own userId from the auth store dynamically
      participants.set(channelId, peerList);

      // 7. Update state
      set({
        connectionState: 'connected',
        currentChannelId: channelId,
        isLoading: false,
        channelParticipants: participants,
      });

      // 8. Play connect sound
      playConnectSound();

    } catch (err) {
      mediaService.cleanup();
      set({
        connectionState: 'disconnected',
        currentChannelId: null,
        isLoading: false,
        error: (err as Error).message,
      });
    }
  },

  leaveChannel: async () => {
    const { currentChannelId } = get();
    if (!currentChannelId) return;

    try {
      await wsClient.request<void>('voice:leave', { channelId: currentChannelId });
    } catch {
      // WS might already be disconnected — continue with local cleanup
    }

    mediaService.cleanup();

    const participants = new Map(get().channelParticipants);
    participants.delete(currentChannelId);

    set({
      currentChannelId: null,
      connectionState: 'disconnected',
      isMuted: false,
      isDeafened: false,
      channelParticipants: participants,
    });

    playDisconnectSound();
  },

  localCleanup: () => {
    mediaService.cleanup();

    set({
      currentChannelId: null,
      connectionState: 'disconnected',
      isLoading: false,
      isMuted: false,
      isDeafened: false,
      channelParticipants: new Map(),
    });
  },

  addPeer: (channelId: string, userId: string) => {
    set((state) => {
      const participants = new Map(state.channelParticipants);
      const list = participants.get(channelId) ?? [];
      if (!list.includes(userId)) {
        participants.set(channelId, [...list, userId]);
      }
      return { channelParticipants: participants };
    });
  },

  removePeer: (channelId: string, userId: string) => {
    set((state) => {
      const participants = new Map(state.channelParticipants);
      const list = participants.get(channelId) ?? [];
      const filtered = list.filter((id) => id !== userId);
      if (filtered.length > 0) {
        participants.set(channelId, filtered);
      } else {
        participants.delete(channelId);
      }
      return { channelParticipants: participants };
    });
  },

  setConnectionState: (connectionState: ConnectionState) => set({ connectionState }),

  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),

  toggleDeafen: () => set((state) => ({ isDeafened: !state.isDeafened })),

  clearError: () => set({ error: null }),

  syncParticipants: (participants: { userId: string; channelId: string }[]) => {
    const map = new Map<string, string[]>();
    for (const p of participants) {
      const list = map.get(p.channelId) ?? [];
      list.push(p.userId);
      map.set(p.channelId, list);
    }
    set({ channelParticipants: map });
  },
}));
