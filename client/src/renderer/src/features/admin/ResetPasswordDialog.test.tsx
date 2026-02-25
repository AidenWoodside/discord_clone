import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ResetPasswordDialog } from './ResetPasswordDialog';

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
  // Reset clipboard mock each time
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    writable: true,
    configurable: true,
  });
});

describe('ResetPasswordDialog', () => {
  it('calls API on open and displays temp password', async () => {
    mockApiRequest.mockResolvedValueOnce({ temporaryPassword: 'abc123tempPass' });

    render(<ResetPasswordDialog open={true} onOpenChange={vi.fn()} userId="u1" username="testuser" />);

    await waitFor(() => {
      expect(mockApiRequest).toHaveBeenCalledWith('/api/admin/reset-password/u1', { method: 'POST' });
    });

    await waitFor(() => {
      expect(screen.getByText('abc123tempPass')).toBeInTheDocument();
    });
  });

  it('copy button shows copied state', async () => {
    mockApiRequest.mockResolvedValueOnce({ temporaryPassword: 'abc123tempPass' });

    render(<ResetPasswordDialog open={true} onOpenChange={vi.fn()} userId="u1" username="testuser" />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('abc123tempPass')).toBeInTheDocument();
    });

    expect(screen.getByText('Copy Password')).toBeInTheDocument();
    await user.click(screen.getByText('Copy Password'));

    await waitFor(() => {
      expect(screen.getByText('Copied!')).toBeInTheDocument();
    });
  });

  it('done closes dialog', async () => {
    mockApiRequest.mockResolvedValueOnce({ temporaryPassword: 'abc123tempPass' });
    const onOpenChange = vi.fn();

    render(<ResetPasswordDialog open={true} onOpenChange={onOpenChange} userId="u1" username="testuser" />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('abc123tempPass')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Done'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
