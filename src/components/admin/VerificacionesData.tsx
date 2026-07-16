import { useState, useEffect, useCallback, useRef } from 'react';
import StatCard from '../ui/StatCard';
import DataTable from '../ui/DataTable';
import type { Column, ActionItem } from '../ui/DataTable';
import ConfirmModal from '../ui/ConfirmModal';
import SearchFilters from './SearchFilters';
import '@fancyapps/ui/dist/fancybox/fancybox.css';

interface Stats {
  total: number;
  pendientes: number;
  aprobadas: number;
  rechazadas: number;
}

interface Verificacion {
  id: number;
  escort_id: number;
  foto_perfil_real: string;
  foto_principal: string | null;
  estado: 'pendiente' | 'aprobada' | 'rechazada';
  notas_revision: string;
  revisado_en: string;
  creado_en: string;
  escort_nombre: string;
  escort_email: string;
  ciudad: string;
  edad: number;
}

const API_URL = '/api/admin/verificaciones.php';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('admin_token') || '';
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
}

const estadoConfig: Record<string, { bg: string; text: string; icon: string; label: string }> = {
  pendiente: { bg: '#3d3d1a', text: '#fbbf24', icon: 'fa-clock', label: 'Pendiente' },
  aprobada: { bg: '#1a3d2e', text: '#10b981', icon: 'fa-check-circle', label: 'Aprobada' },
  rechazada: { bg: '#3d1a1a', text: '#ef4444', icon: 'fa-times-circle', label: 'Rechazada' },
};

