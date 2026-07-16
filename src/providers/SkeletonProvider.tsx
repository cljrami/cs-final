// src/providers/SkeletonProvider.tsx
import React from 'react';
import { SkeletonTheme } from 'react-loading-skeleton';

interface SkeletonProviderProps {
  children: React.ReactNode;
  baseColor?: string;
  highlightColor?: string;
  borderRadius?: string;
  duration?: number;
}

export function SkeletonProvider({
  children,
  baseColor = '#1a1a2e',
  highlightColor = '#2a2a3e',
  borderRadius = '0.5rem',
  duration = 1.2,
}: SkeletonProviderProps) {
  return (
    <SkeletonTheme
      baseColor={baseColor}
      highlightColor={highlightColor}
      borderRadius={borderRadius}
      duration={duration}
    >
      {children}
    </SkeletonTheme>
  );
}