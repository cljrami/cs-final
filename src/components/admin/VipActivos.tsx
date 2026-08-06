import { useState, useEffect } from 'react';
import StatCard from '../ui/StatCard';
import ConfirmModal from '../ui/ConfirmModal';

interface VipActivo {
  id: number;
  nombre: string;
  email: string;
  telefono: string | null;
  ciudad: string | null;
  foto_principal: string | null;
  verificado: boolean;
  rating: string;
  total_valoraciones: number;
  destacado: number;
  vip_expira: string;
  dias_restantes_vip: number;
  plan: { nombre: string; vence: string; dias_restantes: number } | null;
}

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('admin_token') || '';
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
}

const API_URL = '/api/admin/vip-activos.php';
const REVOCAR_URL = '/api/admin/vip-revocar.php';

export default function VipActivos() {
  const [activos, setActivos] = useState<VipActivo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [revocarId, setRevocarId] = useState<number | null>(null);
  const [revocando, setRevocando] = useState(false);

  const showNotification = (msg: string) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 3000); };

  const fetchActivos = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(API_URL, { headers: getAuthHeaders() });
      const data = await res.json();
      if (data.success) setActivos(data.activos);
      else setError(data.error || 'Error al cargar');
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchActivos(); }, []);

  const handleRevocar = async () => {
    if (revocarId === null) return;
    setRevocando(true);
    setError('');
    try {
      const res = await fetch(REVOCAR_URL, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ escort_id: revocarId }),
      });
      const data = await res.json();
      if (data.success) {
        showNotification('VIP revocado correctamente');
        setRevocarId(null);
        fetchActivos();
        window.dispatchEvent(new Event('counts-refresh'));
      } else {
        setError(data.error || 'Error al revocar');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setRevocando(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <i className="fas fa-crown text-yellow-400"></i> VIP Activos
        </h1>
        <p className="text-gray-400 mt-1">Escorts con badge VIP activo actualmente</p>
      </div>

      <StatCard label="VIP Activos" value={activos.length} icon="fa-crown" color="#fbbf24" loading={loading} />

      {successMsg && <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-lg flex items-center gap-2"><i className="fas fa-check-circle"></i>{successMsg}</div>}
      {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2"><i className="fas fa-exclamation-triangle"></i>{error} <button onClick={() => setError('')} className="ml-auto text-red-400/60 hover:text-red-400"><i className="fas fa-times"></i></button></div>}

      {loading ? (
        <div className="grid gap-4">
          {[1,2,3].map(i => (
            <div key={i} className="bg-admin-card border border-admin-border rounded-xl p-4 flex items-center gap-4">
              <div className="w-12 h-12 min-w-[48px] rounded-xl bg-gray-800 animate-pulse shrink-0"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-800 rounded animate-pulse w-40"></div>
                <div className="h-3 bg-gray-800 rounded animate-pulse w-56"></div>
              </div>
              <div className="text-right shrink-0 space-y-1">
                <div className="h-5 bg-gray-800 rounded animate-pulse w-16 ml-auto"></div>
                <div className="h-3 bg-gray-800 rounded animate-pulse w-20 ml-auto"></div>
              </div>
              <div className="w-20 h-7 bg-gray-800 rounded-lg animate-pulse shrink-0"></div>
            </div>
          ))}
        </div>
      ) : activos.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <i className="fas fa-crown text-4xl mb-3 opacity-30"></i>
          <p>No hay escorts con VIP activo</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {activos.map(a => (
            <div key={a.id} className="bg-admin-card border border-admin-border rounded-xl p-4 flex items-center gap-4">
              <div className="w-12 h-12 min-w-[48px] rounded-xl bg-[#2a2a3e] overflow-hidden">
                {a.foto_principal ? (
                  <img src={a.foto_principal} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-600"><i className="fas fa-user"></i></div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-white font-semibold">{a.nombre}</span>
                  {a.verificado && <i className="fas fa-check-circle text-blue-400 text-xs" title="Verificada"></i>}
                  {a.destacado === 1 && <i className="fas fa-fire text-red-400 text-xs" title="Destacada"></i>}
                </div>
                <div className="text-gray-500 text-xs mt-0.5">{a.email} {a.ciudad ? `• ${a.ciudad}` : ''}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="flex items-center gap-1 justify-end">
                  <i className="fas fa-crown text-yellow-400 text-xs"></i>
                  <span className={`text-sm font-bold ${a.dias_restantes_vip <= 3 ? 'text-red-400' : 'text-yellow-400'}`}>
                    {a.dias_restantes_vip} días
                  </span>
                </div>
                <div className="text-xs text-gray-600">Vence: {new Date(a.vip_expira).toLocaleDateString('es-CL')}</div>
                {a.plan && (
                  <div className="text-xs text-gray-600">{a.plan.nombre} · {a.plan.dias_restantes}d</div>
                )}
              </div>
              <button
                onClick={() => setRevocarId(a.id)}
                className="shrink-0 px-3 py-1.5 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white text-xs rounded-lg transition-colors flex items-center gap-1.5"
                title="Revocar VIP"
              >
                <i className="fas fa-ban"></i> Revocar
              </button>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        isOpen={revocarId !== null}
        title="¿Revocar VIP?"
        message={`Estás a punto de revocar el VIP a <strong>${activos.find(a => a.id === revocarId)?.nombre || ''}</strong>. La escort perderá el badge VIP inmediatamente y se notificará.`}
        confirmText={revocando ? 'Revocando...' : 'Revocar VIP'}
        cancelText="Cancelar"
        variant="danger"
        confirmDisabled={revocando}
        onConfirm={handleRevocar}
        onCancel={() => setRevocarId(null)}
      />
    </div>
  );
}
