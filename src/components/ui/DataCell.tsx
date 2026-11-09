// src/components/ui/DataCell.tsx
import React from 'react';
import { Skeleton } from './Skeleton';

interface DataCellProps {
  value: React.ReactNode;
  loading?: boolean;
  width?: number | string;
  height?: number;
  className?: string;
}

export default function DataCell({ value, loading = false, width, height = 16, className = '' }: DataCellProps) {
  if (loading) {
    return (
      <Skeleton
        width={width}
        height={height}
        borderRadius="0.375rem"
        className={className}
      />
    );
  }

  return <>{value}</>;
}