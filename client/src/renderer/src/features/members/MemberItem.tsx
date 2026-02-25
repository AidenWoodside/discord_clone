import React from 'react';
import type { UserPublic } from 'discord-clone-shared';

const AVATAR_COLORS = [
  '#c97b35', '#7b935e', '#5e8493', '#935e7b', '#93855e',
  '#5e7b93', '#8b6e4e', '#6e8b4e', '#4e6e8b', '#8b4e6e',
];

function getAvatarColor(username: string): string {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

interface MemberItemProps {
  member: UserPublic;
  isOnline: boolean;
}

export function MemberItem({ member, isOnline }: MemberItemProps): React.ReactNode {
  const avatarColor = getAvatarColor(member.username);
  const initial = member.username.charAt(0).toUpperCase();

  return (
    <div className={`h-[42px] px-4 flex items-center gap-2 rounded-md hover:bg-bg-hover mx-2 cursor-default ${!isOnline ? 'opacity-60' : ''}`}>
      {/* Avatar with status dot */}
      <div className="relative flex-shrink-0">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium text-text-primary bg-bg-active"
          style={{ backgroundColor: avatarColor }}
        >
          {initial}
        </div>
        <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-bg-secondary ${isOnline ? 'bg-status-online' : 'bg-status-offline'}`} />
      </div>

      {/* Username */}
      <span className={`text-sm truncate ${isOnline ? 'text-text-primary' : 'text-text-muted'}`}>
        {member.username}
      </span>

      {/* Owner badge */}
      {member.role === 'owner' && (
        <span className="text-xs text-accent-primary flex-shrink-0">OWNER</span>
      )}
    </div>
  );
}
