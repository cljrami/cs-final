// src/components/admin/EscortsGira.tsx
import { useState, useEffect, useRef } from 'react';
import StatCard from '../ui/StatCard';
import DataTable from '../ui/DataTable';
import type { Column, ActionItem } from '../ui/DataTable';
import ConfirmModal from '../ui/ConfirmModal';
import SearchFilters from './SearchFilters';

interface EscortGira {
  id: number;
  nombre: string;
  slug?: string;
  email: string;
  edad: number;
  foto_principal: string | null;
  ciudad_base: string | null;
  gira_ciudad: string | null;
  en_gira: number;
  gira_fecha_inicio: string | null;
  gira_fecha_fin: string | null;
  gira_dias_restantes: number | null;
  gira_activa: boolean;
  activa: number;
  vip: number;
  verificado: number;
  destacado: number;
  rating: number | null;
  total_valoraciones: number;
  suscripcion_estado: string;
  created_at: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasMore: boolean;
}

interface Stats {
  total: number;
  vigentes: number;
  vencidas: number;
  vip_en_gira: number;
}

const API_URL = '/api/admin/escorts-gira.php';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('admin_token') || '';
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
}

const planEstadoConfig: Record<string, { bg: string; text: string; icon: string; label: string }> = {
  aprobada: { bg: '#1a3d2e', text: '#10b981', icon: 'fa-check-circle', label: 'Aprobada' },
  pausada: { bg: '#1a2d3d', text: '#3b82f6', icon: 'fa-pause-circle', label: 'Pausada' },
  expirada: { bg: '#3d2410', text: '#f97316', icon: 'fa-hourglass-end', label: 'Expirada' },
  rechazada: { bg: '#2a1a1a', text: '#ef4444', icon: 'fa-times-circle', label: 'Rechazada' },
  pendiente: { bg: '#3d3d1a', text: '#fbbf24', icon: 'fa-clock', label: 'Pendiente' },
  sin_plan: { bg: '#1a1a2e', text: '#6b7280', icon: 'fa-minus-circle', label: 'Sin plan' },
};

