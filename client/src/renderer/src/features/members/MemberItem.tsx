import React from 'react';
import type { UserPublic } from 'discord-clone-shared';

interface MemberItemProps {
  member: UserPublic;
  isOnline: boolean;
}

export function MemberItem({ member, isOnline }: MemberItemProps): React.ReactNode {
  return (
    <button
      type="button"
      className="h-[42px] w-[calc(100%-1rem)] px-4 flex items-center gap-2 rounded-md hover:bg-bg-hover mx-2 cursor-default text-left focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-0 focus-visible:outline-none"
      aria-label={`Member ${member.username}`}
    >
      <div className="relative h-8 w-8 shrink-0">
        <div className="h-8 w-8 bg-bg-active rounded-full flex items-center justify-center text-sm font-medium text-text-primary" aria-hidden>
          {member.username.slice(0, 1).toUpperCase()}
        </div>
        <span
          className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-bg-secondary ${isOnline ? 'bg-status-online' : 'bg-status-offline'}`}
          aria-hidden
        />
      </div>

      <div className="min-w-0 flex items-center gap-2">
        <span className={`text-sm truncate ${isOnline ? 'text-text-primary' : 'text-text-muted opacity-60'}`}>
          {member.username}
        </span>
        {member.role === 'owner' ? (
          <span className="text-xs text-accent-primary">OWNER</span>
        ) : null}
      </div>
    </button>
  );
}
