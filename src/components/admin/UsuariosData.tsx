import { useState, useEffect, useCallback } from 'react';
import DataTable from '../ui/DataTable';
import type { Column, ActionItem } from '../ui/DataTable';
import SearchFilters from './SearchFilters';

const API_URL = '/api/admin/usuarios.php';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('admin_token') || '';
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
}

export default function UsuariosData() {
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), search, per_page: '20' });
      const res = await fetch(`${API_URL}?${params}`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error');
      setItems(data.usuarios || []);
      setTotal(data.pagination?.total || 0);
      setTotalPages(data.pagination?.total_pages || 1);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [page, search]);

  useEffect(() => { fetchItems(); }, [page]);
  useEffect(() => { if (!search) fetchItems(); }, [search]);

  useEffect(() => {
    if (!search) return;
    const timer = setTimeout(() => { setPage(1); fetchItems(); }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const toggleActivo = async (id: number, activo: boolean) => {
    try {
      const res = await fetch(API_URL, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id, accion: activo ? 'desactivar' : 'activar' }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error');
      setSuccessMsg(activo ? 'Usuario desactivado' : 'Usuario activado');
      setTimeout(() => setSuccessMsg(''), 3000);
      fetchItems();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const eliminar = async (id: number, nombre: string) => {
    if (!confirm(`¿Eliminar usuario "${nombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      const res = await fetch(API_URL, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error');
      setSuccessMsg('Usuario eliminado');
      setTimeout(() => setSuccessMsg(''), 3000);
      fetchItems();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const columns: Column<any>[] = [
    {
      key: 'nombre', header: 'Nombre', width: '200',
      render: (item) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center text-red-400 text-xs font-bold">
            {item.nombre?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div>
            <div className="font-medium text-sm text-white">{item.nombre}</div>
            <div className="text-xs text-gray-500">{item.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'activo', header: 'Estado', width: '100', align: 'center',
      render: (item) => (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${item.activo ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${item.activo ? 'bg-emerald-400' : 'bg-gray-400'}`}></span>
          {item.activo ? 'Activo' : 'Inactivo'}
        </span>
      ),
    },
    {
      key: 'created_at', header: 'Registro', width: '120',
      render: (item) => (
        <span className="text-sm text-gray-400">{item.created_at ? new Date(item.created_at).toLocaleDateString('es-CL') : '—'}</span>
      ),
    },
  ];

  const getActions = (item: any): ActionItem[] => [
    {
      label: item.activo ? 'Desactivar' : 'Activar',
      icon: item.activo ? 'fa-pause' : 'fa-play',
      onClick: () => toggleActivo(item.id, item.activo),
    },
    {
      label: 'Eliminar',
      icon: 'fa-trash-alt',
      danger: true,
      onClick: () => eliminar(item.id, item.nombre),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <i className="fas fa-user text-red-400"></i> Usuarios
        </h1>
        <p className="text-gray-400 mt-1">Gestiona los usuarios registrados en el sitio</p>
      </div>

      <div className="flex items-center gap-3 text-sm">
        <span className="text-gray-500">Total:</span>
        <span className="text-white font-semibold">{total}</span>
      </div>

      {successMsg && <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-lg flex items-center gap-2"><i className="fas fa-check-circle"></i>{successMsg}</div>}
      {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2"><i className="fas fa-exclamation-triangle"></i>{error} <button onClick={() => setError('')} className="ml-auto"><i className="fas fa-times"></i></button></div>}

      <div className="flex gap-4">
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre o email..." className="flex-1 bg-[#252538] border border-[#2a2a3e] rounded-lg px-4 py-2 text-white text-sm outline-none focus:border-red-500/50 transition-colors placeholder-gray-600" />
      </div>

      <DataTable
        columns={columns}
        data={items}
        loading={isLoading}
        skeletonRows={5}
        emptyMessage="No hay usuarios registrados"
        emptyIcon="fa-user"
        getRowKey={(item) => item.id}
        getActions={getActions}
      />

      {totalPages > 1 && !isLoading && (
        <div className="flex items-center justify-between px-4 py-3 bg-admin-card border border-admin-border rounded-xl">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed text-sm flex items-center gap-1">
            <i className="fas fa-chevron-left"></i> Anterior
          </button>
          <span className="text-gray-500 text-sm">Página {page} de {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed text-sm flex items-center gap-1">
            Siguiente <i className="fas fa-chevron-right"></i>
          </button>
        </div>
      )}
    </div>
  );
}
