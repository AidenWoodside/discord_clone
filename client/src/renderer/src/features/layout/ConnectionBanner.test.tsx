import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { usePresenceStore } from '../../stores/usePresenceStore';
import { ConnectionBanner } from './ConnectionBanner';

beforeEach(() => {
  usePresenceStore.setState({
    onlineUsers: new Map(),
    connectionState: 'connected',
    isLoading: false,
    error: null,
  });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ConnectionBanner', () => {
  it('should not render when connected', () => {
    usePresenceStore.setState({ connectionState: 'connected' });
    const { container } = render(<ConnectionBanner />);
    expect(container.innerHTML).toBe('');
  });

  it('should show amber banner when connecting', () => {
    usePresenceStore.setState({ connectionState: 'connecting' });
    render(<ConnectionBanner />);
    expect(screen.getByText('Connecting to server...')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveClass('bg-amber-600/90');
  });

  it('should show amber banner with pulse when reconnecting', () => {
    usePresenceStore.setState({ connectionState: 'reconnecting' });
    render(<ConnectionBanner />);
    expect(screen.getByText('Trying to reconnect...')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveClass('bg-amber-600/90');
    expect(screen.getByRole('status')).toHaveClass('motion-safe:animate-pulse');
  });

  it('should show red banner when disconnected', () => {
    usePresenceStore.setState({ connectionState: 'disconnected' });
    render(<ConnectionBanner />);
    expect(screen.getByText(/Can't connect to server/)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveClass('bg-red-600/90');
  });

  it('should show green banner briefly after reconnection', () => {
    // Start in reconnecting state
    usePresenceStore.setState({ connectionState: 'reconnecting' });
    const { rerender } = render(<ConnectionBanner />);
    expect(screen.getByText('Trying to reconnect...')).toBeInTheDocument();

    // Transition to connected
    act(() => {
      usePresenceStore.setState({ connectionState: 'connected' });
    });
    rerender(<ConnectionBanner />);

    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveClass('bg-green-600/90');
  });

  it('should auto-dismiss reconnected banner after 2 seconds', () => {
    usePresenceStore.setState({ connectionState: 'reconnecting' });
    const { rerender } = render(<ConnectionBanner />);

    act(() => {
      usePresenceStore.setState({ connectionState: 'connected' });
    });
    rerender(<ConnectionBanner />);
    expect(screen.getByText('Connected')).toBeInTheDocument();

    // Fast-forward 2 seconds
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    rerender(<ConnectionBanner />);
    expect(screen.queryByText('Connected')).not.toBeInTheDocument();
  });

  it('should have assertive aria-live for connection states', () => {
    usePresenceStore.setState({ connectionState: 'reconnecting' });
    render(<ConnectionBanner />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'assertive');
  });
});
