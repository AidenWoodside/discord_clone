import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import useAuthStore from '../../stores/useAuthStore';
import { ServerHeader } from './ServerHeader';

beforeAll(() => {
  window.api = {
    secureStorage: {
      set: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue(undefined),
    },
  };
});

beforeEach(() => {
  useAuthStore.setState({
    user: null,
    accessToken: null,
    refreshToken: null,
    groupKey: null,
    isLoading: false,
    error: null,
  });
});

function renderServerHeader() {
  return render(
    <MemoryRouter>
      <ServerHeader />
    </MemoryRouter>,
  );
}

describe('ServerHeader', () => {
  it('shows server name for all users', () => {
    useAuthStore.setState({ user: { id: 'u1', username: 'regular', role: 'user' } });
    renderServerHeader();
    expect(screen.getByText('discord_clone')).toBeInTheDocument();
  });

  it('shows dropdown trigger (chevron) for owner', () => {
    useAuthStore.setState({ user: { id: 'u1', username: 'admin', role: 'owner' } });
    renderServerHeader();
    // Owner sees a button with the server name
    const trigger = screen.getByRole('button', { name: /discord_clone/i });
    expect(trigger).toBeInTheDocument();
  });

  it('does not show dropdown trigger for regular user', () => {
    useAuthStore.setState({ user: { id: 'u1', username: 'regular', role: 'user' } });
    renderServerHeader();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('opens dropdown with "Create Channel" on click for owner', async () => {
    useAuthStore.setState({ user: { id: 'u1', username: 'admin', role: 'owner' } });
    renderServerHeader();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /discord_clone/i }));

    expect(screen.getByText('Create Channel')).toBeInTheDocument();
    expect(screen.getByText('Invite People')).toBeInTheDocument();
  });
});
