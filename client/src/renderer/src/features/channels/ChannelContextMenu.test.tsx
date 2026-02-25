import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { useChannelStore } from '../../stores/useChannelStore';
import { ChannelContextMenu } from './ChannelContextMenu';

vi.mock('../../services/apiClient', () => ({
  apiRequest: vi.fn(),
}));

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
  useChannelStore.setState({
    channels: [
      { id: 'ch-1', name: 'general', type: 'text', createdAt: '2024-01-01' },
    ],
    activeChannelId: null,
    isLoading: false,
    error: null,
  });
});

function renderContextMenu() {
  return render(
    <MemoryRouter>
      <ChannelContextMenu channelId="ch-1" channelName="general">
        <div>Channel Item</div>
      </ChannelContextMenu>
    </MemoryRouter>,
  );
}

describe('ChannelContextMenu', () => {
  it('renders children', () => {
    renderContextMenu();
    expect(screen.getByText('Channel Item')).toBeInTheDocument();
  });

  it('shows Delete Channel option on right-click', async () => {
    renderContextMenu();
    const user = userEvent.setup();

    await user.pointer({ keys: '[MouseRight]', target: screen.getByText('Channel Item') });

    await waitFor(() => {
      expect(screen.getByText('Delete Channel')).toBeInTheDocument();
    });
  });

  it('opens confirmation dialog when Delete Channel is clicked', async () => {
    renderContextMenu();
    const user = userEvent.setup();

    await user.pointer({ keys: '[MouseRight]', target: screen.getByText('Channel Item') });

    await waitFor(() => {
      expect(screen.getByText('Delete Channel')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Delete Channel'));

    await waitFor(() => {
      expect(screen.getByText('Delete #general?')).toBeInTheDocument();
      expect(screen.getByText("All messages will be permanently deleted. This can't be undone.")).toBeInTheDocument();
    });
  });

  it('calls deleteChannel on confirm', async () => {
    const deleteChannel = vi.fn().mockResolvedValue(undefined);
    useChannelStore.setState({ deleteChannel });

    renderContextMenu();
    const user = userEvent.setup();

    await user.pointer({ keys: '[MouseRight]', target: screen.getByText('Channel Item') });
    await waitFor(() => {
      expect(screen.getByText('Delete Channel')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Delete Channel'));
    await waitFor(() => {
      expect(screen.getByText('Delete #general?')).toBeInTheDocument();
    });

    // Click the Delete button in the confirmation dialog
    await user.click(screen.getByRole('button', { name: /^Delete$/i }));

    await waitFor(() => {
      expect(deleteChannel).toHaveBeenCalledWith('ch-1');
    });
  });
});
