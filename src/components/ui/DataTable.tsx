import type React from 'react';
import DataCell from './DataCell';
import ActionMenu from './ActionMenu';
import type { ActionItem } from './ActionMenu';

export type { ActionItem };

export interface Column<T> {
  key: string;
  header: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  render: (row: T, loading: boolean) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading: boolean;
  skeletonRows?: number;
  emptyMessage?: string;
  emptyIcon?: string;
  getRowKey: (row: T) => string | number;
  getActions?: (row: T) => ActionItem[];
  onSelectionChange?: (selected: Set<string | number>) => void;
  selected?: Set<string | number>;
  selectable?: boolean;
}

export default function DataTable<T>({
  columns,
  data,
  loading,
  skeletonRows = 5,
  emptyMessage = 'No hay datos para mostrar',
  emptyIcon = 'fa-inbox',
  getRowKey,
  getActions,
  onSelectionChange,
  selected = new Set(),
  selectable = false,
}: DataTableProps<T>) {
  const minWidth = columns.reduce((sum, c) => sum + (parseInt(c.width || '150')), 0);

  const allSelected = selectable && data.length > 0 && data.every(row => selected.has(getRowKey(row)));
  const someSelected = selectable && data.some(row => selected.has(getRowKey(row)));

  const handleSelectAll = () => {
    if (!onSelectionChange) return;
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      const newSelected = new Set(selected);
      data.forEach(row => newSelected.add(getRowKey(row)));
      onSelectionChange(newSelected);
    }
  };

  const handleSelectRow = (rowKey: string | number) => {
    if (!onSelectionChange) return;
    const newSelected = new Set(selected);
    if (newSelected.has(rowKey)) {
      newSelected.delete(rowKey);
    } else {
      newSelected.add(rowKey);
    }
    onSelectionChange(newSelected);
  };

  if (loading) {
    return (
      <div className="bg-admin-card border border-admin-border rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse" style={{ minWidth }}>
            <thead>
              <tr className="border-b border-admin-border">
                {selectable && (
                  <th className="p-4 text-center" style={{ width: '40px' }}>
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={handleSelectAll}
                      className="w-4 h-4 text-blue-600 border-admin-border rounded focus:ring-blue-500 focus:ring-2"
                      aria-label="Seleccionar todo"
                    />
                  </th>
                )}
                {columns.map((c) => (
                  <th
                    key={c.key}
                    className={`p-4 text-xs text-admin-muted uppercase tracking-wider ${
                      c.align === 'right' ? 'text-right' : 'text-left'
                    }`}
                    style={{ width: c.width }}
                  >
                    {c.header}
                  </th>
                ))}
                {getActions && <th className="p-4 text-right text-xs text-admin-muted uppercase tracking-wider">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: skeletonRows }).map((_, i) => (
                <tr key={i} className="border-b border-admin-border">
                  {selectable && <td className="p-4 text-center"><div className="w-4 h-4 bg-admin-border rounded mx-auto" /></td>}
                  {columns.map((c) => (
                    <td key={c.key} className="p-4">
                      <DataCell value="" loading={true} className="w-full h-4" />
                    </td>
                  ))}
                  {getActions && (
                    <td className="p-4 text-right">
                      <DataCell value="" loading={true} className="w-8 h-8 rounded-md ml-auto" />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-admin-card border border-admin-border rounded-2xl p-12 text-center text-admin-muted">
        <i className={`fas ${emptyIcon} text-4xl mb-4 block opacity-30`} />
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="bg-admin-card border border-admin-border rounded-2xl">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse" style={{ minWidth }}>
          <thead>
            <tr className="border-b border-admin-border">
              {selectable && (
                <th className="p-4 text-center" style={{ width: '40px' }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={handleSelectAll}
                    className="w-4 h-4 text-blue-600 border-admin-border rounded focus:ring-blue-500 focus:ring-2"
                    aria-label={allSelected ? 'Deseleccionar todo' : 'Seleccionar todo'}
                    indeterminate={someSelected && !allSelected}
                  />
                </th>
              )}
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={`p-4 text-xs text-admin-muted uppercase tracking-wider ${
                    c.align === 'right' ? 'text-right' : 'text-left'
                  }`}
                  style={{ width: c.width }}
                >
                  {c.header}
                </th>
              ))}
              {getActions && <th className="p-4 text-right text-xs text-admin-muted uppercase tracking-wider">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => {
              const rowKey = getRowKey(row);
              const isSelected = selected.has(rowKey);
              return (
                <tr
                  key={rowKey}
                  className={`border-b border-admin-border transition-colors ${isSelected ? 'bg-blue-500/10' : 'hover:bg-[#252538]'} ${selectable ? 'cursor-pointer' : ''}`}
                  onClick={selectable ? (e) => {
                    if ((e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).tagName !== 'BUTTON' && !(e.target as HTMLElement).closest('button') && !(e.target as HTMLElement).closest('a')) {
                      handleSelectRow(rowKey);
                    }
                  } : undefined}
                >
                  {selectable && (
                    <td className="p-4 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleSelectRow(rowKey)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 text-blue-600 border-admin-border rounded focus:ring-blue-500 focus:ring-2"
                      />
                    </td>
                  )}
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={`p-4 ${c.align === 'right' ? 'text-right' : 'text-left'}`}
                    >
                      {c.render(row, false)}
                    </td>
                  ))}
                  {getActions && (
                    <td className="p-4 text-right">
                      <ActionMenu actions={getActions(row)} />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}