import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button, Input } from '../../components';
import useAuthStore from '../../stores/useAuthStore';

export function SetupPage(): React.ReactNode {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { setup, isLoading, error, clearError } = useAuthStore();

  const canSubmit = username.trim().length > 0 && password.length >= 8 && !isLoading;

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!canSubmit) return;

    clearError();
    await setup(username, password);

    const { user } = useAuthStore.getState();
    if (user) {
      navigate('/app');
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-bg-primary">
      <div className="w-full max-w-sm rounded-lg bg-bg-secondary p-8 shadow-lg">
        <h1 className="mb-2 text-center text-2xl font-bold text-text-primary">Server Setup</h1>
        <p className="mb-6 text-center text-sm text-text-muted">Create the owner account to get started.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Choose a username"
            autoFocus
            autoComplete="username"
          />

          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Choose a password"
            autoComplete="new-password"
          />

          {password.length > 0 && password.length < 8 && (
            <p className="text-sm text-text-muted">Password must be at least 8 characters.</p>
          )}

          {error && (
            <p className="text-sm text-status-dnd">{error}</p>
          )}

          <Button
            type="submit"
            variant="primary"
            disabled={!canSubmit}
            className={!canSubmit ? 'opacity-50 cursor-not-allowed' : ''}
          >
            {isLoading ? 'Setting up...' : 'Create Owner Account'}
          </Button>
        </form>
      </div>
    </div>
  );
}
