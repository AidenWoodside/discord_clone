import React from 'react';
import { Settings } from 'lucide-react';
import useAuthStore from '../../stores/useAuthStore';

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

export function UserPanel(): React.ReactNode {
  const user = useAuthStore((s) => s.user);

  if (!user) return null;

  const avatarColor = getAvatarColor(user.username);
  const initial = user.username.charAt(0).toUpperCase();

  return (
    <div className="h-[52px] px-2 flex items-center bg-bg-tertiary border-t border-border-default">
      {/* Avatar with status dot */}
      <div className="relative flex-shrink-0">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium text-text-primary"
          style={{ backgroundColor: avatarColor }}
        >
          {initial}
        </div>
        <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-status-online border-2 border-bg-tertiary" />
      </div>

      {/* Username */}
      <span className="text-sm font-medium text-text-primary truncate ml-2 flex-1">
        {user.username}
      </span>

      {/* Settings button */}
      <button
        aria-label="User settings"
        className="ml-auto text-text-secondary hover:text-text-primary transition-colors duration-150 p-1 rounded focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-0 focus-visible:outline-none"
      >
        <Settings size={18} />
      </button>
    </div>
  );
}
