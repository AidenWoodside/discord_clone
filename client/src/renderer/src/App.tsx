import React, { useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes, useNavigate } from 'react-router';
import { Tooltip as RadixTooltip } from 'radix-ui';
import { LoginPage } from './features/auth/LoginPage';
import { AuthGuard } from './features/auth/AuthGuard';
import { AppLayout } from './features/layout/AppLayout';
import { ContentArea } from './features/layout/ContentArea';
import useAuthStore from './stores/useAuthStore';
import { useChannelStore } from './stores/useChannelStore';

function ChannelRedirect(): React.ReactNode {
  const navigate = useNavigate();
  const channels = useChannelStore((state) => state.channels);
  const isLoading = useChannelStore((state) => state.isLoading);
  const fetchChannels = useChannelStore((state) => state.fetchChannels);

  useEffect(() => {
    if (!isLoading && channels.length === 0) {
      fetchChannels();
    }
  }, [channels.length, isLoading, fetchChannels]);

  useEffect(() => {
    const firstTextChannel = channels.find((channel) => channel.type === 'text') ?? channels[0];
    if (firstTextChannel) {
      navigate(`/app/channels/${firstTextChannel.id}`, { replace: true });
    }
  }, [channels, navigate]);

  return (
    <div className="h-full flex items-center justify-center text-text-secondary">
      Loading channels...
    </div>
  );
}

function App(): React.ReactNode {
  const restoreSession = useAuthStore((state) => state.restoreSession);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  return (
    <RadixTooltip.Provider>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/register/:token"
            element={(
              <div className="flex h-screen items-center justify-center bg-bg-primary">
                <p className="text-text-primary">Registration coming soon.</p>
              </div>
            )}
          />
          <Route path="/app" element={<AuthGuard />}>
            <Route element={<AppLayout />}>
              <Route index element={<ChannelRedirect />} />
              <Route path="channels" element={<ChannelRedirect />} />
              <Route path="channels/:channelId" element={<ContentArea />} />
            </Route>
          </Route>
          <Route path="/" element={<Navigate to="/app" replace />} />
        </Routes>
      </HashRouter>
    </RadixTooltip.Provider>
  );
}

export default App;
