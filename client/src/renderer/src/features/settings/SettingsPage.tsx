import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { AudioSettings } from './AudioSettings';

interface SettingsPageProps {
  onClose: () => void;
}

export function SettingsPage({ onClose }: SettingsPageProps): React.ReactNode {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="flex-1 flex flex-col bg-bg-primary overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-default">
        <h1 className="text-lg font-semibold text-text-primary">Settings</h1>
        <button
          onClick={onClose}
          aria-label="Close settings"
          className="text-text-secondary hover:text-text-primary transition-colors duration-150 p-1 rounded focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-0 focus-visible:outline-none"
        >
          <X size={20} />
        </button>
      </div>
      <div className="max-w-2xl">
        <AudioSettings />
      </div>
    </div>
  );
}
