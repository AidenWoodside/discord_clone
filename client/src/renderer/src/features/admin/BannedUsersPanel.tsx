import React, { useEffect, useState } from 'react';
import { Dialog } from 'radix-ui';
import { apiRequest } from '../../services/apiClient';
import { Button } from '../../components';

interface BannedUser {
  id: string;
  userId: string;
  username: string;
  bannedBy: string;
  createdAt: string;
}

interface BannedUsersPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BannedUsersPanel({ open, onOpenChange }: BannedUsersPanelProps): React.ReactNode {
  const [bannedUsers, setBannedUsers] = useState<BannedUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [unbanningId, setUnbanningId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setIsLoading(true);
      apiRequest<BannedUser[]>('/api/admin/bans')
        .then((data) => {
          setBannedUsers(data);
        })
        .catch(() => {
          // Error handled by apiClient
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [open]);

  const handleUnban = async (userId: string) => {
    setUnbanningId(userId);
    try {
      await apiRequest(`/api/admin/unban/${userId}`, { method: 'POST' });
      setBannedUsers((prev) => prev.filter((u) => u.userId !== userId));
    } catch {
      // Error handled by apiClient
    } finally {
      setUnbanningId(null);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-bg-floating p-4 max-w-[480px] w-full max-h-[60vh] flex flex-col">
          <Dialog.Title className="text-lg font-semibold text-text-primary">
            Banned Users
          </Dialog.Title>

          <div className="mt-3 flex-1 overflow-y-auto">
            {isLoading && (
              <p className="text-sm text-text-muted">Loading...</p>
            )}

            {!isLoading && bannedUsers.length === 0 && (
              <p className="text-sm text-text-muted">No banned users</p>
            )}

            {bannedUsers.map((user) => (
              <div key={user.id} className="flex items-center justify-between py-2 px-1 border-b border-border last:border-0">
                <div>
                  <span className="text-sm text-text-primary">{user.username}</span>
                  <span className="ml-2 text-xs text-text-muted">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleUnban(user.userId)}
                  disabled={unbanningId === user.userId}
                >
                  {unbanningId === user.userId ? 'Unbanning...' : 'Unban'}
                </Button>
              </div>
            ))}
          </div>

          <div className="mt-4 flex justify-end">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
