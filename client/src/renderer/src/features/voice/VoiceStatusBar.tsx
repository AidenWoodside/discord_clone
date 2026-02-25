import React from 'react';
import { Mic, MicOff, Headphones, HeadphoneOff, Video, PhoneOff } from 'lucide-react';
import { useVoiceStore } from '../../stores/useVoiceStore';
import { useChannelStore } from '../../stores/useChannelStore';

export function VoiceStatusBar(): React.ReactNode {
  const currentChannelId = useVoiceStore((s) => s.currentChannelId);
  const connectionState = useVoiceStore((s) => s.connectionState);
  const isMuted = useVoiceStore((s) => s.isMuted);
  const isDeafened = useVoiceStore((s) => s.isDeafened);
  const toggleMute = useVoiceStore((s) => s.toggleMute);
  const toggleDeafen = useVoiceStore((s) => s.toggleDeafen);
  const leaveChannel = useVoiceStore((s) => s.leaveChannel);
  const channels = useChannelStore((s) => s.channels);

  if (!currentChannelId && connectionState === 'disconnected') return null;

  const channel = channels.find((c) => c.id === currentChannelId);
  const channelName = channel?.name ?? 'Unknown';

  const isConnecting = connectionState === 'connecting';
  const isConnected = connectionState === 'connected';

  const MuteIcon = isMuted ? MicOff : Mic;
  const DeafenIcon = isDeafened ? HeadphoneOff : Headphones;

  return (
    <div
      className="h-[52px] w-full px-3 flex items-center justify-between bg-bg-tertiary border-t border-bg-hover animate-slideUp"
      role="region"
      aria-label="Voice connection status"
    >
      {/* Left: Status + Channel name */}
      <div className="flex flex-col min-w-0">
        {isConnecting && (
          <span className="text-xs font-medium text-text-secondary">Connecting...</span>
        )}
        {isConnected && (
          <span className="text-xs font-medium text-[#23a55a]">Voice Connected</span>
        )}
        <span className="text-xs text-text-secondary truncate">{channelName}</span>
      </div>

      {/* Right: Control buttons */}
      <div className="flex items-center gap-1">
        <button
          onClick={toggleMute}
          aria-label="Mute microphone"
          className={`w-8 h-8 flex items-center justify-center rounded transition-colors duration-150 ${
            isMuted
              ? 'text-accent-primary'
              : 'text-text-muted hover:bg-bg-hover hover:text-text-primary'
          }`}
        >
          <MuteIcon size={18} />
        </button>

        <button
          onClick={toggleDeafen}
          aria-label="Deafen audio"
          className={`w-8 h-8 flex items-center justify-center rounded transition-colors duration-150 ${
            isDeafened
              ? 'text-accent-primary'
              : 'text-text-muted hover:bg-bg-hover hover:text-text-primary'
          }`}
        >
          <DeafenIcon size={18} />
        </button>

        <button
          disabled
          aria-label="Toggle video"
          className="w-8 h-8 flex items-center justify-center rounded text-text-muted opacity-50 cursor-not-allowed"
        >
          <Video size={18} />
        </button>

        <button
          onClick={() => leaveChannel()}
          aria-label="Disconnect from voice"
          className="w-8 h-8 flex items-center justify-center rounded bg-[#f23f43] text-white hover:bg-[#da373c] transition-colors duration-150"
        >
          <PhoneOff size={18} />
        </button>
      </div>
    </div>
  );
}
