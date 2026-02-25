import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import useAuthStore from '../../stores/useAuthStore';
import { useMemberStore } from '../../stores/useMemberStore';
import { MemberList } from './MemberList';

describe('MemberList', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: { id: 'u1', username: 'owner', role: 'owner' },
      accessToken: null,
      refreshToken: null,
      isLoading: false,
      error: null,
    });

    useMemberStore.setState({
      members: [
        { id: 'u1', username: 'owner', role: 'owner', createdAt: new Date().toISOString() },
        { id: 'u2', username: 'member', role: 'user', createdAt: new Date().toISOString() },
      ],
      isLoading: false,
      error: null,
    });
  });

  it('groups members into online and offline', () => {
    render(<MemberList />);

    expect(screen.getByText('ONLINE — 1')).toBeInTheDocument();
    expect(screen.getByText('OFFLINE — 1')).toBeInTheDocument();
    expect(screen.getByText('owner')).toBeInTheDocument();
    expect(screen.getByText('member')).toBeInTheDocument();
  });

  it('renders loading skeletons when loading', () => {
    useMemberStore.setState({ isLoading: true, members: [] });

    render(<MemberList />);

    expect(screen.getByLabelText('Loading members')).toBeInTheDocument();
  });
});
