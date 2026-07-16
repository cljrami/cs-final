// src/components/ui/SkeletonWrapper.tsx
import React from 'react';
import Skeleton from 'react-loading-skeleton';

export type SkeletonVariant = 
  | 'text'
  | 'title'
  | 'badge'
  | 'price'
  | 'number'
  | 'toggle'
  | 'avatar'
  | 'image'
  | 'paragraph'
  | 'custom';

interface VariantConfig {
  width: number | string;
  height: number;
  circle?: boolean;
  count?: number;
}

const VARIANTS: Record<SkeletonVariant, VariantConfig> = {
  text:     { width: 120, height: 16 },
  title:    { width: 150, height: 20 },
  badge:    { width: 60,  height: 20 },
  price:    { width: 80,  height: 16 },
  number:   { width: 40,  height: 16 },
  toggle:   { width: 44,  height: 24 },
  avatar:   { width: 40,  height: 40, circle: true },
  image:    { width: 80,  height: 60 },
  paragraph: { width: '100%', height: 14, count: 2 },
  custom:   { width: 100, height: 20 },
};

interface SkeletonWrapperProps {
  loading: boolean;
  variant?: SkeletonVariant;
  width?: number | string;
  height?: number;
  circle?: boolean;
  count?: number;
  className?: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function SkeletonWrapper({
  loading,
  variant = 'text',
  width,
  height,
  circle,
  count,
  className = '',
  children,
  fallback,
}: SkeletonWrapperProps) {
  
  if (loading) {
    const config = VARIANTS[variant];
    
    return (
      <span className={`inline-block ${className}`}>
        <Skeleton
          width={width || config.width}
          height={height || config.height}
          circle={circle || config.circle || false}
          count={count || config.count || 1}
        />
      </span>
    );
  }

  if (!children && fallback) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

export function SkText(props: Omit<SkeletonWrapperProps, 'variant'>) {
  return <SkeletonWrapper {...props} variant="text" />;
}

export function SkTitle(props: Omit<SkeletonWrapperProps, 'variant'>) {
  return <SkeletonWrapper {...props} variant="title" />;
}

export function SkPrice(props: Omit<SkeletonWrapperProps, 'variant'>) {
  return <SkeletonWrapper {...props} variant="price" />;
}

export function SkNumber(props: Omit<SkeletonWrapperProps, 'variant'>) {
  return <SkeletonWrapper {...props} variant="number" />;
}

export function SkBadge(props: Omit<SkeletonWrapperProps, 'variant'>) {
  return <SkeletonWrapper {...props} variant="badge" />;
}

export function SkToggle(props: Omit<SkeletonWrapperProps, 'variant'>) {
  return <SkeletonWrapper {...props} variant="toggle" />;
}

export function SkAvatar(props: Omit<SkeletonWrapperProps, 'variant'>) {
  return <SkeletonWrapper {...props} variant="avatar" />;
}

export function SkParagraph(props: Omit<SkeletonWrapperProps, 'variant'>) {
  return <SkeletonWrapper {...props} variant="paragraph" />;
}

interface SkeletonTableProps {
  columns: number;
  rows?: number;
  className?: string;
}

export function SkeletonTable({ columns, rows = 5, className = '' }: SkeletonTableProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={`sk-row-${rowIndex}`} className={`border-b border-[#2a2a3e] last:border-0 ${className}`}>
          {Array.from({ length: columns }).map((_, colIndex) => (
            <td key={`sk-col-${colIndex}`} className="px-4 py-3">
              <Skeleton 
                width={colIndex === 0 ? 30 : colIndex === columns - 1 ? 70 : 100} 
                height={16} 
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}