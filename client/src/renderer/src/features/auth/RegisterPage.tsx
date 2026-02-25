import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Button, Input } from '../../components';
import useAuthStore from '../../stores/useAuthStore';

export function RegisterPage(): React.ReactNode {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { register, isLoading, error, clearError } = useAuthStore();

  const canSubmit = username.trim().length > 0 && password.length > 0 && !isLoading;

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!canSubmit || !token) return;

    clearError();
    await register(username, password, token);

    const { user } = useAuthStore.getState();
    if (user) {
      navigate('/app');
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-bg-primary">
      <div className="w-full max-w-sm rounded-lg bg-bg-secondary p-8 shadow-lg">
        <h1 className="mb-6 text-center text-2xl font-bold text-text-primary">Create Account</h1>

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

          {error && (
            <p className="text-sm text-status-dnd">{error}</p>
          )}

          <Button
            type="submit"
            variant="primary"
            disabled={!canSubmit}
            className={!canSubmit ? 'opacity-50 cursor-not-allowed' : ''}
          >
            {isLoading ? 'Creating Account...' : 'Create Account'}
          </Button>
        </form>
      </div>
    </div>
  );
}
