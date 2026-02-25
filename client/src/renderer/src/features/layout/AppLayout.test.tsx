import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useChannelStore } from '../../stores/useChannelStore';
import { useMemberStore } from '../../stores/useMemberStore';
import { useUIStore } from '../../stores/useUIStore';
import { AppLayout } from './AppLayout';

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return {
    ...actual,
    Outlet: () => <div data-testid="layout-outlet" />,
    useParams: () => ({}),
  };
});

describe('AppLayout', () => {
  beforeEach(() => {
    useChannelStore.setState({
      channels: [],
      activeChannelId: null,
      isLoading: false,
      error: null,
      fetchChannels: vi.fn().mockResolvedValue(undefined),
      setActiveChannel: vi.fn(),
      clearError: vi.fn(),
    });

    useMemberStore.setState({
      members: [],
      isLoading: false,
      error: null,
      fetchMembers: vi.fn().mockResolvedValue(undefined),
      clearError: vi.fn(),
    });

    useUIStore.setState({
      isMemberListVisible: true,
      toggleMemberList: vi.fn(),
      setMemberListVisible: vi.fn(),
    });
  });

  it('renders three-column semantic structure', () => {
    render(<AppLayout />);

    expect(screen.getByRole('navigation', { name: 'Channel navigation' })).toBeInTheDocument();
    expect(screen.getByRole('main', { name: 'Channel content' })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Member list' })).toBeInTheDocument();
    expect(screen.getByTestId('layout-outlet')).toBeInTheDocument();
  });
});
