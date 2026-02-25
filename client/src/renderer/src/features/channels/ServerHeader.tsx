import React, { useState } from 'react';
import { ChevronDown, Plus, UserPlus } from 'lucide-react';
import useAuthStore from '../../stores/useAuthStore';
import { DropdownMenu, DropdownMenuItem } from '../../components';
import { CreateChannelModal } from './CreateChannelModal';

export function ServerHeader(): React.ReactNode {
  const user = useAuthStore((s) => s.user);
  const isOwner = user?.role === 'owner';
  const [createModalOpen, setCreateModalOpen] = useState(false);

  if (!isOwner) {
    return (
      <div className="h-12 px-4 flex items-center border-b border-border-default shadow-sm">
        <span className="text-text-primary font-semibold truncate flex-1">discord_clone</span>
      </div>
    );
  }

  return (
    <>
      <DropdownMenu
        trigger={
          <button className="h-12 px-4 flex items-center border-b border-border-default shadow-sm cursor-pointer hover:bg-bg-hover transition-colors duration-150 w-full">
            <span className="text-text-primary font-semibold truncate flex-1 text-left">discord_clone</span>
            <ChevronDown size={18} className="text-text-secondary flex-shrink-0" />
          </button>
        }
      >
        <DropdownMenuItem onSelect={() => setCreateModalOpen(true)}>
          <div className="flex items-center gap-2">
            <Plus size={16} />
            <span>Create Channel</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <div className="flex items-center gap-2">
            <UserPlus size={16} />
            <span>Invite People</span>
          </div>
        </DropdownMenuItem>
      </DropdownMenu>

      <CreateChannelModal open={createModalOpen} onOpenChange={setCreateModalOpen} />
    </>
  );
}
