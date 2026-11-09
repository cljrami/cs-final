import type { CSSProperties } from 'react';
import SkeletonLib from 'react-loading-skeleton';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  circle?: boolean;
  count?: number;
  inline?: boolean;
  borderRadius?: string | number;
  className?: string;
  enableAnimation?: boolean;
  baseColor?: string;
  highlightColor?: string;
}

export function Skeleton({
  width,
  height = '1em',
  circle,
  count = 1,
  inline,
  borderRadius,
  className = '',
  enableAnimation,
  baseColor,
  highlightColor,
}: SkeletonProps) {
  return (
    <span
      className={inline ? 'inline-flex items-center' : 'block'}
      style={
        {
          '--base-color':
            baseColor || 'color-mix(in srgb, var(--color-ink) 16%, transparent)',
          '--highlight-color':
            highlightColor || 'color-mix(in srgb, var(--color-ink) 26%, transparent)',
        } as CSSProperties
      }
    >
      <SkeletonLib
        width={width}
        height={height}
        circle={circle}
        count={count}
        inline={inline}
        borderRadius={borderRadius}
        className={className}
        enableAnimation={enableAnimation}
      />
    </span>
  );
}