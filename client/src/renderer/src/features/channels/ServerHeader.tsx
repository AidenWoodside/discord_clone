import React from 'react';
import { ChevronDownIcon } from '@renderer/components';

export function ServerHeader(): React.ReactNode {
  return (
    <div className="h-12 border-b border-border-default px-3 flex items-center justify-between">
      <span className="text-sm font-semibold text-text-primary">discord_clone</span>
      <ChevronDownIcon size={14} className="text-text-secondary" />
    </div>
  );
}
