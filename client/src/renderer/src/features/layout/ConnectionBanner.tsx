import React, { useEffect, useRef, useState } from 'react';
import { usePresenceStore } from '../../stores/usePresenceStore';

type ConnectionState = 'connected' | 'connecting' | 'disconnected' | 'reconnecting';

export function ConnectionBanner(): React.ReactNode {
  const connectionState = usePresenceStore((s) => s.connectionState);
  const previousStateRef = useRef<ConnectionState>(connectionState);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    if (connectionState === 'connected' && previousStateRef.current === 'reconnecting') {
      setShowReconnected(true);
      const timer = setTimeout(() => setShowReconnected(false), 2000);
      return () => clearTimeout(timer);
    }
    previousStateRef.current = connectionState;
  }, [connectionState]);

  // Update ref when state changes (for cases where effect doesn't fire cleanup)
  useEffect(() => {
    previousStateRef.current = connectionState;
  });

  if (showReconnected) {
    return (
      <div
        role="status"
        aria-live="assertive"
        className="px-4 py-2 text-sm font-medium text-center bg-green-600/90 text-white"
      >
        Connected
      </div>
    );
  }

  if (connectionState === 'connecting') {
    return (
      <div
        role="status"
        aria-live="assertive"
        className="px-4 py-2 text-sm font-medium text-center bg-amber-600/90 text-white"
      >
        Connecting to server...
      </div>
    );
  }

  if (connectionState === 'reconnecting') {
    return (
      <div
        role="status"
        aria-live="assertive"
        className="px-4 py-2 text-sm font-medium text-center bg-amber-600/90 text-white motion-safe:animate-pulse"
      >
        Trying to reconnect...
      </div>
    );
  }

  if (connectionState === 'disconnected') {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className="px-4 py-2 text-sm font-medium text-center bg-red-600/90 text-white"
      >
        Can&apos;t connect to server. Check your connection or contact the server owner.
      </div>
    );
  }

  return null;
}
