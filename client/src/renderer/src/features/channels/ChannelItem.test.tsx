import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ChannelItem } from './ChannelItem';

describe('ChannelItem', () => {
  it('renders hash icon for text channels and handles click', () => {
    const onClick = vi.fn();
    render(
      <ChannelItem
        channel={{ id: '1', name: 'general', type: 'text', createdAt: new Date().toISOString() }}
        isActive={false}
        onClick={onClick}
      />,
    );

    expect(screen.getByRole('button', { name: /general/i })).toHaveTextContent('#');
    fireEvent.click(screen.getByRole('button', { name: /general/i }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders voice icon and active styling for voice channels', () => {
    render(
      <ChannelItem
        channel={{ id: '2', name: 'Gaming', type: 'voice', createdAt: new Date().toISOString() }}
        isActive
        onClick={() => {}}
      />,
    );

    const button = screen.getByRole('button', { name: /gaming/i });
    expect(button).toHaveTextContent('🔊');
    expect(button.className).toContain('bg-bg-active');
  });
});
