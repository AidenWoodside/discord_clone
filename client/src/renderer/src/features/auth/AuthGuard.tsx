import React from 'react';
import { Navigate, Outlet } from 'react-router';
import useAuthStore from '../../stores/useAuthStore';

export function AuthGuard(): React.ReactNode {
  const { user, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="flex h-screen bg-bg-primary">
        <div className="w-60 shrink-0 bg-bg-secondary p-4">
          <div className="mb-6 h-6 w-3/4 animate-pulse rounded bg-bg-tertiary" />
          <div className="flex flex-col gap-3">
            <div className="h-4 w-full animate-pulse rounded bg-bg-tertiary" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-bg-tertiary" />
            <div className="h-4 w-4/6 animate-pulse rounded bg-bg-tertiary" />
          </div>
        </div>
        <div className="flex-1 p-6">
          <div className="mb-4 h-6 w-1/3 animate-pulse rounded bg-bg-secondary" />
          <div className="flex flex-col gap-3">
            <div className="h-4 w-full animate-pulse rounded bg-bg-secondary" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-bg-secondary" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
