import React from 'react';
import { useNavigate } from 'react-router';
import { ScrollArea } from '@renderer/components';
import { useChannelStore } from '../../stores/useChannelStore';
import { UserPanel } from '../layout/UserPanel';
import { ChannelItem } from './ChannelItem';
import { ServerHeader } from './ServerHeader';

function ChannelSkeletons(): React.ReactNode {
  return (
    <div className="p-2 space-y-2" aria-label="Loading channels">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={`channel-skeleton-${index}`} className="h-8 rounded-md mx-2 bg-bg-hover animate-pulse" />
      ))}
    </div>
  );
}

export function ChannelSidebar(): React.ReactNode {
  const navigate = useNavigate();
  const channels = useChannelStore((state) => state.channels);
  const activeChannelId = useChannelStore((state) => state.activeChannelId);
  const isLoading = useChannelStore((state) => state.isLoading);
  const setActiveChannel = useChannelStore((state) => state.setActiveChannel);

  const textChannels = channels.filter((channel) => channel.type === 'text');
  const voiceChannels = channels.filter((channel) => channel.type === 'voice');

  return (
    <div className="h-full flex flex-col">
      <ServerHeader />

      <ScrollArea className="flex-1 min-h-0">
        {isLoading ? (
          <ChannelSkeletons />
        ) : (
          <div className="py-2">
            <h2 className="text-text-muted text-xs font-semibold uppercase tracking-wide px-2 py-1.5" aria-level={2} role="heading">
              Text Channels
            </h2>
            <div className="space-y-1">
              {textChannels.map((channel) => (
                <ChannelItem
                  key={channel.id}
                  channel={channel}
                  isActive={activeChannelId === channel.id}
                  onClick={() => {
                    setActiveChannel(channel.id);
                    navigate(`/app/channels/${channel.id}`);
                  }}
                />
              ))}
            </div>

            <h2 className="text-text-muted text-xs font-semibold uppercase tracking-wide px-2 py-1.5 mt-2" aria-level={2} role="heading">
              Voice Channels
            </h2>
            <div className="space-y-1">
              {voiceChannels.map((channel) => (
                <ChannelItem
                  key={channel.id}
                  channel={channel}
                  isActive={activeChannelId === channel.id}
                  onClick={() => {
                    setActiveChannel(channel.id);
                    navigate(`/app/channels/${channel.id}`);
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </ScrollArea>

      <div className="mt-auto">
        <UserPanel />
      </div>
    </div>
  );
}
