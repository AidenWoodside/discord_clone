import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useMemberStore } from '../../stores/useMemberStore';
import { usePresenceStore } from '../../stores/usePresenceStore';
import { MemberList } from './MemberList';

beforeAll(() => {
  window.api = {
    secureStorage: {
      set: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue(undefined),
    },
  };
});

const mockMembers = [
  { id: 'u1', username: 'currentuser', role: 'owner' as const, createdAt: '2024-01-01' },
  { id: 'u2', username: 'otheruser', role: 'user' as const, createdAt: '2024-01-02' },
  { id: 'u3', username: 'thirduser', role: 'user' as const, createdAt: '2024-01-03' },
];

beforeEach(() => {
  useMemberStore.setState({
    members: mockMembers,
    isLoading: false,
    error: null,
  });
  usePresenceStore.setState({
    onlineUsers: new Map([['u1', { userId: 'u1', status: 'online' }]]),
    connectionState: 'connected',
    isLoading: false,
    error: null,
  });
});

describe('MemberList', () => {
  it('groups members into online and offline', () => {
    render(<MemberList />);
    expect(screen.getByText(/ONLINE — 1/)).toBeInTheDocument();
    expect(screen.getByText(/OFFLINE — 2/)).toBeInTheDocument();
  });

  it('shows online user from presence store', () => {
    render(<MemberList />);
    expect(screen.getByText('currentuser')).toBeInTheDocument();
  });

  it('shows other users as offline', () => {
    render(<MemberList />);
    expect(screen.getByText('otheruser')).toBeInTheDocument();
    expect(screen.getByText('thirduser')).toBeInTheDocument();
  });

  it('shows OWNER badge for owner role', () => {
    render(<MemberList />);
    expect(screen.getByText('OWNER')).toBeInTheDocument();
  });

  it('renders loading skeletons when loading', () => {
    useMemberStore.setState({ isLoading: true, members: [] });
    const { container } = render(<MemberList />);
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('updates when presence changes', () => {
    const { rerender } = render(<MemberList />);
    expect(screen.getByText(/ONLINE — 1/)).toBeInTheDocument();

    // Simulate second user coming online
    usePresenceStore.setState({
      onlineUsers: new Map([
        ['u1', { userId: 'u1', status: 'online' }],
        ['u2', { userId: 'u2', status: 'online' }],
      ]),
    });

    rerender(<MemberList />);
    expect(screen.getByText(/ONLINE — 2/)).toBeInTheDocument();
    expect(screen.getByText(/OFFLINE — 1/)).toBeInTheDocument();
  });
});
