import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import useAuthStore from '../../stores/useAuthStore';
import { MemberContextMenu } from './MemberContextMenu';

beforeAll(() => {
  window.api = {
    secureStorage: {
      set: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue(undefined),
    },
  };
});

vi.mock('../../services/apiClient', () => ({
  apiRequest: vi.fn().mockResolvedValue({ temporaryPassword: 'test-password' }),
  configureApiClient: vi.fn(),
}));

import { apiRequest } from '../../services/apiClient';
const mockApiRequest = vi.mocked(apiRequest);

beforeEach(() => {
  vi.clearAllMocks();
  mockApiRequest.mockResolvedValue({ temporaryPassword: 'test-password' });
});

function renderMenu(userRole: string, currentUserId: string, targetUserId: string, targetUsername: string) {
  useAuthStore.setState({
    user: { id: currentUserId, username: 'admin', role: userRole },
    accessToken: 'test-token',
    refreshToken: 'test-refresh',
    groupKey: null,
    isLoading: false,
    error: null,
  });

  return render(
    <MemberContextMenu userId={targetUserId} username={targetUsername}>
      <div data-testid="member-item">Member</div>
    </MemberContextMenu>,
  );
}

describe('MemberContextMenu', () => {
  it('renders context menu items for owner role targeting another user', async () => {
    renderMenu('owner', 'owner-id', 'user-id', 'testuser');
    const user = userEvent.setup();

    // Right-click to open context menu
    await user.pointer({ keys: '[MouseRight]', target: screen.getByTestId('member-item') });

    expect(screen.getByText('Kick')).toBeInTheDocument();
    expect(screen.getByText('Ban')).toBeInTheDocument();
    expect(screen.getByText('Reset Password')).toBeInTheDocument();
  });

  it('does not render context menu for regular user', () => {
    renderMenu('user', 'user-id', 'other-id', 'otheruser');

    // The child should be rendered directly without context menu
    expect(screen.getByTestId('member-item')).toBeInTheDocument();
  });

  it('does not render context menu when targeting self', () => {
    renderMenu('owner', 'owner-id', 'owner-id', 'admin');

    // The child should be rendered directly without context menu
    expect(screen.getByTestId('member-item')).toBeInTheDocument();
  });

  it('clicking Kick opens KickConfirmDialog', async () => {
    renderMenu('owner', 'owner-id', 'user-id', 'testuser');
    const user = userEvent.setup();

    await user.pointer({ keys: '[MouseRight]', target: screen.getByTestId('member-item') });
    await user.click(screen.getByText('Kick'));

    expect(screen.getByText('Kick testuser?')).toBeInTheDocument();
  });

  it('clicking Ban opens BanConfirmDialog', async () => {
    renderMenu('owner', 'owner-id', 'user-id', 'testuser');
    const user = userEvent.setup();

    await user.pointer({ keys: '[MouseRight]', target: screen.getByTestId('member-item') });
    await user.click(screen.getByText('Ban'));

    expect(screen.getByText('Ban testuser?')).toBeInTheDocument();
  });

  it('clicking Reset Password opens ResetPasswordDialog', async () => {
    renderMenu('owner', 'owner-id', 'user-id', 'testuser');
    const user = userEvent.setup();

    await user.pointer({ keys: '[MouseRight]', target: screen.getByTestId('member-item') });
    await user.click(screen.getByText('Reset Password'));

    expect(screen.getByText('Reset Password for testuser')).toBeInTheDocument();
  });
});
