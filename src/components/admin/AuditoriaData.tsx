import { useState, useEffect, useCallback } from 'react';
import DataTable from '../ui/DataTable';
import type { Column } from '../ui/DataTable';
import SearchFilters from './SearchFilters';

interface AuditoriaEntry {
  id: number;
  usuario_nombre: string;
  accion: string;
  entidad: string;
  entidad_id: number | null;
  detalle: string | null;
  creado_en: string;
}

const API_URL = '/api/admin/auditoria.php';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('admin_token') || '';
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
}

export default function AuditoriaData() {
  const [items, setItems] = useState<AuditoriaEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('todos');

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ accion: filter, search });
      const res = await fetch(`${API_URL}?${params}`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (data.success) {
        setItems(data.data);
      } else {
        setError(data.error || 'Error al cargar');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setIsLoading(false);
    }
  }, [filter, search]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  useEffect(() => {
    if (!search && filter === 'todos') return;
    const timer = setTimeout(() => fetchItems(), 300);
    return () => clearTimeout(timer);
  }, [search, filter, fetchItems]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getAccionBadge = (accion: string) => {
    const config: Record<string, { bg: string; text: string; icon: string }> = {
      crear: { bg: '#1a3d2e', text: '#10b981', icon: 'fa-plus' },
      editar: { bg: '#1a2a3d', text: '#60a5fa', icon: 'fa-edit' },
      eliminar: { bg: '#3d1a1a', text: '#ef4444', icon: 'fa-trash' },
      aprobar: { bg: '#1a3d2e', text: '#22c55e', icon: 'fa-check' },
      rechazar: { bg: '#3d1a1a', text: '#f87171', icon: 'fa-times' },
    };
    const c = config[accion] || { bg: '#2a2a3e', text: '#9ca3af', icon: 'fa-circle' };
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap"
        style={{ backgroundColor: c.bg, color: c.text }}>
        <i className={`fas ${c.icon} text-[10px]`}></i>
        {accion.charAt(0).toUpperCase() + accion.slice(1)}
      </span>
    );
  };

  const columns: Column<AuditoriaEntry>[] = [
    {
      key: 'creado_en', header: 'Fecha', width: '140',
      render: (item) => (
        <span className="text-admin-muted text-sm">{formatDate(item.creado_en)}</span>
      ),
    },
    {
      key: 'usuario', header: 'Usuario', width: '140',
      render: (item) => (
        <span className="text-white text-sm font-medium">{item.usuario_nombre}</span>
      ),
    },
    {
      key: 'accion', header: 'Acción', width: '110',
      render: (item) => getAccionBadge(item.accion),
    },
    {
      key: 'entidad', header: 'Entidad', width: '140',
      render: (item) => (
        <div>
          <span className="text-gray-300 text-sm capitalize">{item.entidad}</span>
          {item.entidad_id && <span className="text-gray-500 text-xs ml-1">#{item.entidad_id}</span>}
        </div>
      ),
    },
    {
      key: 'detalle', header: 'Detalle', width: '300',
      render: (item) => (
        <span className="text-gray-400 text-sm">{item.detalle || '—'}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <i className="fas fa-history text-yellow-400"></i> Auditoría
        </h1>
        <p className="text-gray-400 mt-1">Registro de acciones realizadas en el panel</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2">
          <i className="fas fa-exclamation-triangle"></i>{error}
          <button onClick={fetchItems} className="ml-auto text-sm underline">Reintentar</button>
        </div>
      )}

      <SearchFilters
        search={search}
        onSearch={setSearch}
        placeholder="Buscar por usuario, entidad o detalle..."
        filters={[
          { key: 'todos', label: 'Todas', icon: 'fa-list' },
          { key: 'crear', label: 'Crear', icon: 'fa-plus' },
          { key: 'editar', label: 'Editar', icon: 'fa-edit' },
          { key: 'eliminar', label: 'Eliminar', icon: 'fa-trash' },
          { key: 'aprobar', label: 'Aprobar', icon: 'fa-check' },
          { key: 'rechazar', label: 'Rechazar', icon: 'fa-times' },
        ]}
        activeFilter={filter}
        onFilterChange={setFilter}
      />

      <DataTable
        columns={columns}
        data={items}
        loading={isLoading}
        skeletonRows={5}
        emptyMessage={search ? 'No se encontraron registros' : 'No hay registros de auditoría'}
        emptyIcon="fa-history"
        getRowKey={(item) => item.id}
      />
    </div>
  );
}
