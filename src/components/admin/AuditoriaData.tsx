import { useState, useEffect, useCallback } from 'react';
import DataTable from '../ui/DataTable';
import type { Column, ActionItem } from '../ui/DataTable';
import SearchFilters from './SearchFilters';
import StatCard from '../ui/StatCard';
import ConfirmModal from '../ui/ConfirmModal';

interface AuditoriaEntry {
  id: number;
  usuario_nombre: string;
  usuario_foto: string | null;
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

interface Stats {
  total: number; crear: number; editar: number; eliminar: number; aprobar: number; rechazar: number;
}

function parseDateTime(s: string): Date | null {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2}):(\d{2}))?/);
  if (!m) return null;
  const [, y, mo, d, hh, mm, ss] = m;
  return new Date(Date.UTC(+y, +mo - 1, +d, +(hh ?? 0), +(mm ?? 0), +(ss ?? 0)));
}

function formatDate(dateStr: string) {
  const d = parseDateTime(dateStr);
  if (!d) return dateStr;
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatTimeAgo(dateStr: string) {
  const date = parseDateTime(dateStr);
  if (!date) return formatDate(dateStr);
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return formatDate(dateStr);
  const seg = Math.floor(diffMs / 1000);
  if (seg < 60) return 'recién';
  const min = Math.floor(seg / 60);
  if (min < 60) return `hace ${min} ${min === 1 ? 'minuto' : 'minutos'}`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `hace ${hrs} ${hrs === 1 ? 'hora' : 'horas'}`;
  const dias = Math.floor(hrs / 24);
  if (dias < 7) return `hace ${dias} ${dias === 1 ? 'día' : 'días'}`;
  const semanas = Math.floor(dias / 7);
  if (semanas < 5) return `hace ${semanas} ${semanas === 1 ? 'semana' : 'semanas'}`;
  return formatDate(dateStr);
}

export default function AuditoriaData() {
  const [items, setItems] = useState<AuditoriaEntry[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, crear: 0, editar: 0, eliminar: 0, aprobar: 0, rechazar: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('todos');
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ accion: filter, search });
      const res = await fetch(`${API_URL}?${params}`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (data.success) {
        setItems(data.data);
        setStats(data.stats || { total: 0, crear: 0, editar: 0, eliminar: 0, aprobar: 0, rechazar: 0 });
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

  const handleEliminar = async (id: number) => {
    setDeleting(true);
    try {
      const res = await fetch(API_URL, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success) {
        setItems(prev => prev.filter(i => i.id !== id));
        setSuccessMsg('Registro eliminado');
        setTimeout(() => setSuccessMsg(''), 3000);
      } else {
        setError(data.error || 'Error al eliminar');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setDeleting(false);
      setDeleteConfirm(null);
    }
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
        <div className="text-admin-muted text-sm whitespace-nowrap" title={formatDate(item.creado_en)}>
          {formatTimeAgo(item.creado_en)}
        </div>
      ),
    },
    {
      key: 'usuario', header: 'Usuario', width: '200',
      render: (item) => (
        <div className="flex items-center gap-3">
          {item.usuario_foto ? (
            <img src={item.usuario_foto} alt=""
              className="w-9 h-9 rounded-full object-cover flex-shrink-0"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">
              {(item.usuario_nombre || '?').charAt(0).toUpperCase()}
            </div>
          )}
          <span className="text-white text-sm font-medium">{item.usuario_nombre}</span>
        </div>
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

  const getActions = (item: AuditoriaEntry): ActionItem[] => [
    { label: 'Eliminar', icon: 'fa-trash', onClick: () => setDeleteConfirm(item.id), danger: true },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <i className="fas fa-history text-yellow-400"></i> Auditoría
        </h1>
        <p className="text-gray-400 mt-1">Registro de acciones realizadas en el panel</p>
      </div>

      {successMsg && <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-lg flex items-center gap-2"><i className="fas fa-check-circle"></i>{successMsg}</div>}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2">
          <i className="fas fa-exclamation-triangle"></i>{error}
          <button onClick={fetchItems} className="ml-auto text-sm underline">Reintentar</button>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total" value={stats.total} icon="fa-list" color="#a78bfa" loading={isLoading} />
        <StatCard label="Crear" value={stats.crear} icon="fa-plus" color="#10b981" loading={isLoading} />
        <StatCard label="Editar" value={stats.editar} icon="fa-edit" color="#60a5fa" loading={isLoading} />
        <StatCard label="Eliminar" value={stats.eliminar} icon="fa-trash" color="#ef4444" loading={isLoading} />
      </div>

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
        getActions={getActions}
      />

      <ConfirmModal
        isOpen={deleteConfirm !== null}
        title="Eliminar registro"
        message="¿Estás seguro de eliminar este registro de auditoría? Esta acción no se puede deshacer."
        confirmText={deleting ? 'Eliminando...' : 'Eliminar'}
        cancelText="Cancelar"
        variant="danger"
        confirmDisabled={deleting}
        onConfirm={() => deleteConfirm && handleEliminar(deleteConfirm)}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}
