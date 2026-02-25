import React from 'react';
import type { Channel } from 'discord-clone-shared';
import { HashIcon, VolumeIcon } from '@renderer/components';

interface ChannelItemProps {
  channel: Channel;
  isActive: boolean;
  onClick: () => void;
}

export function ChannelItem({ channel, isActive, onClick }: ChannelItemProps): React.ReactNode {
  const icon = channel.type === 'voice' ? <VolumeIcon size={18} /> : <HashIcon size={18} />;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={isActive ? 'page' : undefined}
      className={[
        'h-8 w-full px-2 mx-2 rounded-md flex items-center gap-1.5 cursor-pointer transition-colors duration-150',
        'focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-0 focus-visible:outline-none',
        isActive
          ? 'bg-bg-active text-text-primary'
          : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
      ].join(' ')}
    >
      {icon}
      <span className="truncate text-sm">{channel.name}</span>
    </button>
  );
}
