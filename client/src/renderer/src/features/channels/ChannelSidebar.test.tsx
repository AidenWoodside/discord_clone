import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useChannelStore } from '../../stores/useChannelStore';
import useAuthStore from '../../stores/useAuthStore';
import { ChannelSidebar } from './ChannelSidebar';

const navigateMock = vi.fn();

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

describe('ChannelSidebar', () => {
  beforeEach(() => {
    navigateMock.mockReset();

    useAuthStore.setState({
      user: { id: 'u1', username: 'owner', role: 'owner' },
      accessToken: null,
      refreshToken: null,
      isLoading: false,
      error: null,
    });

    useChannelStore.setState({
      channels: [
        { id: '1', name: 'general', type: 'text', createdAt: new Date().toISOString() },
        { id: '2', name: 'Gaming', type: 'voice', createdAt: new Date().toISOString() },
      ],
      activeChannelId: null,
      isLoading: false,
      error: null,
    });
  });

  it('renders server header, channels, and user panel', () => {
    render(<ChannelSidebar />);

    expect(screen.getByText('discord_clone')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /general/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /gaming/i })).toBeInTheDocument();
    expect(screen.getByText('owner')).toBeInTheDocument();
  });

  it('sets active channel and navigates on click', () => {
    render(<ChannelSidebar />);

    fireEvent.click(screen.getByRole('button', { name: /general/i }));

    expect(useChannelStore.getState().activeChannelId).toBe('1');
    expect(navigateMock).toHaveBeenCalledWith('/app/channels/1');
  });
});
