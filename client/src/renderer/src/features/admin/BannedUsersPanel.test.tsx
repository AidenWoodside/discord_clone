import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BannedUsersPanel } from './BannedUsersPanel';

vi.mock('../../services/apiClient', () => ({
  apiRequest: vi.fn(),
  configureApiClient: vi.fn(),
}));

import { apiRequest } from '../../services/apiClient';
const mockApiRequest = vi.mocked(apiRequest);

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
  vi.clearAllMocks();
});

describe('BannedUsersPanel', () => {
  it('fetches and displays banned users', async () => {
    mockApiRequest.mockResolvedValueOnce([
      { id: 'b1', userId: 'u1', username: 'banned1', bannedBy: 'owner', createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'b2', userId: 'u2', username: 'banned2', bannedBy: 'owner', createdAt: '2026-01-02T00:00:00.000Z' },
    ]);

    render(<BannedUsersPanel open={true} onOpenChange={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('banned1')).toBeInTheDocument();
      expect(screen.getByText('banned2')).toBeInTheDocument();
    });
  });

  it('unban button calls API and removes from list', async () => {
    mockApiRequest
      .mockResolvedValueOnce([
        { id: 'b1', userId: 'u1', username: 'banned1', bannedBy: 'owner', createdAt: '2026-01-01T00:00:00.000Z' },
      ])
      .mockResolvedValueOnce(undefined); // unban response

    render(<BannedUsersPanel open={true} onOpenChange={vi.fn()} />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('banned1')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Unban'));

    await waitFor(() => {
      expect(mockApiRequest).toHaveBeenCalledWith('/api/admin/unban/u1', { method: 'POST' });
    });

    await waitFor(() => {
      expect(screen.queryByText('banned1')).not.toBeInTheDocument();
    });
  });

  it('shows empty state message when no bans', async () => {
    mockApiRequest.mockResolvedValueOnce([]);

    render(<BannedUsersPanel open={true} onOpenChange={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('No banned users')).toBeInTheDocument();
    });
  });
});
