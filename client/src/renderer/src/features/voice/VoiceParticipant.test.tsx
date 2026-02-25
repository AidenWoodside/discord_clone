import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VoiceParticipant } from './VoiceParticipant';
import { useMemberStore } from '../../stores/useMemberStore';
import { useVoiceStore } from '../../stores/useVoiceStore';

vi.mock('../../stores/useAuthStore', () => ({
  default: Object.assign(
    (selector: (s: { user: { id: string } | null }) => unknown) =>
      selector({ user: { id: 'user-1' } }),
    {
      getState: () => ({ user: { id: 'user-1' } }),
      setState: vi.fn(),
      subscribe: vi.fn(),
    },
  ),
}));

// Mock window.matchMedia for reduced motion tests
const mockMatchMedia = vi.fn().mockReturnValue({ matches: false });
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: mockMatchMedia,
});

beforeEach(() => {
  useMemberStore.setState({
    members: [
      { id: 'user-1', username: 'Alice', role: 'user', createdAt: '2024-01-01' },
      { id: 'user-2', username: 'Bob', role: 'user', createdAt: '2024-01-01' },
    ],
  });
  useVoiceStore.setState({
    speakingUsers: new Set<string>(),
    isMuted: false,
  });
  mockMatchMedia.mockReturnValue({ matches: false });
});

describe('VoiceParticipant', () => {
  it('renders avatar with user initial', () => {
    render(<VoiceParticipant userId="user-1" />);

    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('renders username', () => {
    render(<VoiceParticipant userId="user-1" />);

    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('renders avatar with colored background', () => {
    render(<VoiceParticipant userId="user-1" />);

    const avatar = screen.getByText('A');
    expect(avatar).toHaveStyle({ backgroundColor: expect.any(String) });
  });

  it('has correct row height (32px = h-8)', () => {
    const { container } = render(<VoiceParticipant userId="user-1" />);
    const row = container.firstChild as HTMLElement;
    expect(row.className).toContain('h-8');
  });

  it('has left indent (pl-6 = 24px)', () => {
    const { container } = render(<VoiceParticipant userId="user-1" />);
    const row = container.firstChild as HTMLElement;
    expect(row.className).toContain('pl-6');
  });

  it('renders "Unknown" for unrecognized userId', () => {
    render(<VoiceParticipant userId="unknown-user" />);

    expect(screen.getByText('Unknown')).toBeInTheDocument();
    expect(screen.getByText('U')).toBeInTheDocument();
  });

  describe('speaking indicator', () => {
    it('shows speaking ring when user is in speakingUsers', () => {
      useVoiceStore.setState({ speakingUsers: new Set(['user-1']) });
      render(<VoiceParticipant userId="user-1" />);

      const avatar = screen.getByText('A');
      expect(avatar.className).toContain('ring-2');
      expect(avatar.className).toContain('ring-voice-speaking');
    });

    it('does not show speaking ring when user is not speaking', () => {
      render(<VoiceParticipant userId="user-1" />);

      const avatar = screen.getByText('A');
      expect(avatar.className).not.toContain('ring-2');
      expect(avatar.className).not.toContain('ring-voice-speaking');
    });

    it('applies pulse animation when speaking and no reduced motion', () => {
      useVoiceStore.setState({ speakingUsers: new Set(['user-1']) });
      mockMatchMedia.mockReturnValue({ matches: false });

      render(<VoiceParticipant userId="user-1" />);

      const avatar = screen.getByText('A');
      expect(avatar.className).toContain('animate-speakingPulse');
    });

    it('does not apply pulse animation when prefers-reduced-motion is set', () => {
      useVoiceStore.setState({ speakingUsers: new Set(['user-1']) });
      mockMatchMedia.mockReturnValue({ matches: true });

      render(<VoiceParticipant userId="user-1" />);

      const avatar = screen.getByText('A');
      expect(avatar.className).not.toContain('animate-speakingPulse');
      // Still shows the static ring
      expect(avatar.className).toContain('ring-2');
      expect(avatar.className).toContain('ring-voice-speaking');
    });
  });

  describe('ARIA label', () => {
    it('includes (speaking) when user is speaking', () => {
      useVoiceStore.setState({ speakingUsers: new Set(['user-1']) });
      render(<VoiceParticipant userId="user-1" />);

      const row = screen.getByRole('listitem');
      expect(row).toHaveAttribute('aria-label', expect.stringContaining('(speaking)'));
    });

    it('includes (muted) when local user is muted', () => {
      useVoiceStore.setState({ isMuted: true });
      render(<VoiceParticipant userId="user-1" />);

      const row = screen.getByRole('listitem');
      expect(row).toHaveAttribute('aria-label', expect.stringContaining('(muted)'));
    });

    it('does not include (muted) for remote users', () => {
      useVoiceStore.setState({ isMuted: true });
      render(<VoiceParticipant userId="user-2" />);

      const row = screen.getByRole('listitem');
      expect(row).not.toHaveAttribute('aria-label', expect.stringContaining('(muted)'));
    });
  });

  describe('mute icon overlay', () => {
    it('shows mute icon when local user is muted', () => {
      useVoiceStore.setState({ isMuted: true });
      render(<VoiceParticipant userId="user-1" />);

      // MicOff icon should be present (rendered as svg)
      const avatar = screen.getByText('A');
      const muteIcon = avatar.querySelector('svg');
      expect(muteIcon).toBeTruthy();
    });

    it('does not show mute icon when local user is not muted', () => {
      render(<VoiceParticipant userId="user-1" />);

      const avatar = screen.getByText('A');
      const muteIcon = avatar.querySelector('svg');
      expect(muteIcon).toBeNull();
    });

    it('does not show mute icon for remote users even when local user is muted', () => {
      useVoiceStore.setState({ isMuted: true });
      render(<VoiceParticipant userId="user-2" />);

      const avatar = screen.getByText('B');
      const muteIcon = avatar.querySelector('svg');
      expect(muteIcon).toBeNull();
    });
  });
});
