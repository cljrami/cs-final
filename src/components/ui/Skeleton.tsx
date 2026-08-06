import { Fragment } from 'react';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  circle?: boolean;
  count?: number;
  inline?: boolean;
  borderRadius?: string | number;
  className?: string;
}

export function Skeleton({ width, height = '1em', circle, count = 1, inline, borderRadius, className = '' }: SkeletonProps) {
  const style: React.CSSProperties = {};

  if (width !== undefined) {
    style.width = typeof width === 'number' ? `${width}px` : width;
  }
  if (height !== undefined) {
    style.height = typeof height === 'number' ? `${height}px` : height;
  }
  if (borderRadius !== undefined) {
    style.borderRadius = typeof borderRadius === 'number' ? `${borderRadius}px` : borderRadius;
  }

  const base = `skel ${circle ? '!rounded-full' : ''} ${inline ? 'inline-block align-bottom' : 'block'} ${className}`;

  const el = <div className={base} style={Object.keys(style).length > 0 ? style : undefined} aria-hidden="true" />;

  if (count > 1) {
    return (
      <div className={inline ? 'inline-flex gap-1.5' : 'space-y-1.5'}>
        {Array.from({ length: count }).map((_, i) => (
          <Fragment key={i}>{el}</Fragment>
        ))}
      </div>
    );
  }

  return el;
}
