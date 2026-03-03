import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import useMessageStore from '../../stores/useMessageStore';
import useAuthStore from '../../stores/useAuthStore';
import { ReactionPills } from './ReactionPills';

vi.mock('../../services/reactionService', () => ({
  toggleReaction: vi.fn(),
}));

import { toggleReaction } from '../../services/reactionService';

beforeEach(() => {
  useMessageStore.setState({
    messages: new Map(),
    reactions: new Map(),
    hasMoreMessages: new Map(),
    cursors: new Map(),
    isLoadingMore: false,
    currentChannelId: null,
    isLoading: false,
    error: null,
    sendError: null,
  });
  useAuthStore.setState({
    user: { id: 'current-user', username: 'testuser' },
  } as Parameters<typeof useAuthStore.setState>[0]);
  vi.clearAllMocks();
});

describe('ReactionPills', () => {
  it('renders nothing when no reactions exist', () => {
    const { container } = render(<ReactionPills messageId="msg-1" channelId="ch-1" />);
    expect(container.innerHTML).toBe('');
  });

  it('renders emoji and count for each reaction', () => {
    useMessageStore.getState().setReactionsForMessages(
      new Map([['msg-1', [
        { emoji: '\u{1F44D}', count: 3, userIds: ['u1', 'u2', 'u3'] },
        { emoji: '\u2764\uFE0F', count: 1, userIds: ['u1'] },
      ]]]),
    );

    render(<ReactionPills messageId="msg-1" channelId="ch-1" />);

    expect(screen.getByText('\u{1F44D}')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('\u2764\uFE0F')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('highlights pill when current user has reacted', () => {
    useMessageStore.getState().setReactionsForMessages(
      new Map([['msg-1', [
        { emoji: '\u{1F44D}', count: 1, userIds: ['current-user'] },
      ]]]),
    );

    render(<ReactionPills messageId="msg-1" channelId="ch-1" />);

    const pill = screen.getByText('\u{1F44D}').closest('button');
    expect(pill).toHaveClass('border-accent-primary');
  });

  it('calls toggleReaction on pill click', () => {
    useMessageStore.getState().setReactionsForMessages(
      new Map([['msg-1', [
        { emoji: '\u{1F44D}', count: 1, userIds: ['u1'] },
      ]]]),
    );

    render(<ReactionPills messageId="msg-1" channelId="ch-1" />);

    fireEvent.click(screen.getByText('\u{1F44D}').closest('button')!);
    expect(toggleReaction).toHaveBeenCalledWith('msg-1', 'ch-1', '\u{1F44D}');
  });

  it('shows "+" button to add reaction', () => {
    useMessageStore.getState().setReactionsForMessages(
      new Map([['msg-1', [
        { emoji: '\u{1F44D}', count: 1, userIds: ['u1'] },
      ]]]),
    );

    render(<ReactionPills messageId="msg-1" channelId="ch-1" />);

    expect(screen.getByLabelText('Add reaction')).toBeInTheDocument();
  });
});