export default function VerificacionesData() {
  const [items, setItems] = useState<Verificacion[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, pendientes: 0, aprobadas: 0, rechazadas: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [filter, setFilter] = useState('todos');
  const [search, setSearch] = useState('');

  const [deleteConfirm, setDeleteConfirm] = useState<Verificacion | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const [actionVerif, setActionVerif] = useState<Verificacion | null>(null);
  const [actionType, setActionType] = useState<'aprobar' | 'rechazar' | null>(null);
  const [notas, setNotas] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const [comprobanteFile, setComprobanteFile] = useState<File | null>(null);
  const [comprobantePreview, setComprobantePreview] = useState('');
  const [subiendoComprobante, setSubiendoComprobante] = useState(false);
  const fileInputComprobante = useRef<HTMLInputElement>(null);

  const showNotification = (msg: string) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 3000); };

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ estado: filter, search });
      const res = await fetch(`${API_URL}?${params}`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error al cargar');
      setItems(data.verificaciones || []);
      setStats(data.stats || { total: 0, pendientes: 0, aprobadas: 0, rechazadas: 0 });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [filter, search]);

  useEffect(() => { fetchItems(); }, [filter]);
  useEffect(() => { fetchItems(); }, []);

  useEffect(() => {
    let disposed = false;
    import('@fancyapps/ui').then((mod) => {
      if (disposed) return;
      const F = mod.Fancybox;
      F.bind('[data-fancybox]', {
        compact: false,
        idle: false,
        Toolbar: { display: ['close'] },
        Thumbs: false,
      });
    });
    return () => { disposed = true; };
  }, []);

  useEffect(() => {
    if (!search && filter === 'todos') return;
    const timer = setTimeout(() => fetchItems(), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const handleAction = async () => {
    if (!actionVerif || !actionType) return;
    setActionLoading(true);
    setError('');
    try {
      let comprobanteUrl = null;

      if (comprobanteFile && actionType === 'aprobar') {
        setSubiendoComprobante(true);
        const formData = new FormData();
        formData.append('comprobante', comprobanteFile);
        formData.append('escort_id', String(actionVerif.escort_id));
        const uploadRes = await fetch('/api/admin/subir-comprobante.php', {
          method: 'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('admin_token') || ''}` },
          body: formData,
        });
        const uploadData = await uploadRes.json();
        setSubiendoComprobante(false);
        if (uploadData.success) {
          comprobanteUrl = uploadData.path;
        } else {
          setError(uploadData.error || 'Error al subir comprobante');
          setActionLoading(false);
          return;
        }
      }

      const res = await fetch(API_URL, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          id: actionVerif.id,
          estado: actionType === 'aprobar' ? 'aprobada' : 'rechazada',
          notas_revision: notas,
          comprobante_pago: comprobanteUrl,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showNotification(actionType === 'aprobar' ? 'Verificación aprobada' : 'Verificación rechazada');
        setActionVerif(null);
        setActionType(null);
        setNotas('');
        setComprobanteFile(null);
        setComprobantePreview('');
        fetchItems();
        window.dispatchEvent(new Event('counts-refresh'));
      } else {
        setError(data.error || 'Error del servidor');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      const payload = deleteConfirm.id === 0
        ? { escort_id: deleteConfirm.escort_id }
        : { id: deleteConfirm.id };
      const res = await fetch(API_URL, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error al eliminar');
      showNotification('Verificación eliminada');
      setDeleteConfirm(null);
      fetchItems();
      window.dispatchEvent(new Event('counts-refresh'));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const getActions = (item: Verificacion): ActionItem[] => [
    ...(item.estado === 'pendiente' ? [
      { label: 'Aprobar', icon: 'fa-check', onClick: () => { setActionVerif(item); setActionType('aprobar'); setNotas(''); } },
      { label: 'Rechazar', icon: 'fa-times', danger: true, onClick: () => { setActionVerif(item); setActionType('rechazar'); setNotas(''); } },
    ] : []),
    {
      label: 'Eliminar', icon: 'fa-trash-alt', danger: true, onClick: () => setDeleteConfirm(item),
    },
  ].filter(Boolean) as ActionItem[];

  const columns: Column<Verificacion>[] = [
    {
      key: 'escort', header: 'Escort', width: '240',
      render: (item) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 min-w-[40px] rounded-xl bg-[#2a2a3e] overflow-hidden flex-shrink-0">
            {item.foto_principal ? (
              <img src={item.foto_principal} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-600">
                <i className="fas fa-user" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="font-medium whitespace-nowrap text-sm text-white">{item.escort_nombre}</div>
            <div className="text-xs text-admin-muted">{item.escort_email}</div>
            <div className="text-xs text-gray-600">{item.edad} años · {item.ciudad}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'selfie', header: 'Selfie', width: '100', align: 'center',
      render: (item) => item.foto_perfil_real ? (
        <a href={item.foto_perfil_real} data-fancybox="verif-selfie">
          <img src={item.foto_perfil_real} alt="Selfie"
            className="w-10 h-10 rounded-lg object-cover cursor-pointer hover:opacity-80 transition-opacity" />
        </a>
      ) : (
        <span className="text-gray-600 text-xs">—</span>
      ),
    },
    {
      key: 'fecha', header: 'Fecha', width: '110',
      render: (item) => (
        <div className="text-sm text-gray-400">
          {item.creado_en ? new Date(item.creado_en).toLocaleDateString('es-CL') : '—'}
        </div>
      ),
    },
    {
      key: 'estado', header: 'Estado', width: '120', align: 'center',
      render: (item) => {
        const cfg = estadoConfig[item.estado] || estadoConfig.pendiente;
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap"
            style={{ backgroundColor: cfg.bg, color: cfg.text }}>
            <i className={`fas ${cfg.icon} text-[0.6rem]`}></i>
            {cfg.label}
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <i className="fas fa-id-card text-yellow-400"></i> Verificaciones
        </h1>
        <p className="text-gray-400 mt-1">Revisa y aprueba las solicitudes de identidad</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard label="Total" value={stats.total} icon="fa-users" color="#6b7280" loading={isLoading} />
        <StatCard label="Pendientes" value={stats.pendientes} icon="fa-clock" color="#fbbf24" loading={isLoading} />
        <StatCard label="Aprobadas" value={stats.aprobadas} icon="fa-check-circle" color="#10b981" loading={isLoading} />
        <StatCard label="Rechazadas" value={stats.rechazadas} icon="fa-times-circle" color="#ef4444" loading={isLoading} />
      </div>

      {successMsg && <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-lg flex items-center gap-2"><i className="fas fa-check-circle"></i>{successMsg}</div>}
      {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2"><i className="fas fa-exclamation-triangle"></i>{error} <button onClick={() => setError('')} className="ml-auto text-red-400/60 hover:text-red-400"><i className="fas fa-times"></i></button></div>}

      <SearchFilters
        search={search}
        onSearch={setSearch}
        placeholder="Buscar por nombre o email..."
        filters={[
          { key: 'todos', label: 'Todos', icon: 'fa-list' },
          { key: 'pendiente', label: 'Pendientes', icon: 'fa-clock' },
          { key: 'aprobada', label: 'Aprobadas', icon: 'fa-check' },
          { key: 'rechazada', label: 'Rechazadas', icon: 'fa-times' },
        ]}
        activeFilter={filter}
        onFilterChange={setFilter}
      />

      <DataTable
        columns={columns}
        data={items}
        loading={isLoading}
        skeletonRows={5}
        emptyMessage={search ? 'No se encontraron verificaciones' : 'No hay solicitudes de verificación'}
        emptyIcon="fa-id-card"
        getRowKey={(item) => `${item.id}-${item.escort_id}`}
        getActions={getActions}
      />

      {/* Approve/Reject Modal */}
      {actionVerif && actionType && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70" onClick={() => { setActionVerif(null); setActionType(null); setComprobanteFile(null); setComprobantePreview(''); }}>
          <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-full ${actionType === 'aprobar' ? 'bg-emerald-500/20' : 'bg-red-500/20'} flex items-center justify-center flex-shrink-0`}>
                  <i className={`fas fa-${actionType === 'aprobar' ? 'check' : 'times'} ${actionType === 'aprobar' ? 'text-emerald-400' : 'text-red-400'} text-lg`}></i>
                </div>
                <div>
                  <h3 className="text-white font-semibold text-sm">{actionType === 'aprobar' ? '¿Aprobar verificación?' : '¿Rechazar verificación?'}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed mt-0.5">
                    Escort: <strong className="text-white">{actionVerif.escort_nombre}</strong>
                  </p>
                </div>
              </div>

              {/* Selfie foto */}
              {actionVerif.foto_perfil_real && (
                <div className="mb-4">
                  <label className="block text-sm text-gray-400 mb-1">Selfie enviada</label>
                  <a href={actionVerif.foto_perfil_real} data-fancybox="verif-selfie">
                    <img src={actionVerif.foto_perfil_real} alt="Selfie"
                      className="rounded-lg w-full max-h-48 object-cover cursor-pointer hover:opacity-80 transition-opacity" />
                  </a>
                </div>
              )}

              {/* Comprobante de pago (solo al aprobar) */}
              {actionType === 'aprobar' && (
                <div className="mb-4">
                  <label className="block text-sm text-gray-400 mb-1">Comprobante de pago <span className="text-gray-600">(opcional)</span></label>
                  <input ref={fileInputComprobante} type="file" accept="image/*,application/pdf" className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 5 * 1024 * 1024) { setError('El archivo no puede superar 5MB'); return; }
                      setComprobanteFile(file);
                      if (file.type.startsWith('image/')) {
                        const reader = new FileReader();
                        reader.onload = (ev) => setComprobantePreview(ev.target?.result as string);
                        reader.readAsDataURL(file);
                      } else {
                        setComprobantePreview('');
                      }
                    }} />
                  {!comprobanteFile ? (
                    <div onClick={() => fileInputComprobante.current?.click()}
                      className="border-2 border-dashed border-[#2a2a3e] rounded-lg p-4 text-center cursor-pointer hover:border-gray-500 transition-colors">
                      <i className="fas fa-cloud-upload-alt text-gray-500 text-xl mb-1"></i>
                      <div className="text-gray-500 text-xs">Click para subir comprobante</div>
                      <div className="text-gray-600 text-[10px]">JPG, PNG, PDF · Max 5MB</div>
                    </div>
                  ) : (
                    <div className="bg-[#252538] rounded-lg p-3 flex items-center gap-3">
                      {comprobantePreview ? (
                        <img src={comprobantePreview} alt="Preview" className="w-12 h-12 rounded object-cover" />
                      ) : (
                        <div className="w-12 h-12 rounded bg-[#13131a] flex items-center justify-center text-gray-500"><i className="fas fa-file-pdf text-lg"></i></div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-sm truncate">{comprobanteFile.name}</div>
                        <div className="text-gray-500 text-xs">{(comprobanteFile.size / 1024).toFixed(1)} KB</div>
                      </div>
                      <button onClick={() => { setComprobanteFile(null); setComprobantePreview(''); }} className="text-red-400 hover:text-red-300 text-sm">
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-1">Notas {actionType === 'rechazar' && <span className="text-red-400">*</span>}</label>
                <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={3}
                  className="w-full bg-[#252538] border border-[#2a2a3e] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500 resize-none"
                  placeholder={actionType === 'rechazar' ? 'Motivo del rechazo...' : 'Notas adicionales...'} />
                {actionType === 'rechazar' && !notas.trim() && (
                  <p className="text-red-400 text-xs mt-1"><i className="fas fa-exclamation-circle mr-1"></i>Indica el motivo del rechazo</p>
                )}
              </div>

              <div className="flex gap-3">
                <button onClick={() => { setActionVerif(null); setActionType(null); setComprobanteFile(null); setComprobantePreview(''); }}
                  className="flex-1 px-4 py-2 bg-[#2a2a3e] hover:bg-[#353550] text-gray-300 rounded-lg text-sm font-medium transition-colors">
                  Cancelar
                </button>
                <button onClick={handleAction} disabled={actionLoading || subiendoComprobante || (actionType === 'rechazar' && !notas.trim())}
                  className={`flex-1 px-4 py-2 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${
                    actionType === 'aprobar' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
                  }`}>
                  {(actionLoading || subiendoComprobante) && <i className="fas fa-spinner fa-spin"></i>}
                  {subiendoComprobante ? 'Subiendo comprobante...' : actionType === 'aprobar' ? 'Aprobar' : 'Rechazar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={deleteConfirm !== null}
        title="¿Eliminar verificación?"
        message={`Estás a punto de eliminar la verificación de <strong>${deleteConfirm?.escort_nombre || ''}</strong>. La escort deberá reenviar la solicitud.`}
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
