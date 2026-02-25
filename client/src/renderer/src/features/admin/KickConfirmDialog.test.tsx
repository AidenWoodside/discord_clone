import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KickConfirmDialog } from './KickConfirmDialog';

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

describe('KickConfirmDialog', () => {
  it('renders with username in title', () => {
    render(<KickConfirmDialog open={true} onOpenChange={vi.fn()} userId="u1" username="testuser" />);
    expect(screen.getByText('Kick testuser?')).toBeInTheDocument();
  });

  it('cancel closes dialog', async () => {
    const onOpenChange = vi.fn();
    render(<KickConfirmDialog open={true} onOpenChange={onOpenChange} userId="u1" username="testuser" />);
    const user = userEvent.setup();

    await user.click(screen.getByText('Cancel'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('confirm calls kick API', async () => {
    const onOpenChange = vi.fn();
    mockApiRequest.mockResolvedValueOnce(undefined);
    render(<KickConfirmDialog open={true} onOpenChange={onOpenChange} userId="u1" username="testuser" />);
    const user = userEvent.setup();

    await user.click(screen.getByText('Kick'));

    await waitFor(() => {
      expect(mockApiRequest).toHaveBeenCalledWith('/api/admin/kick/u1', { method: 'POST' });
    });
  });

  it('shows loading state during API call', async () => {
    let resolveApi: () => void;
    mockApiRequest.mockImplementation(() => new Promise((resolve) => { resolveApi = resolve as () => void; }));

    render(<KickConfirmDialog open={true} onOpenChange={vi.fn()} userId="u1" username="testuser" />);
    const user = userEvent.setup();

    await user.click(screen.getByText('Kick'));
    expect(screen.getByText('Kicking...')).toBeInTheDocument();

    resolveApi!();
  });
});
