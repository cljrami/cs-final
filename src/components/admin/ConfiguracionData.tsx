import { useEffect, useState } from 'react';
import { SkeletonTheme } from 'react-loading-skeleton';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

interface ConfigItem {
  valor: string;
  descripcion: string;
}

interface Config {
  [key: string]: ConfigItem;
}

export default function ConfiguracionData() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [formData, setFormData] = useState({
    precio_vip: '10000',
    moneda_vip: 'CLP',
    duracion_vip_dias: '30',
  });

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    fetch('/api/admin/configuracion.php', {
      headers: { 'Authorization': 'Bearer ' + token }
    })
      .then(async r => {
        const text = await r.text();
        try { return JSON.parse(text); } catch (e) { throw new Error('No es JSON'); }
      })
      .then(data => {
        if (data.success) {
          setConfig(data.config);
          setFormData({
            precio_vip: data.config.precio_vip?.valor || '10000',
            moneda_vip: data.config.moneda_vip?.valor || 'CLP',
            duracion_vip_dias: data.config.duracion_vip_dias?.valor || '30',
          });
        } else {
          setError(data.error || 'Error');
        }
      })
      .catch(err => setError('Error: ' + err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);

    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch('/api/admin/configuracion.php', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token,
        },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (data.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        setErrorMsg(data.error || 'Error al guardar');
      }
    } catch (err) {
      setErrorMsg('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-red-400">
        <i className="fas fa-exclamation-circle mr-2"></i>{error}
      </div>
    );
  }

  return (
    <SkeletonTheme baseColor="#1a1a2e" highlightColor="#2d2d44" duration={1.2}>
      <div>
        <h1 className="text-2xl md:text-3xl font-bold mb-2">Configuración</h1>
        <p className="text-admin-muted mb-8">Ajusta precios y opciones del sistema</p>

        <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl p-6 max-w-xl">
          {saved && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 mb-4 text-emerald-400 text-sm flex items-center gap-2">
              <i className="fas fa-check-circle"></i> Configuración guardada correctamente
            </div>
          )}

          {loading ? (
            <div className="space-y-4">
              <Skeleton height={60} />
              <Skeleton height={60} />
              <Skeleton height={60} />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Precio VIP *</label>
                <p className="text-xs text-gray-500 mb-2">{config?.precio_vip?.descripcion}</p>
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <input
                      type="number"
                      min="0"
                      value={formData.precio_vip}
                      onChange={(e) => setFormData({ ...formData, precio_vip: e.target.value })}
                      className="w-full bg-[#252538] border border-[#2a2a3e] rounded-lg pl-8 pr-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <select
                    value={formData.moneda_vip}
                    onChange={(e) => setFormData({ ...formData, moneda_vip: e.target.value })}
                    className="bg-[#252538] border border-[#2a2a3e] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                  >
                    <option value="CLP">CLP</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Duración VIP (días)</label>
                <p className="text-xs text-gray-500 mb-2">{config?.duracion_vip_dias?.descripcion}</p>
                <input
                  type="number"
                  min="0"
                  value={formData.duracion_vip_dias}
                  onChange={(e) => setFormData({ ...formData, duracion_vip_dias: e.target.value })}
                  className="w-full bg-[#252538] border border-[#2a2a3e] rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                />
                <p className="text-gray-500 text-xs mt-1">0 = Permanente (no expira)</p>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                >
                  {saving && <i className="fas fa-spinner fa-spin"></i>}
                  <i className="fas fa-save"></i> Guardar Cambios
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Modal Error */}
      {errorMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={() => setErrorMsg('')}>
          <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-exclamation-circle text-red-400 text-xl"></i>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Error</h3>
              <p className="text-gray-400 text-sm">{errorMsg}</p>
            </div>
            <button onClick={() => setErrorMsg('')} className="w-full px-4 py-2 bg-[#2a2a3e] hover:bg-[#353550] text-gray-300 rounded-lg text-sm font-medium transition-colors">
              Cerrar
            </button>
          </div>
        </div>
      )}
    </SkeletonTheme>
  );
}