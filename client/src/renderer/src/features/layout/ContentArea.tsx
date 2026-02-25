import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Hash, Users } from 'lucide-react';
import { useChannelStore } from '../../stores/useChannelStore';
import { useUIStore } from '../../stores/useUIStore';
import { ConnectionBanner } from './ConnectionBanner';

export function ContentArea(): React.ReactNode {
  const { channelId } = useParams<{ channelId: string }>();
  const channels = useChannelStore((s) => s.channels);
  const activeChannelId = useChannelStore((s) => s.activeChannelId);
  const setActiveChannel = useChannelStore((s) => s.setActiveChannel);
  const isMemberListVisible = useUIStore((s) => s.isMemberListVisible);
  const toggleMemberList = useUIStore((s) => s.toggleMemberList);
  const navigate = useNavigate();

  useEffect(() => {
    if (channelId) {
      setActiveChannel(channelId);
    }
  }, [channelId, setActiveChannel]);

  const channel = channels.find((c) => c.id === channelId);

  // Redirect when the current channel is deleted
  useEffect(() => {
    if (channelId && channels.length > 0 && !channel) {
      if (activeChannelId) {
        navigate(`/app/channels/${activeChannelId}`, { replace: true });
      } else {
        navigate('/app/channels', { replace: true });
      }
    }
  }, [channelId, channel, channels.length, activeChannelId, navigate]);

  if (!channel) {
    return (
      <>
        <ContentHeader channelName={null} isMemberListVisible={isMemberListVisible} onToggleMemberList={toggleMemberList} />
        <ConnectionBanner />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-text-muted text-lg">Select a channel</p>
        </div>
      </>
    );
  }

  return (
    <>
      <ContentHeader channelName={channel.name} isMemberListVisible={isMemberListVisible} onToggleMemberList={toggleMemberList} />
      <ConnectionBanner />
      <div className="flex-1 overflow-y-auto flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-text-primary">Welcome to #{channel.name}</h2>
          <p className="text-text-secondary mt-2">This is the start of the #{channel.name} channel.</p>
        </div>
      </div>
    </>
  );
}

function ContentHeader({
  channelName,
  isMemberListVisible,
  onToggleMemberList,
}: {
  channelName: string | null;
  isMemberListVisible: boolean;
  onToggleMemberList: () => void;
}): React.ReactNode {
  return (
    <div className="h-12 px-4 flex items-center border-b border-border-default bg-bg-primary shadow-sm flex-shrink-0">
      {channelName && (
        <div className="flex items-center gap-2">
          <Hash size={20} className="text-text-muted" />
          <span className="text-text-primary font-semibold">{channelName}</span>
        </div>
      )}
      <div className="ml-auto">
        <button
          aria-label="Toggle member list"
          onClick={onToggleMemberList}
          className={`p-1 rounded transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-0 focus-visible:outline-none ${
            isMemberListVisible ? 'text-text-primary' : 'text-text-muted'
          }`}
        >
          <Users size={20} />
        </button>
      </div>
    </div>
  );
}
