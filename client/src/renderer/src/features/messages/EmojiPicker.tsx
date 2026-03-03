import React, { useEffect, useRef } from 'react';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export function EmojiPicker({ onSelect, onClose }: EmojiPickerProps): React.ReactNode {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full right-0 mb-1 z-50 bg-bg-floating rounded-lg shadow-lg border border-border-default"
    >
      <Picker
        data={data}
        onEmojiSelect={(emoji: { native: string }) => onSelect(emoji.native)}
        theme="dark"
        previewPosition="none"
        skinTonePosition="none"
      />
    </div>
  );
}
