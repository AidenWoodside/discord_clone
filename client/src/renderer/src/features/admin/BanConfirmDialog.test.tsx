import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BanConfirmDialog } from './BanConfirmDialog';

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

describe('BanConfirmDialog', () => {
  it('renders with username in title and warning', () => {
    render(<BanConfirmDialog open={true} onOpenChange={vi.fn()} userId="u1" username="testuser" />);
    expect(screen.getByText('Ban testuser?')).toBeInTheDocument();
    expect(screen.getByText(/permanently removed/)).toBeInTheDocument();
  });

  it('cancel closes dialog', async () => {
    const onOpenChange = vi.fn();
    render(<BanConfirmDialog open={true} onOpenChange={onOpenChange} userId="u1" username="testuser" />);
    const user = userEvent.setup();

    await user.click(screen.getByText('Cancel'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('confirm calls ban API', async () => {
    const onOpenChange = vi.fn();
    mockApiRequest.mockResolvedValueOnce(undefined);
    render(<BanConfirmDialog open={true} onOpenChange={onOpenChange} userId="u1" username="testuser" />);
    const user = userEvent.setup();

    await user.click(screen.getByText('Ban'));

    await waitFor(() => {
      expect(mockApiRequest).toHaveBeenCalledWith('/api/admin/ban/u1', { method: 'POST' });
    });
  });
});