export default function EscortsGira() {
  const [escorts, setEscorts] = useState<EscortGira[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, vigentes: 0, vencidas: 0, vip_en_gira: 0 });
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, pages: 1, hasMore: false });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [filter, setFilter] = useState('todos');
  const [search, setSearch] = useState('');
  const [endConfirm, setEndConfirm] = useState<EscortGira | null>(null);
  const [ending, setEnding] = useState(false);

  const paramsRef = useRef({ filter: 'todos', search: '', page: 1, limit: 50 });

  const showNotification = (msg: string) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 3000); };

  const fetchItems = async (f: string, s: string, p: number, l: number) => {
    setIsLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams({
        estado: f,
        search: s,
        page: p.toString(),
        limit: l.toString()
      });
      const res = await fetch(`${API_URL}?${qs}`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error al cargar');
      setEscorts(data.escorts || []);

      // Calcular stats localmente
      const allEscorts = data.escorts || [];
      const statsCalc = {
        total: allEscorts.filter((e: EscortGira) => e.en_gira === 1).length,
        vigentes: allEscorts.filter((e: EscortGira) => e.gira_activa).length,
        vencidas: allEscorts.filter((e: EscortGira) => !e.gira_activa).length,
        vip_en_gira: allEscorts.filter((e: EscortGira) => e.vip === 1).length,
      };
      setStats(statsCalc);

      if (data.pagination) {
        setPagination(data.pagination);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    paramsRef.current = { filter, search, page: pagination.page, limit: pagination.limit };
    fetchItems(filter, search, pagination.page, pagination.limit);
  }, [filter, pagination.page, pagination.limit]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPagination(prev => {
        if (prev.page !== 1) return { ...prev, page: 1 };
        fetchItems(filter, search, 1, prev.limit);
        return prev;
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  const refetch = () => {
    const p = paramsRef.current;
    fetchItems(p.filter, p.search, p.page, p.limit);
  };

  const handleEndGira = async () => {
    if (!endConfirm) return;
    setEnding(true);
    setError('');
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ action: 'end', id: endConfirm.id }),
      });
      const data = await res.json();
      if (data.success) {
        showNotification('Gira finalizada correctamente');
        setEndConfirm(null);
        refetch();
        window.dispatchEvent(new Event('counts-refresh'));
      } else {
        setError(data.error || 'Error al finalizar gira');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setEnding(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-CL', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const getDiasBadge = (escort: EscortGira) => {
    if (escort.gira_dias_restantes === null) return null;
    const isExpired = !escort.gira_activa;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[0.65rem] font-medium ${
        isExpired
          ? 'bg-red-500/15 text-red-400'
          : escort.gira_dias_restantes <= 3
            ? 'bg-amber-500/15 text-amber-400'
            : 'bg-emerald-500/15 text-emerald-400'
      }`}>
        <i className={`fas fa-clock text-[0.5rem]`}></i>
        {escort.gira_dias_restantes === 0 ? 'Último día' : escort.gira_dias_restantes > 0 ? `${escort.gira_dias_restantes} días` : `Vencida (${Math.abs(escort.gira_dias_restantes)}d)`}
      </span>
    );
  };

  const columns: Column<EscortGira>[] = [
    {
      key: 'id', header: 'ID', align: 'center',
      render: (item: EscortGira) => (
        <span className="text-gray-400 text-sm font-mono">#{item.id}</span>
      ),
    },
    {
      key: 'nombre', header: 'Escort',
      render: (item: EscortGira) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 min-w-[40px] rounded-lg overflow-hidden bg-[#2a2a3e] shrink-0">
            {item.foto_principal ? (
              <img src={item.foto_principal} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center"><i className="fas fa-user text-gray-600"></i></div>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-white font-medium text-sm">{item.nombre}</span>
              {item.verificado === 1 && <i className="fas fa-check-circle text-blue-400 text-xs" title="Verificada" />}
              {item.destacado === 1 && <i className="fas fa-fire text-red-400 text-xs" title="Destacada" />}
            </div>
            <div className="text-xs text-admin-muted">{item.email}</div>
            <div className="text-xs text-admin-muted">{item.edad} años</div>
          </div>
        </div>
      ),
    },
    {
      key: 'gira_ciudad', header: 'Ciudad destino',
      render: (item: EscortGira) => (
        <div className="flex items-center gap-2">
          <i className={`fas fa-route ${item.gira_activa ? 'text-emerald-400' : 'text-red-400'}`}></i>
          <span className={item.gira_activa ? 'text-emerald-400' : 'text-red-400'}>{item.gira_ciudad || '—'}</span>
        </div>
      ),
    },
    {
      key: 'ciudad_base', header: 'Ciudad base',
      render: (item: EscortGira) => (
        <span className="text-gray-400 text-sm">{item.ciudad_base || '—'}</span>
      ),
    },
    {
      key: 'fechas', header: 'Fechas gira',
      render: (item: EscortGira) => (
        <div className="flex flex-col gap-1">
          <span className="text-sm text-white">{formatDate(item.gira_fecha_inicio)} → {formatDate(item.gira_fecha_fin)}</span>
          {getDiasBadge(item)}
        </div>
      ),
    },
    {
      key: 'estado', header: 'Estado',
      render: (item: EscortGira) => {
        const c = planEstadoConfig[item.suscripcion_estado] || planEstadoConfig.sin_plan;
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap"
            style={{ backgroundColor: c.bg, color: c.text }}>
            <i className={`fas ${c.icon} text-[0.6rem]`}></i>
            {c.label}
          </span>
        );
      },
    },
    {
      key: 'rating', header: 'Rating',
      render: (item: EscortGira) => {
        const r = item.rating != null ? Number(item.rating) : null;
        return r !== null && !isNaN(r) ? (
          <div className="flex items-center gap-1">
            <i className="fas fa-star text-yellow-400 text-xs"></i>
            <span className="text-white text-sm font-medium">{r.toFixed(1)}</span>
            <span className="text-gray-500 text-xs">({item.total_valoraciones || 0})</span>
          </div>
        ) : (
          <span className="text-gray-600 text-sm">—</span>
        );
      },
    },
  ];

  const getActions = (item: EscortGira): ActionItem[] => {
    return [
      { label: 'Ver perfil', icon: 'fa-eye', onClick: () => { window.open(`/${item.slug || item.id}`, '_blank'); } },
      {
        label: 'Finalizar gira',
        icon: 'fa-bus',
        danger: true,
        onClick: () => setEndConfirm(item),
      },
    ];
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > pagination.pages) return;
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const statCards = [
    { label: 'Total en gira', value: stats.total, icon: 'fa-route', color: '#8b5cf6' },
    { label: 'Vigentes', value: stats.vigentes, icon: 'fa-check-circle', color: '#22c55e' },
    { label: 'Vencidas', value: stats.vencidas, icon: 'fa-hourglass-end', color: '#f97316' },
    { label: 'VIP en gira', value: stats.vip_en_gira, icon: 'fa-crown', color: '#fbbf24' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <i className="fas fa-route text-purple-400"></i> Escorts en Gira
          </h1>
          <p className="text-gray-400 mt-1">Escorts que actualmente están visitando otra ciudad (gira activa o vencida)</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statCards.map(s => (
          <StatCard key={s.label} label={s.label} value={s.value} icon={s.icon} color={s.color} loading={isLoading} />
        ))}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl flex items-center gap-2">
          <i className="fas fa-exclamation-triangle"></i>
          {error}
          <button onClick={() => setError('')} className="ml-auto text-red-400/60 hover:text-red-400"><i className="fas fa-times"></i></button>
        </div>
      )}

      {successMsg && (
        <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-xl flex items-center gap-2">
          <i className="fas fa-check-circle"></i>
          {successMsg}
        </div>
      )}

      <SearchFilters
        search={search}
        onSearch={setSearch}
        placeholder="Buscar por nombre, email o ciudad..."
        filters={[
          { key: 'todos', label: 'Todas', icon: 'fa-list' },
          { key: 'vigentes', label: 'Vigentes', icon: 'fa-check-circle' },
          { key: 'vencidas', label: 'Vencidas', icon: 'fa-hourglass-end' },
        ]}
        activeFilter={filter}
        onFilterChange={(key) => { setFilter(key); setPagination(prev => ({ ...prev, page: 1 })); }}
      />

      {isLoading ? (
        <div className="bg-admin-card border border-admin-border rounded-2xl p-8 text-center">
          <i className="fas fa-circle-notch fa-spin text-purple-400 text-3xl mb-3"></i>
          <p className="text-gray-400">Cargando escorts en gira...</p>
        </div>
      ) : escorts.length === 0 ? (
        <div className="bg-admin-card border border-admin-border rounded-2xl p-8 text-center">
          <i className="fas fa-route text-4xl mb-3 text-gray-600"></i>
          <p className="text-gray-400">No hay escorts en gira</p>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={escorts}
          loading={false}
          skeletonRows={10}
          emptyMessage="No se encontraron escorts en gira"
          emptyIcon="fa-route"
          getRowKey={(item) => item.id}
          getActions={getActions}
        />
      )}

      {pagination.pages > 1 && (
        <div className="bg-admin-card border border-admin-border rounded-xl px-6 py-4 flex items-center justify-between">
          <p className="text-sm text-gray-400">
            Mostrando <span className="text-white font-medium">{((pagination.page - 1) * pagination.limit) + 1}</span> - <span className="text-white font-medium">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> de <span className="text-white font-medium">{pagination.total}</span>
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="p-2 rounded-lg bg-admin-border text-gray-300 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <i className="fas fa-chevron-left"></i>
            </button>
            {Array.from({ length: Math.min(pagination.pages, 10) }, (_, i) => {
              const start = Math.max(1, pagination.page - 5);
              const page = start + i;
              if (page > pagination.pages) return null;
              return (
                <button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  className={`w-10 h-10 rounded-lg font-medium text-sm transition-all ${
                    pagination.page === page
                      ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg shadow-red-500/20'
                      : 'bg-admin-border text-gray-300 hover:bg-gray-700'
                  }`}>
                  {page}
                </button>
              );
            })}
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={!pagination.hasMore}
              className="p-2 rounded-lg bg-admin-border text-gray-300 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <i className="fas fa-chevron-right"></i>
            </button>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={endConfirm !== null}
        title="¿Finalizar gira?"
        message={endConfirm ? `¿Estás seguro de finalizar la gira de <strong>${endConfirm.nombre}</strong>? La escort volverá a aparecer en su ciudad base (${endConfirm.ciudad_base || 'no especificada'}).` : ''}
        confirmText={ending ? 'Finalizando...' : 'Finalizar gira'}
        cancelText="Cancelar"
        variant="danger"
        confirmDisabled={ending}
        onConfirm={handleEndGira}
        onCancel={() => setEndConfirm(null)}
      />
    </div>
  );
}
