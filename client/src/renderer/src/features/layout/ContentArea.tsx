import React, { useEffect } from 'react';
import { useParams } from 'react-router';
import { HashIcon, UsersIcon } from '@renderer/components';
import { useChannelStore } from '../../stores/useChannelStore';
import { useUIStore } from '../../stores/useUIStore';

export function ContentArea(): React.ReactNode {
  const { channelId } = useParams();
  const channels = useChannelStore((state) => state.channels);
  const activeChannelId = useChannelStore((state) => state.activeChannelId);
  const setActiveChannel = useChannelStore((state) => state.setActiveChannel);
  const isMemberListVisible = useUIStore((state) => state.isMemberListVisible);
  const toggleMemberList = useUIStore((state) => state.toggleMemberList);

  useEffect(() => {
    if (channelId && channelId !== activeChannelId) {
      setActiveChannel(channelId);
    }
  }, [channelId, activeChannelId, setActiveChannel]);

  const activeChannel = channels.find((channel) => channel.id === activeChannelId) ?? null;

  return (
    <div className="h-full flex flex-col">
      <header className="h-12 px-4 flex items-center border-b border-border-default bg-bg-primary shadow-sm">
        <HashIcon size={20} className="text-text-secondary" />
        <span className="ml-2 text-text-primary font-semibold truncate">
          {activeChannel ? activeChannel.name : 'Select a channel'}
        </span>

        <button
          type="button"
          aria-label="Toggle member list"
          onClick={toggleMemberList}
          className={[
            'ml-auto h-8 w-8 inline-flex items-center justify-center rounded-md',
            'focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-0 focus-visible:outline-none',
            isMemberListVisible ? 'text-text-primary' : 'text-text-muted',
          ].join(' ')}
        >
          <UsersIcon size={20} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        {activeChannel ? (
          <>
            <h1 className="text-2xl font-bold text-text-primary">Welcome to #{activeChannel.name}</h1>
            <p className="text-text-secondary mt-2">This is the start of the #{activeChannel.name} channel.</p>
          </>
        ) : (
          <h1 className="text-2xl font-bold text-text-primary">Select a channel</h1>
        )}
      </div>
    </div>
  );
}
