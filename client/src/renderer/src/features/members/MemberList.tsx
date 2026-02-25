import React from 'react';
import { ScrollArea } from '@renderer/components';
import useAuthStore from '../../stores/useAuthStore';
import { useMemberStore } from '../../stores/useMemberStore';
import { MemberItem } from './MemberItem';

function MemberSkeletons(): React.ReactNode {
  return (
    <div className="px-2 py-3 space-y-2" aria-label="Loading members">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={`member-skeleton-${index}`} className="h-[42px] rounded-md px-2 flex items-center gap-2 animate-pulse">
          <div className="h-8 w-8 rounded-full bg-bg-hover" />
          <div className="h-3 w-28 rounded bg-bg-hover" />
        </div>
      ))}
    </div>
  );
}

export function MemberList(): React.ReactNode {
  const members = useMemberStore((state) => state.members);
  const isLoading = useMemberStore((state) => state.isLoading);
  const currentUser = useAuthStore((state) => state.user);

  const onlineMembers = members.filter((member) => member.id === currentUser?.id);
  const offlineMembers = members.filter((member) => member.id !== currentUser?.id);

  return (
    <div className="h-full flex flex-col py-2">
      <ScrollArea className="flex-1 min-h-0">
        {isLoading ? (
          <MemberSkeletons />
        ) : (
          <>
            <h2 className="text-text-muted text-xs font-semibold uppercase tracking-wide px-4 py-1.5" aria-level={2} role="heading">
              ONLINE — {onlineMembers.length}
            </h2>
            <div className="space-y-1">
              {onlineMembers.map((member) => (
                <MemberItem key={member.id} member={member} isOnline />
              ))}
            </div>

            <h2 className="text-text-muted text-xs font-semibold uppercase tracking-wide px-4 py-1.5 mt-2" aria-level={2} role="heading">
              OFFLINE — {offlineMembers.length}
            </h2>
            <div className="space-y-1">
              {offlineMembers.map((member) => (
                <MemberItem key={member.id} member={member} isOnline={false} />
              ))}
            </div>
          </>
        )}
      </ScrollArea>
    </div>
  );
}
