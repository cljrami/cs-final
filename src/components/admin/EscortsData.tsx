import { useState, useEffect, useCallback } from 'react';
import StatCard from '../ui/StatCard';
import DataTable from '../ui/DataTable';
import type { Column, ActionItem } from '../ui/DataTable';
import ConfirmModal from '../ui/ConfirmModal';
import SearchFilters from './SearchFilters';

interface Stats {
  total: number;
  pendientes: number;
  aprobadas: number;
  rechazadas: number;
  planes_por_activar: number;
  papelera: number;
}

interface Escort {
  id: number;
  nombre: string;
  edad: number;
  ciudad: string;
  estado: string;
  verificado: number;
  vip: number;
  activa: number;
  created_at: string;
  slug?: string;
}

const API_URL = '/api/admin/escorts.php';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('admin_token') || '';
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
}

const estadoConfig: Record<number, { bg: string; text: string; icon: string; label: string }> = {
  0: { bg: '#3d3d1a', text: '#fbbf24', icon: 'fa-clock', label: 'Pendiente' },
  1: { bg: '#1a3d2e', text: '#10b981', icon: 'fa-check-circle', label: 'Aprobada' },
  [-1]: { bg: '#3d1a1a', text: '#ef4444', icon: 'fa-times-circle', label: 'Rechazada' },
};

export default function EscortsData() {
  const [items, setItems] = useState<Escort[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, pendientes: 0, aprobadas: 0, rechazadas: 0, planes_por_activar: 0, papelera: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [filter, setFilter] = useState('todos');
  const [search, setSearch] = useState('');

  const [deleteConfirm, setDeleteConfirm] = useState<Escort | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const showNotification = (msg: string) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 3000); };

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ estado: filter, search });
      const res = await fetch(`${API_URL}?${params}`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error al cargar');
      setItems(data.escorts || []);
      setStats(data.stats || { total: 0, pendientes: 0, aprobadas: 0, rechazadas: 0, planes_por_activar: 0, papelera: 0 });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [filter, search]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  useEffect(() => {
    if (!search && filter === 'todos') return;
    const timer = setTimeout(() => fetchItems(), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const callApi = async (endpoint: string, body: object, optimisticUpdate: (items: Escort[]) => Escort[], successMsg?: string) => {
    setActionLoading(body.id as number);
    setError('');

    setItems(prev => optimisticUpdate(prev));

    try {
      const res = await fetch(`/api/admin/${endpoint}`, {
        method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        if (successMsg) showNotification(successMsg);
        fetchItems();
        window.dispatchEvent(new Event('counts-refresh'));
      } else {
        setError(data.error || 'Error del servidor');
        fetchItems();
      }
    } catch {
      setError('Error de conexión');
      fetchItems();
    } finally {
      setActionLoading(null);
    }
  };

  const handleApprove = (item: Escort) =>
    callApi('escort-aprobar', { id: item.id }, (prev) =>
      prev.map(e => e.id === item.id ? { ...e, activa: 1 } : e),
      'Escort aprobada correctamente'
    );

  const handleReject = (item: Escort) =>
    callApi('escort-rechazar', { id: item.id }, (prev) =>
      prev.map(e => e.id === item.id ? { ...e, activa: -1 } : e),
      'Escort rechazada correctamente'
    );

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/admin/escort-eliminar', {
        method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ id: deleteConfirm.id }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error al eliminar');
      showNotification('Escort eliminada correctamente');
      setDeleteConfirm(null);
      fetchItems();
      window.dispatchEvent(new Event('counts-refresh'));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const getActions = (item: Escort): ActionItem[] => [
    ...(item.activa === 0 || item.activa === -1 ? [
      { label: 'Aprobar', icon: 'fa-check', onClick: () => handleApprove(item) },
    ] : []),
    ...(item.activa === 0 || item.activa === 1 ? [
      { label: 'Rechazar', icon: 'fa-times', danger: true, onClick: () => handleReject(item) },
    ] : []),
    {
      label: 'Editar', icon: 'fa-edit', onClick: () => { window.location.href = `/admin/escorts/editar/${item.id}`; },
    },
    {
      label: 'Eliminar', icon: 'fa-trash-alt', danger: true, onClick: () => setDeleteConfirm(item),
    },
    {
      label: 'Ver perfil', icon: 'fa-eye', onClick: () => { window.open(`/${item.slug || item.id}`, '_blank'); },
    },
  ].filter(Boolean) as ActionItem[];

  const columns: Column<Escort>[] = [
    {
      key: 'nombre', header: 'Escort', width: '220',
      render: (item: Escort) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 min-w-[40px] bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-lg flex items-center justify-center">
            <i className="fas fa-user text-black"></i>
          </div>
          <div className="min-w-0">
            <div className="font-medium whitespace-nowrap text-sm">{item.nombre}</div>
            <div className="text-xs text-admin-muted">{item.ciudad}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'edad', header: 'Edad', width: '80',
      render: (item: Escort) => (
        <span className="text-admin-muted text-sm">{item.edad} años</span>
      ),
    },
    {
      key: 'activa', header: 'Estado', width: '120', align: 'center',
      render: (item: Escort) => {
        const estado = estadoConfig[item.activa] || estadoConfig[0];
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap"
            style={{ backgroundColor: estado.bg, color: estado.text }}>
            <i className={`fas ${estado.icon} text-[0.6rem]`}></i>
            {estado.label}
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <i className="fas fa-user-shield text-yellow-400"></i> Gestión de Escorts
        </h1>
        <p className="text-gray-400 mt-1">Administra y aprueba perfiles de escorts</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Pendientes" value={stats.pendientes} icon="fa-clock" color="#fbbf24" loading={isLoading} />
        <StatCard label="Aprobadas" value={stats.aprobadas} icon="fa-check-circle" color="#10b981" loading={isLoading} />
        <StatCard label="Rechazadas" value={stats.rechazadas} icon="fa-times-circle" color="#ef4444" loading={isLoading} />
      </div>

      {successMsg && <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-lg flex items-center gap-2"><i className="fas fa-check-circle"></i>{successMsg}</div>}
      {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2"><i className="fas fa-exclamation-triangle"></i>{error} <button onClick={() => setError('')} className="ml-auto text-red-400/60 hover:text-red-400"><i className="fas fa-times"></i></button></div>}

      <SearchFilters
        search={search}
        onSearch={setSearch}
        placeholder="Buscar por nombre o ciudad..."
        filters={[
          { key: 'todos', label: 'Todos', icon: 'fa-list' },
          { key: 'pendientes', label: 'Pendientes', icon: 'fa-clock' },
          { key: 'aprobadas', label: 'Aprobadas', icon: 'fa-check' },
          { key: 'rechazadas', label: 'Rechazadas', icon: 'fa-times' },
        ]}
        activeFilter={filter}
        onFilterChange={setFilter}
      />

      <DataTable
        columns={columns}
        data={items}
        loading={isLoading}
        skeletonRows={5}
        emptyMessage={search ? 'No se encontraron escorts' : 'No hay escorts registradas'}
        emptyIcon="fa-user-slash"
        getRowKey={(item) => item.id}
        getActions={getActions}
      />

      <ConfirmModal
        isOpen={deleteConfirm !== null}
        title="¿Eliminar escort?"
        message={`Estás a punto de eliminar <strong>${deleteConfirm?.nombre || ''}</strong>. Esta acción no se puede deshacer.`}
        confirmText={deleting ? 'Eliminando...' : 'Eliminar'}
        cancelText="Cancelar"
        variant="danger"
        confirmDisabled={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}
