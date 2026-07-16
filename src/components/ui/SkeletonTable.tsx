// src/components/ui/SkeletonTable.tsx
import React from 'react';
import Skeleton from 'react-loading-skeleton';

interface SkeletonTableProps {
  columns: number;           // Cantidad de columnas
  rows?: number;             // Cantidad de filas (default: 5)
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

// Versión para celdas individuales con contenido mixto
interface SkeletonTableRowProps {
  loading: boolean;
  children: React.ReactNode;
  className?: string;
}

export function SkeletonTableRow({ loading, children, className = '' }: SkeletonTableRowProps) {
  if (loading) {
    return (
      <tr className={`border-b border-[#2a2a3e] last:border-0 ${className}`}>
        <td colSpan={100} className="px-4 py-3">
          <Skeleton width="100%" height={40} />
        </td>
      </tr>
    );
  }
  return <>{children}</>;
}