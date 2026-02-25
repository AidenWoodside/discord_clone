import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { ContextMenu as RadixContextMenu } from 'radix-ui';
import { Modal, Button } from '../../components';
import { useChannelStore } from '../../stores/useChannelStore';

interface ChannelContextMenuProps {
  channelId: string;
  channelName: string;
  children: React.ReactNode;
}

export function ChannelContextMenu({ channelId, channelName, children }: ChannelContextMenuProps): React.ReactNode {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const deleteChannel = useChannelStore((s) => s.deleteChannel);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteChannel(channelId);
      setDeleteDialogOpen(false);
    } catch {
      // Error handled by store
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <RadixContextMenu.Root>
        <RadixContextMenu.Trigger asChild>
          <div>{children}</div>
        </RadixContextMenu.Trigger>
        <RadixContextMenu.Portal>
          <RadixContextMenu.Content className="min-w-[180px] rounded-lg bg-bg-floating p-1.5 shadow-lg">
            <RadixContextMenu.Separator className="h-px bg-border-default my-1" />
            <RadixContextMenu.Item
              className="cursor-pointer rounded px-2 py-1.5 text-sm text-error outline-none hover:bg-error/10 flex items-center gap-2"
              onSelect={() => setDeleteDialogOpen(true)}
            >
              <Trash2 size={16} />
              Delete Channel
            </RadixContextMenu.Item>
          </RadixContextMenu.Content>
        </RadixContextMenu.Portal>
      </RadixContextMenu.Root>

      <Modal open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen} title={`Delete #${channelName}?`}>
        <p className="text-sm text-text-secondary mt-2">
          All messages will be permanently deleted. This can't be undone.
        </p>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onClick={() => setDeleteDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            className="bg-error hover:bg-error/80 text-white"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </Modal>
    </>
  );
}
