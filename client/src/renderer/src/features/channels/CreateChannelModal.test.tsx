import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { useChannelStore } from '../../stores/useChannelStore';
import { CreateChannelModal } from './CreateChannelModal';

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
    channels: [],
    activeChannelId: null,
    isLoading: false,
    error: null,
  });
});

function renderModal(open = true) {
  const onOpenChange = vi.fn();
  const result = render(
    <MemoryRouter>
      <CreateChannelModal open={open} onOpenChange={onOpenChange} />
    </MemoryRouter>,
  );
  return { ...result, onOpenChange };
}

describe('CreateChannelModal', () => {
  it('renders form with name input, type toggle, and buttons', () => {
    renderModal();
    expect(screen.getByText('Create Channel')).toBeInTheDocument();
    expect(screen.getByLabelText('CHANNEL NAME')).toBeInTheDocument();
    expect(screen.getByText('Text')).toBeInTheDocument();
    expect(screen.getByText('Voice')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('Create button is disabled when name is empty', () => {
    renderModal();
    expect(screen.getByRole('button', { name: /create/i })).toBeDisabled();
  });

  it('Create button is enabled when name has content', async () => {
    renderModal();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('CHANNEL NAME'), 'new-channel');
    expect(screen.getByRole('button', { name: /create/i })).toBeEnabled();
  });

  it('lowercases and hyphenates input', async () => {
    renderModal();
    const user = userEvent.setup();
    const input = screen.getByLabelText('CHANNEL NAME');
    await user.type(input, 'My Channel');
    expect(input).toHaveValue('my-channel');
  });

  it('submits with correct params on create', async () => {
    const createChannel = vi.fn().mockResolvedValue(undefined);
    useChannelStore.setState({ createChannel });

    const { onOpenChange } = renderModal();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('CHANNEL NAME'), 'test-channel');
    await user.click(screen.getByRole('button', { name: /create/i }));

    await waitFor(() => {
      expect(createChannel).toHaveBeenCalledWith('test-channel', 'text');
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows error on failure', async () => {
    const createChannel = vi.fn().mockRejectedValue(new Error('Channel limit reached'));
    useChannelStore.setState({ createChannel });

    renderModal();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('CHANNEL NAME'), 'test');
    await user.click(screen.getByRole('button', { name: /create/i }));

    await waitFor(() => {
      expect(screen.getByText('Channel limit reached')).toBeInTheDocument();
    });
  });
});
