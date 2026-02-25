import React, { useState, useRef, useEffect } from 'react';
import { Hash, Volume2 } from 'lucide-react';
import { Modal, Button } from '../../components';
import { useChannelStore } from '../../stores/useChannelStore';

interface CreateChannelModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateChannelModal({ open, onOpenChange }: CreateChannelModalProps): React.ReactNode {
  const [name, setName] = useState('');
  const [type, setType] = useState<'text' | 'voice'>('text');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const createChannel = useChannelStore((s) => s.createChannel);

  useEffect(() => {
    if (open) {
      setName('');
      setType('text');
      setError(null);
      setIsSubmitting(false);
      // Auto-focus after modal animation
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toLowerCase().replace(/\s+/g, '-');
    setName(value);
    setError(null);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await createChannel(trimmed, type);
      onOpenChange(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Create Channel">
      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4 w-[400px]">
        {/* Type Toggle */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">CHANNEL TYPE</span>
          <div className="flex flex-col gap-1">
            <TypeOption
              icon={<Hash size={20} />}
              label="Text"
              description="Send messages, images, GIFs, and more"
              selected={type === 'text'}
              onSelect={() => setType('text')}
            />
            <TypeOption
              icon={<Volume2 size={20} />}
              label="Voice"
              description="Hang out together with voice and video"
              selected={type === 'voice'}
              onSelect={() => setType('voice')}
            />
          </div>
        </div>

        {/* Channel Name */}
        <div className="flex flex-col gap-1">
          <label htmlFor="channel-name" className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            CHANNEL NAME
          </label>
          <div className="flex items-center bg-bg-tertiary rounded-[12px] h-[44px] px-3">
            {type === 'text' ? <Hash size={18} className="text-text-muted flex-shrink-0" /> : <Volume2 size={18} className="text-text-muted flex-shrink-0" />}
            <input
              ref={inputRef}
              id="channel-name"
              type="text"
              value={name}
              onChange={handleNameChange}
              placeholder="new-channel"
              maxLength={50}
              className="flex-1 bg-transparent text-text-primary placeholder:text-text-muted outline-none ml-1 text-sm"
            />
          </div>
          {error && <p className="text-sm text-error">{error}</p>}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 mt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!name.trim() || isSubmitting}
          >
            {isSubmitting ? 'Creating...' : 'Create'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function TypeOption({
  icon,
  label,
  description,
  selected,
  onSelect,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
}): React.ReactNode {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex items-center gap-3 p-2.5 rounded-lg transition-colors ${
        selected ? 'bg-bg-active' : 'bg-bg-hover hover:bg-bg-active/50'
      }`}
    >
      <div className="text-text-secondary">{icon}</div>
      <div className="flex flex-col text-left">
        <span className="text-sm font-medium text-text-primary">{label}</span>
        <span className="text-xs text-text-muted">{description}</span>
      </div>
      <div className="ml-auto">
        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
          selected ? 'border-accent-primary' : 'border-text-muted'
        }`}>
          {selected && <div className="w-2.5 h-2.5 rounded-full bg-accent-primary" />}
        </div>
      </div>
    </button>
  );
}
