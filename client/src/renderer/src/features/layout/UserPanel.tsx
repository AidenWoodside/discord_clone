import React from 'react';
import { SettingsIcon } from '@renderer/components';
import useAuthStore from '../../stores/useAuthStore';

const AVATAR_COLORS = [
  '#c97b35', '#7b935e', '#5e8493', '#935e7b', '#93855e',
  '#5e7b93', '#8b6e4e', '#6e8b4e', '#4e6e8b', '#8b4e6e',
];

function getAvatarColor(username: string): string {
  let hash = 0;
  for (let index = 0; index < username.length; index += 1) {
    hash = username.charCodeAt(index) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function UserPanel(): React.ReactNode {
  const user = useAuthStore((state) => state.user);
  const username = user?.username ?? 'unknown';

  return (
    <div className="h-[52px] px-2 flex items-center bg-bg-tertiary border-t border-border-default gap-2">
      <div className="relative h-8 w-8 shrink-0">
        <div
          className="h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold text-text-primary"
          style={{ backgroundColor: getAvatarColor(username) }}
          aria-hidden
        >
          {username.slice(0, 1).toUpperCase()}
        </div>
        <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-status-online border border-bg-tertiary" />
      </div>

      <span className="text-sm font-medium text-text-primary truncate">{username}</span>

      <button
        type="button"
        aria-label="User settings"
        className="ml-auto text-text-secondary hover:text-text-primary h-8 w-8 inline-flex items-center justify-center rounded-md focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-0 focus-visible:outline-none"
        onClick={() => {}}
      >
        <SettingsIcon size={18} />
      </button>
    </div>
  );
}
