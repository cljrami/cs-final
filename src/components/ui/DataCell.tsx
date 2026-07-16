// src/components/ui/DataCell.tsx
import React from 'react';

interface DataCellProps {
  value: React.ReactNode;
  loading?: boolean;
  width?: number | string;
  height?: number;
  className?: string;
}

export default function DataCell({ value, loading = false, width, height, className = '' }: DataCellProps) {
  if (loading) {
    return (
      <div
        className={`animate-pulse bg-gray-800 rounded-lg ${className}`}
        style={{
          width: typeof width === 'number' ? `${width}px` : width,
          height: height ? `${height}px` : 'auto',
          minHeight: height ? `${height}px` : '1.5rem'
        }}
      />
    );
  }

  return <>{value}</>;
}