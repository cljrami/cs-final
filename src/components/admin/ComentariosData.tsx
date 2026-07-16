import { useState, useEffect, useCallback } from 'react';
import DataTable from '../ui/DataTable';
import type { Column, ActionItem } from '../ui/DataTable';

const API_URL = '/api/admin/comentarios.php';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('admin_token') || '';
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
}

export default function ComentariosData() {
  const [items, setItems] = useState<any[]>([]);
  const [stats, setStats] = useState({ pendientes: 0, aprobados: 0, total: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState('pendientes');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), search, estado, per_page: '20' });
      const res = await fetch(`${API_URL}?${params}`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error');
      setItems(data.comentarios || []);
      setStats(data.stats || { pendientes: 0, aprobados: 0, total: 0 });
      setTotalPages(data.pagination?.total_pages || 1);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [page, search, estado]);

  useEffect(() => { fetchItems(); }, [page, estado]);
  useEffect(() => { if (!search) fetchItems(); }, [search]);

  useEffect(() => {
    if (!search) return;
    const timer = setTimeout(() => { setPage(1); fetchItems(); }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const aprobarRechazar = async (id: number, accion: string) => {
    try {
      const res = await fetch(API_URL, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id, accion }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error');
      setSuccessMsg(accion === 'aprobar' ? 'Comentario aprobado' : 'Comentario rechazado');
      setTimeout(() => setSuccessMsg(''), 3000);
      window.dispatchEvent(new Event('counts-refresh'));
      fetchItems();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEliminar = async (id: number) => {
    try {
      const res = await fetch(API_URL, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error');
      setSuccessMsg('Comentario eliminado');
      setTimeout(() => setSuccessMsg(''), 3000);
      window.dispatchEvent(new Event('counts-refresh'));
      fetchItems();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const columns: Column<any>[] = [
    {
      key: 'comentario', header: 'Comentario', width: '300',
      render: (item) => (
        <div>
          <div className="text-sm text-white line-clamp-2">{item.comentario}</div>
          <div className="text-xs text-gray-500 mt-1">
            por <span className="text-gray-400">{item.usuario}</span>
            {' — '}
            <a href={`/${item.escort_id}`} target="_blank" className="text-red-400 hover:underline">{item.escort}</a>
          </div>
        </div>
      ),
    },
    {
      key: 'puntuacion', header: 'Punt.', width: '60', align: 'center',
      render: (item) => item.puntuacion ? (
        <div className="flex items-center justify-center gap-0.5">
          {Array.from({ length: item.puntuacion }).map((_, i) => (
            <i key={i} className="fas fa-star text-yellow-400 text-[10px]"></i>
          ))}
        </div>
      ) : <span className="text-gray-600 text-xs">—</span>,
    },
    {
      key: 'aprobado', header: 'Estado', width: '100', align: 'center',
      render: (item) => (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
          item.aprobado
            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${item.aprobado ? 'bg-emerald-400' : 'bg-yellow-400'}`}></span>
          {item.aprobado ? 'Aprobado' : 'Pendiente'}
        </span>
      ),
    },
    {
      key: 'created_at', header: 'Fecha', width: '120',
      render: (item) => (
        <span className="text-sm text-gray-400">
          {item.created_at ? new Date(item.created_at).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
        </span>
      ),
    },
  ];

  const getActions = (item: any): ActionItem[] => {
    const actions: ActionItem[] = [];
    if (!item.aprobado) {
      actions.push({ label: 'Aprobar', icon: 'fa-check', onClick: () => aprobarRechazar(item.id, 'aprobar') });
    } else {
      actions.push({ label: 'Rechazar', icon: 'fa-times', onClick: () => aprobarRechazar(item.id, 'rechazar') });
    }
    actions.push({ label: 'Eliminar', icon: 'fa-trash-alt', danger: true, onClick: () => setConfirmDeleteId(item.id) });
    return actions;
  };

  const tabs = [
    { key: 'pendientes', label: 'Pendientes', icon: 'fa-clock', count: stats.pendientes },
    { key: 'aprobados', label: 'Aprobados', icon: 'fa-check', count: stats.aprobados },
    { key: 'todos', label: 'Todos', icon: 'fa-list', count: stats.total },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <i className="fas fa-comments text-red-400"></i> Comentarios
        </h1>
        <p className="text-gray-400 mt-1">Gestiona los comentarios de los usuarios en los perfiles</p>
      </div>

      {successMsg && <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-lg flex items-center gap-2"><i className="fas fa-check-circle"></i>{successMsg}</div>}
      {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2"><i className="fas fa-exclamation-triangle"></i>{error} <button onClick={() => setError('')} className="ml-auto"><i className="fas fa-times"></i></button></div>}

      {/* Filtros tabs */}
      <div className="flex gap-2 border-b border-admin-border pb-3">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setEstado(tab.key); setPage(1); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              estado === tab.key
                ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <i className={`fas ${tab.icon}`}></i>
            {tab.label}
            {tab.count > 0 && (
              <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar por comentario, usuario o escort..."
        className="w-full bg-[#252538] border border-[#2a2a3e] rounded-lg px-4 py-2 text-white text-sm outline-none focus:border-red-500/50 transition-colors placeholder-gray-600"
      />

      <DataTable
        columns={columns}
        data={items}
        loading={isLoading}
        skeletonRows={5}
        emptyMessage="No hay comentarios"
        emptyIcon="fa-comments"
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

      {/* Modal confirmar eliminación */}
      {confirmDeleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={() => setConfirmDeleteId(null)}>
          <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                  <i className="fas fa-question-circle text-yellow-400 text-lg"></i>
                </div>
                <p className="text-white text-sm leading-relaxed">¿Eliminar este comentario? Esta acción no se puede deshacer.</p>
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setConfirmDeleteId(null)}
                  className="px-4 py-2 bg-[#2a2a3e] hover:bg-[#353550] text-gray-300 rounded-lg text-sm font-medium transition-colors">
                  Cancelar
                </button>
                <button onClick={async () => {
                  await handleEliminar(confirmDeleteId);
                  setConfirmDeleteId(null);
                }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors">
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
