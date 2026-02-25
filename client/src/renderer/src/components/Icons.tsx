import React from 'react';

interface IconProps {
  size?: number;
  className?: string;
}

export function HashIcon({ size = 18, className = '' }: IconProps): React.ReactNode {
  return <span className={`inline-flex items-center justify-center font-semibold ${className}`} style={{ width: size, height: size }}>#</span>;
}

export function VolumeIcon({ size = 18, className = '' }: IconProps): React.ReactNode {
  return <span className={`inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>🔊</span>;
}

export function SettingsIcon({ size = 18, className = '' }: IconProps): React.ReactNode {
  return <span aria-hidden className={`inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>⚙</span>;
}

export function ChevronDownIcon({ size = 16, className = '' }: IconProps): React.ReactNode {
  return <span aria-hidden className={`inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>▾</span>;
}

export function UsersIcon({ size = 18, className = '' }: IconProps): React.ReactNode {
  return <span aria-hidden className={`inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>👥</span>;
}
