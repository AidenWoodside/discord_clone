import React, { useState } from 'react';
import { ContextMenu as RadixContextMenu } from 'radix-ui';
import useAuthStore from '../../stores/useAuthStore';
import { KickConfirmDialog } from './KickConfirmDialog';
import { BanConfirmDialog } from './BanConfirmDialog';
import { ResetPasswordDialog } from './ResetPasswordDialog';

interface MemberContextMenuProps {
  userId: string;
  username: string;
  children: React.ReactNode;
}

export function MemberContextMenu({ userId, username, children }: MemberContextMenuProps): React.ReactNode {
  const currentUser = useAuthStore((s) => s.user);
  const isOwner = currentUser?.role === 'owner';
  const isSelf = currentUser?.id === userId;

  const [kickOpen, setKickOpen] = useState(false);
  const [banOpen, setBanOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  // Don't render context menu for non-owners or when targeting self
  if (!isOwner || isSelf) {
    return <>{children}</>;
  }

  return (
    <>
      <RadixContextMenu.Root>
        <RadixContextMenu.Trigger asChild><div>{children}</div></RadixContextMenu.Trigger>
        <RadixContextMenu.Portal>
          <RadixContextMenu.Content className="min-w-[180px] rounded-lg bg-bg-floating p-1.5 shadow-lg">
            <RadixContextMenu.Item
              className="cursor-pointer rounded px-2 py-1.5 text-sm text-text-secondary outline-none hover:bg-bg-hover hover:text-text-primary flex items-center gap-2"
              onSelect={() => setKickOpen(true)}
            >
              Kick
            </RadixContextMenu.Item>

            <RadixContextMenu.Separator className="my-1 h-px bg-border" />

            <RadixContextMenu.Item
              className="cursor-pointer rounded px-2 py-1.5 text-sm text-error outline-none hover:bg-bg-hover flex items-center gap-2"
              onSelect={() => setBanOpen(true)}
            >
              Ban
            </RadixContextMenu.Item>

            <RadixContextMenu.Separator className="my-1 h-px bg-border" />

            <RadixContextMenu.Item
              className="cursor-pointer rounded px-2 py-1.5 text-sm text-text-secondary outline-none hover:bg-bg-hover hover:text-text-primary flex items-center gap-2"
              onSelect={() => setResetOpen(true)}
            >
              Reset Password
            </RadixContextMenu.Item>
          </RadixContextMenu.Content>
        </RadixContextMenu.Portal>
      </RadixContextMenu.Root>

      <KickConfirmDialog open={kickOpen} onOpenChange={setKickOpen} userId={userId} username={username} />
      <BanConfirmDialog open={banOpen} onOpenChange={setBanOpen} userId={userId} username={username} />
      <ResetPasswordDialog open={resetOpen} onOpenChange={setResetOpen} userId={userId} username={username} />
    </>
  );
}
