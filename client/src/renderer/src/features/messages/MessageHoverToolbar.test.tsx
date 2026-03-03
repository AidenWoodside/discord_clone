import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MessageHoverToolbar } from './MessageHoverToolbar';

vi.mock('../../services/reactionService', () => ({
  toggleReaction: vi.fn(),
}));

import { toggleReaction } from '../../services/reactionService';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MessageHoverToolbar', () => {
  it('renders quick-react emoji buttons', () => {
    render(<MessageHoverToolbar messageId="msg-1" channelId="ch-1" />);

    expect(screen.getByText('\u{1F44D}')).toBeInTheDocument();
    expect(screen.getByText('\u2764\uFE0F')).toBeInTheDocument();
    expect(screen.getByText('\u{1F602}')).toBeInTheDocument();
    expect(screen.getByText('\u{1F62E}')).toBeInTheDocument();
    expect(screen.getByText('\u{1F622}')).toBeInTheDocument();
    expect(screen.getByText('\u{1F525}')).toBeInTheDocument();
  });

  it('calls toggleReaction with correct emoji on quick-react click', () => {
    render(<MessageHoverToolbar messageId="msg-1" channelId="ch-1" />);

    fireEvent.click(screen.getByText('\u{1F44D}'));
    expect(toggleReaction).toHaveBeenCalledWith('msg-1', 'ch-1', '\u{1F44D}');
  });

  it('shows "+" button for more reactions', () => {
    render(<MessageHoverToolbar messageId="msg-1" channelId="ch-1" />);

    expect(screen.getByLabelText('More reactions')).toBeInTheDocument();
  });

  it('has hidden class for hover visibility', () => {
    const { container } = render(<MessageHoverToolbar messageId="msg-1" channelId="ch-1" />);
    const toolbar = container.querySelector('.hidden.group-hover\\/msg\\:flex');
    expect(toolbar).toBeInTheDocument();
  });
});
