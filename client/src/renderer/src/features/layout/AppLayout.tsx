import React, { useEffect, useRef } from 'react';
import { Outlet, useParams } from 'react-router';
import { useChannelStore } from '../../stores/useChannelStore';
import { useMemberStore } from '../../stores/useMemberStore';
import { useUIStore } from '../../stores/useUIStore';
import { ChannelSidebar } from '../channels/ChannelSidebar';
import { MemberList } from '../members/MemberList';

const MEMBER_LIST_BREAKPOINT = 1000;

export function AppLayout(): React.ReactNode {
  const { channelId } = useParams();

  const fetchChannels = useChannelStore((state) => state.fetchChannels);
  const setActiveChannel = useChannelStore((state) => state.setActiveChannel);
  const activeChannelId = useChannelStore((state) => state.activeChannelId);

  const fetchMembers = useMemberStore((state) => state.fetchMembers);

  const isMemberListVisible = useUIStore((state) => state.isMemberListVisible);
  const setMemberListVisible = useUIStore((state) => state.setMemberListVisible);

  const wasAutoCollapsedRef = useRef(false);
  const userOverrodeAutoCollapseRef = useRef(false);
  const autoActionRef = useRef(false);

  useEffect(() => {
    fetchChannels();
    fetchMembers();
  }, [fetchChannels, fetchMembers]);

  useEffect(() => {
    if (channelId && channelId !== activeChannelId) {
      setActiveChannel(channelId);
    }
  }, [channelId, activeChannelId, setActiveChannel]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleResize = (): void => {
      if (window.innerWidth < MEMBER_LIST_BREAKPOINT) {
        if (useUIStore.getState().isMemberListVisible) {
          autoActionRef.current = true;
          wasAutoCollapsedRef.current = true;
          userOverrodeAutoCollapseRef.current = false;
          setMemberListVisible(false);
        }
        return;
      }

      if (wasAutoCollapsedRef.current && !userOverrodeAutoCollapseRef.current) {
        autoActionRef.current = true;
        setMemberListVisible(true);
      }
      wasAutoCollapsedRef.current = false;
      userOverrodeAutoCollapseRef.current = false;
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [setMemberListVisible]);

  useEffect(() => {
    if (typeof window === 'undefined' || window.innerWidth >= MEMBER_LIST_BREAKPOINT) {
      autoActionRef.current = false;
      return;
    }

    if (!autoActionRef.current && wasAutoCollapsedRef.current) {
      userOverrodeAutoCollapseRef.current = true;
    }

    autoActionRef.current = false;
  }, [isMemberListVisible]);

  return (
    <div className="flex h-screen overflow-hidden bg-bg-primary text-text-primary">
      <nav aria-label="Channel navigation" className="w-[240px] flex-shrink-0 bg-bg-secondary border-r border-border-default">
        <ChannelSidebar />
      </nav>

      <main aria-label="Channel content" className="flex-1 min-w-0 bg-bg-primary">
        <Outlet />
      </main>

      {isMemberListVisible ? (
        <aside aria-label="Member list" className="w-[240px] flex-shrink-0 bg-bg-secondary border-l border-border-default">
          <MemberList />
        </aside>
      ) : null}
    </div>
  );
}
