import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { ChannelItem } from './ChannelItem';

const mockOnClick = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
});

function renderItem(props: { type: 'text' | 'voice'; isActive?: boolean }) {
  return render(
    <MemoryRouter>
      <ChannelItem
        channel={{ id: 'ch-1', name: 'test-channel', type: props.type, createdAt: '2024-01-01' }}
        isActive={props.isActive ?? false}
        onClick={mockOnClick}
      />
    </MemoryRouter>,
  );
}

describe('ChannelItem', () => {
  it('renders channel name', () => {
    renderItem({ type: 'text' });
    expect(screen.getByText('test-channel')).toBeInTheDocument();
  });

  it('renders as a button element', () => {
    renderItem({ type: 'text' });
    expect(screen.getByRole('button', { name: /test-channel/i })).toBeInTheDocument();
  });

  it('applies active styling when isActive is true', () => {
    renderItem({ type: 'text', isActive: true });
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-current', 'page');
    expect(button.className).toContain('bg-bg-active');
  });

  it('does not have aria-current when inactive', () => {
    renderItem({ type: 'text', isActive: false });
    const button = screen.getByRole('button');
    expect(button).not.toHaveAttribute('aria-current');
  });

  it('calls onClick when clicked', async () => {
    renderItem({ type: 'text' });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button'));
    expect(mockOnClick).toHaveBeenCalledOnce();
  });
});
