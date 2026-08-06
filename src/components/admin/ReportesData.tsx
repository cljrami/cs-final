import { useState, useEffect, useCallback } from 'react';
import DataTable from '../ui/DataTable';
import type { Column, ActionItem } from '../ui/DataTable';
import StatCard from '../ui/StatCard';
import type { Report } from '../../types/report';

const API_BASE_URL = '/api/reportes.php';

const estados = [
  { value: 'pending', label: 'Pendientes', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  { value: 'reviewed', label: 'Revisados', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' },
  { value: 'dismissed', label: 'Desestimados', color: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500/20' },
  { value: 'all', label: 'Todos', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
];

export default function ReportesData() {
  const [reports, setReports] = useState<Report[]>([]);
  const [stats, setStats] = useState({ pending: 0, reviewed: 0, dismissed: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState('pending');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [confirmActionId, setConfirmActionId] = useState<number | null>(null);
  const [actionType, setActionType] = useState<'review' | 'dismiss' | null>(null);
  const [viewReport, setViewReport] = useState<Report | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ 
        estado: filtroEstado, 
        page: String(page), 
        search, 
        per_page: '20' 
      });
      const token = localStorage.getItem('admin_token') || '';
      const res = await fetch(`${API_BASE_URL}?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      // Handle non-JSON responses (e.g., 500 errors with HTML output)
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        // Try to get error message from response text for better debugging
        const text = await res.text();
        throw new Error(`Respuesta inválida del servidor (${res.status}). ${text.substring(0, 200)}`);
      }
      
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error al cargar reportes');
      setReports(data.data || []);
      setStats(data.stats || { pending: 0, reviewed: 0, dismissed: 0, total: 0 });
      setTotalPages(data.pagination?.total_pages || 1);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, filtroEstado, search]);

  useEffect(() => {
    fetchReports();
  }, [page, filtroEstado]);

  useEffect(() => {
    if (!search) fetchReports();
  }, [search]);

  useEffect(() => {
    if (search) {
      const timer = setTimeout(() => {
        setPage(1);
        fetchReports();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [search]);

  const updateReportStatus = async (id: number, estado: string) => {
    try {
      const token = localStorage.getItem('admin_token') || '';
      const res = await fetch('/api/reportes.php/review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ id, estado }),
      });
      
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Respuesta inválida del servidor');
      }
      
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(estado === 'reviewed' ? 'Reporte marcado como revisado' : 'Reporte desestimado');
        setTimeout(() => setSuccessMsg(''), 3000);
        window.dispatchEvent(new Event('counts-refresh'));
        fetchReports();
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleConfirmAction = async () => {
    if (confirmActionId && actionType) {
      await updateReportStatus(confirmActionId, actionType === 'review' ? 'reviewed' : 'dismissed');
      setConfirmActionId(null);
      setActionType(null);
    }
  };

  const handleDelete = async () => {
    if (deleteConfirmId === null) return;
    const id = deleteConfirmId;
    setDeletingId(id);
    setDeleteConfirmId(null);
    try {
      const token = localStorage.getItem('admin_token') || '';
      const res = await fetch(API_BASE_URL, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error al eliminar');
      setSuccessMsg('Reporte eliminado');
      setTimeout(() => setSuccessMsg(''), 3000);
      window.dispatchEvent(new Event('counts-refresh'));
      fetchReports();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-CL', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const columns: Column<Report>[] = [
    {
      key: 'id',
      header: 'ID',
      width: '60',
      render: (item) => (
        <span className="text-gray-500 text-sm">#{item.id}</span>
      ),
    },
    {
      key: 'escort',
      header: 'Perfil',
      width: '200',
      render: (item) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-[#252538] flex items-center justify-center flex-shrink-0">
            {item.foto_principal ? (
              <img src={item.foto_principal} alt="" className="w-full h-full object-cover" />
            ) : (
              <i className="fas fa-user text-gray-600"></i>
            )}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-white truncate">
              {item.escort_nombre || `ID ${item.escort_id}`}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">ID: {item.escort_id}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'motivo',
      header: 'Motivo',
      width: '200',
      render: (item) => (
        <div>
          <div className="text-sm text-gray-300 truncate max-w-xs" title={item.motivo}>{item.motivo}</div>
          {item.detalle && (
            <div 
              className="text-xs text-gray-500 mt-1 line-clamp-2 bg-[#252538] rounded p-2 border border-[#2a2a3e]"
              title={item.detalle}
            >
              {item.detalle}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'reportador',
      header: 'Reportado por',
      width: '180',
      render: (item) => {
        const nombre = item.reportador_nombre || '';
        const email = item.reportador_email || '';
        if (!nombre && !email) {
          return (
            <span className="text-gray-500 text-xs">IP: {item.reportado_por || '—'}</span>
          );
        }
        return (
          <div className="min-w-0">
            {nombre && <div className="text-xs font-medium text-white truncate">{nombre}</div>}
            {email && <div className="text-xs text-gray-500 truncate">{email}</div>}
          </div>
        );
      },
    },
    {
      key: 'estado',
      header: 'Estado',
      width: '100',
      align: 'center',
      render: (item) => {
        const estadoConfig = estados.find(e => e.value === item.estado) || estados[0];
        return (
          <span className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-medium ${estadoConfig.bg} ${estadoConfig.color} border ${estadoConfig.border}`}>
            {estadoConfig.label}
          </span>
        );
      },
    },
    {
      key: 'created_at',
      header: 'Fecha',
      width: '140',
      render: (item) => (
        <span className="text-xs text-gray-400">
          {formatDate(item.created_at)}
        </span>
      ),
    },
  ];

  const getActions = (item: Report): ActionItem[] => {
    const actions: ActionItem[] = [];
    
    actions.push({ 
      label: 'Ver', 
      icon: 'fa-eye', 
      onClick: () => setViewReport(item) 
    });
    
    if (item.estado === 'pending') {
      actions.push({ 
        label: 'Marcar como revisado', 
        icon: 'fa-check', 
        onClick: () => {
          setConfirmActionId(item.id);
          setActionType('review');
        }
      });
      actions.push({ 
        label: 'Desestimar', 
        icon: 'fa-times', 
        onClick: () => {
          setConfirmActionId(item.id);
          setActionType('dismiss');
        }
      });
    }

    actions.push({ label: 'Eliminar', icon: 'fa-trash-alt', danger: true, onClick: () => setDeleteConfirmId(item.id) });
    
    return actions;
  };

  const tabs = [
    { key: 'pending', label: 'Pendientes', icon: 'fa-clock', count: stats.pending },
    { key: 'reviewed', label: 'Revisados', icon: 'fa-check', count: stats.reviewed },
    { key: 'dismissed', label: 'Desestimados', icon: 'fa-times', count: stats.dismissed },
    { key: 'all', label: 'Todos', icon: 'fa-list', count: stats.total },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <i className="fas fa-flag text-red-400"></i> Reportes de Perfiles
        </h1>
        <p className="text-gray-400 mt-1">Reportes enviados por usuarios sobre perfiles sospechosos</p>
      </div>

      {successMsg && (
        <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-lg flex items-center gap-2">
          <i className="fas fa-check-circle"></i>{successMsg}
        </div>
      )}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2">
          <i className="fas fa-exclamation-triangle"></i>{error}
          <button onClick={() => setError('')} className="ml-auto">
            <i className="fas fa-times"></i>
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Pendientes" value={stats.pending} icon="fa-clock" color="#fbbf24" loading={loading} />
        <StatCard label="Revisados" value={stats.reviewed} icon="fa-check-circle" color="#10b981" loading={loading} />
        <StatCard label="Desestimados" value={stats.dismissed} icon="fa-times-circle" color="#6b7280" loading={loading} />
        <StatCard label="Total" value={stats.total} icon="fa-flag" color="#ef4444" loading={loading} />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setFiltroEstado(tab.key); setPage(1); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${
              filtroEstado === tab.key
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
        placeholder="Buscar por ID de reporte, ID de escort, motivo, detalle, IP o nombre..."
        className="w-full bg-[#252538] border border-[#2a2a3e] rounded-lg px-4 py-2 text-white text-sm outline-none focus:border-red-500/50 transition-colors placeholder-gray-600"
      />

      <DataTable
        columns={columns}
        data={reports}
        loading={loading}
        skeletonRows={5}
        emptyMessage="No hay reportes"
        emptyIcon="fa-flag"
        getRowKey={(item) => item.id}
        getActions={getActions}
      />

      {totalPages > 1 && !loading && (
        <div className="flex items-center justify-between px-4 py-3 bg-admin-card border border-admin-border rounded-xl">
          <button 
            onClick={() => setPage(p => Math.max(1, p - 1))} 
            disabled={page === 1}
            className="text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed text-sm flex items-center gap-1"
          >
            <i className="fas fa-chevron-left"></i> Anterior
          </button>
          <span className="text-gray-500 text-sm">Página {page} de {totalPages}</span>
          <button 
            onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
            disabled={page === totalPages}
            className="text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed text-sm flex items-center gap-1"
          >
            Siguiente <i className="fas fa-chevron-right"></i>
          </button>
        </div>
      )}

      {viewReport && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" 
          onClick={() => setViewReport(null)}
        >
          <div 
            className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl w-full max-w-lg" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                    <i className="fas fa-flag text-red-400 text-lg"></i>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold text-sm">Detalle del Reporte</h3>
                    <p className="text-gray-500 text-xs">
                      Reporte #{viewReport.id} • {formatDate(viewReport.created_at)}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setViewReport(null)} 
                  className="text-gray-500 hover:text-white transition-colors"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h4 className="text-gray-500 text-xs uppercase tracking-wider mb-2">Información del Perfil</h4>
                  <div className="bg-[#252538] rounded-lg p-3 flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-[#2a2a3e] flex items-center justify-center flex-shrink-0">
                      {viewReport.foto_principal ? (
                        <img src={viewReport.foto_principal} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <i className="fas fa-user text-gray-600"></i>
                      )}
                    </div>
                    <div>
                      <div className="text-white font-medium text-sm">
                        {viewReport.escort_nombre || `ID ${viewReport.escort_id}`}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">ID: {viewReport.escort_id}</div>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="text-gray-500 text-xs uppercase tracking-wider mb-2">Motivo del Reporte</h4>
                  <div className="bg-[#252538] rounded-lg p-3">
                    <div className="text-white text-sm font-medium mb-2">{viewReport.motivo}</div>
                    {viewReport.detalle && (
                      <div className="text-gray-400 text-sm bg-[#2a2a3e] rounded p-2 mt-2">
                        {viewReport.detalle}
                      </div>
                    )}
                  </div>
                </div>
                
                <div>
                  <h4 className="text-gray-500 text-xs uppercase tracking-wider mb-2">Estado Actual</h4>
                  <div className="flex items-center gap-2">
                    {(() => {
                      const estadoConfig = estados.find(e => e.value === viewReport.estado) || estados[0];
                      return (
                        <span className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-medium ${estadoConfig.bg} ${estadoConfig.color} border ${estadoConfig.border}`}>
                          {estadoConfig.label}
                        </span>
                      );
                    })()}
                  </div>
                </div>
                
                {viewReport.reportado_por && (
                  <div>
                    <h4 className="text-gray-500 text-xs uppercase tracking-wider mb-2">Información del Reportador</h4>
                    <div className="bg-[#252538] rounded-lg p-3">
                      {viewReport.reportador_nombre && (
                        <div className="text-white text-sm font-medium">{viewReport.reportador_nombre}</div>
                      )}
                      {viewReport.reportador_email && (
                        <div className="text-gray-400 text-sm">{viewReport.reportador_email}</div>
                      )}
                      {viewReport.reportado_por && (
                        <div className="text-gray-500 text-xs mt-1">IP: {viewReport.reportado_por}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex gap-3 mt-6">
                {viewReport.estado === 'pending' && (
                  <>
                    <button
                      onClick={() => {
                        setViewReport(null);
                        setConfirmActionId(viewReport.id);
                        setActionType('review');
                      }}
                      className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg text-sm transition-all flex items-center justify-center gap-2"
                    >
                      <i className="fas fa-check"></i> Marcar como Revisado
                    </button>
                    <button
                      onClick={() => {
                        setViewReport(null);
                        setConfirmActionId(viewReport.id);
                        setActionType('dismiss');
                      }}
                      className="flex-1 px-4 py-2.5 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg text-sm transition-all flex items-center justify-center gap-2"
                    >
                      <i className="fas fa-times"></i> Desestimar
                    </button>
                  </>
                )}
                <button
                  onClick={() => setViewReport(null)}
                  className="px-4 py-2.5 bg-[#252538] hover:bg-[#2d2d44] text-gray-400 font-medium rounded-lg text-sm transition-all"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmActionId !== null && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" 
          onClick={() => {
            setConfirmActionId(null);
            setActionType(null);
          }}
        >          <div 
            className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl w-full max-w-sm" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                  <i className="fas fa-question-circle text-yellow-400 text-lg"></i>
                </div>
                <p className="text-white text-sm leading-relaxed">
                  {actionType === 'review' 
                    ? '¿Marcar este reporte como revisado?' 
                    : '¿Desestimar este reporte?'}
                </p>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setConfirmActionId(null);
                    setActionType(null);
                  }}
                  className="px-4 py-2 bg-[#2a2a3e] hover:bg-[#353550] text-gray-300 rounded-lg text-sm font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmAction}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    actionType === 'review'
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-gray-600 hover:bg-gray-700 text-white'
                  }`}
                >
                  {actionType === 'review' ? 'Marcar como Revisado' : 'Desestimar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmId !== null && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" 
          onClick={() => setDeleteConfirmId(null)}
        >
          <div 
            className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl w-full max-w-sm" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                  <i className="fas fa-exclamation-triangle text-red-400 text-lg"></i>
                </div>
                <div>
                  <h3 className="text-white font-semibold text-sm">Confirmar eliminación</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">¿Eliminar el reporte #{deleteConfirmId}? No se puede deshacer.</p>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="px-4 py-2 bg-[#2a2a3e] hover:bg-[#353550] text-gray-300 rounded-lg text-sm font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deletingId !== null}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deletingId !== null ? (
                    <span className="flex items-center gap-2">
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Eliminando...
                    </span>
                  ) : (
                    'Confirmar'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

