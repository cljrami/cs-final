import { useEffect, useState } from 'react';
import { Skeleton } from '../ui/Skeleton';

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
    google_analytics_id: '',
    banner_etiqueta_publicidad: 'Publicidad',
    banner_tarifa_home_top: '15000',
    banner_tarifa_perfil_top: '15000',
    banner_tarifa_duracion_dias: '7',
    banner_moneda: 'CLP',
    share_site_name: 'Consexvip',
    share_whatsapp_template: 'Te recomiendo el perfil de {nombre} en {site_name}',
    share_twitter_template: 'Te recomiendo el perfil de {nombre} en {site_name}',
    share_telegram_template: 'Te recomiendo el perfil de {nombre} en {site_name}',
    chat_whatsapp_template: 'Hola, vi tu perfil en {site_name}. Me interesa conocer más sobre {nombre}.',
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
            google_analytics_id: data.config.google_analytics_id?.valor || '',
            banner_etiqueta_publicidad: data.config.banner_etiqueta_publicidad?.valor || 'Publicidad',
            banner_tarifa_home_top: data.config.banner_tarifa_home_top?.valor || '15000',
            banner_tarifa_perfil_top: data.config.banner_tarifa_perfil_top?.valor || '15000',
            banner_tarifa_duracion_dias: data.config.banner_tarifa_duracion_dias?.valor || '7',
            banner_moneda: data.config.banner_moneda?.valor || 'CLP',
            share_site_name: data.config.share_site_name?.valor || 'Consexvip',
            share_whatsapp_template: data.config.share_whatsapp_template?.valor || 'Te recomiendo el perfil de {nombre} en {site_name}',
            share_twitter_template: data.config.share_twitter_template?.valor || 'Te recomiendo el perfil de {nombre} en {site_name}',
            share_telegram_template: data.config.share_telegram_template?.valor || 'Te recomiendo el perfil de {nombre} en {site_name}',
            chat_whatsapp_template: data.config.chat_whatsapp_template?.valor || 'Hola, vi tu perfil en {site_name}. Me interesa conocer más sobre {nombre}.',
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
    <>
      <div>
        <h1 className="text-2xl md:text-3xl font-bold mb-2">Configuración</h1>
        <p className="text-admin-muted mb-8">Ajusta precios y opciones del sistema</p>

        <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl p-6 max-w-xl">
          {saved && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 mb-4 text-emerald-400 text-sm flex items-center gap-2">
              <i className="fas fa-check-circle"></i> Configuración guardada correctamente
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Precio VIP *</label>
                <p className="text-xs text-gray-500 mb-2">
                  {loading ? <Skeleton width={200} height={14} /> : config?.precio_vip?.descripcion}
                </p>
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    {loading ? (
                      <Skeleton height={42} className="w-full rounded-lg" />
                    ) : (
                      <input
                        type="number"
                        min="0"
                        value={formData.precio_vip}
                        onChange={(e) => setFormData({ ...formData, precio_vip: e.target.value })}
                        className="w-full bg-[#252538] border border-[#2a2a3e] rounded-lg pl-8 pr-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                      />
                    )}
                  </div>
                  {loading ? (
                    <Skeleton height={42} width={100} className="rounded-lg" />
                  ) : (
                    <select
                      value={formData.moneda_vip}
                      onChange={(e) => setFormData({ ...formData, moneda_vip: e.target.value })}
                      className="bg-[#252538] border border-[#2a2a3e] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                    >
                      <option value="CLP">CLP</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                    </select>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Duración VIP (días)</label>
                <p className="text-xs text-gray-500 mb-2">
                  {loading ? <Skeleton width={200} height={14} /> : config?.duracion_vip_dias?.descripcion}
                </p>
                {loading ? (
                  <Skeleton height={42} className="w-full rounded-lg" />
                ) : (
                  <input
                    type="number"
                    min="0"
                    value={formData.duracion_vip_dias}
                    onChange={(e) => setFormData({ ...formData, duracion_vip_dias: e.target.value })}
                    className="w-full bg-[#252538] border border-[#2a2a3e] rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                )}
                <p className="text-gray-500 text-xs mt-1">0 = Permanente (no expira)</p>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Google Analytics (gtag.js)</label>
                <p className="text-xs text-gray-500 mb-2">
                  {loading ? <Skeleton width={200} height={14} /> : config?.google_analytics_id?.descripcion}
                </p>
                {loading ? (
                  <Skeleton height={42} className="w-full rounded-lg" />
                ) : (
                  <input
                    type="text"
                    placeholder="G-XXXXXXXXXX"
                    value={formData.google_analytics_id}
                    onChange={(e) => setFormData({ ...formData, google_analytics_id: e.target.value })}
                    className="w-full bg-[#252538] border border-[#2a2a3e] rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                )}
                <p className="text-gray-500 text-xs mt-1">
                  Pega el ID de medición de Google Analytics 4. Se activa en todo el sitio al guardar. Déjalo vacío para desactivar las analíticas.
                </p>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Publicidad (banners)</label>
                <p className="text-xs text-gray-500 mb-2">Tarifario referencial para cotizar los espacios publicitarios y etiqueta que se muestra bajo cada banner.</p>
                <div className="space-y-3">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Etiqueta bajo el banner</label>
                      <input
                        type="text"
                        value={formData.banner_etiqueta_publicidad}
                        onChange={(e) => setFormData({ ...formData, banner_etiqueta_publicidad: e.target.value })}
                        className="w-full bg-[#252538] border border-[#2a2a3e] rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Días por campaña</label>
                      <input
                        type="number"
                        min="1"
                        value={formData.banner_tarifa_duracion_dias}
                        onChange={(e) => setFormData({ ...formData, banner_tarifa_duracion_dias: e.target.value })}
                        className="w-full bg-[#252538] border border-[#2a2a3e] rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {([
                      ['banner_tarifa_home_top', 'Home · banner superior'],
                      ['banner_tarifa_perfil_top', 'Perfil · superior'],
                    ] as const).map(([key, label]) => (
                      <div key={key}>
                        <label className="block text-xs text-gray-500 mb-1">{label}</label>
                        <input
                          type="number"
                          min="0"
                          value={formData[key]}
                          onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                          className="w-full bg-[#252538] border border-[#2a2a3e] rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Mensaje de chat WhatsApp</label>
                <p className="text-xs text-gray-500 mb-2">Texto prellenado al abrir chat directo con la escort desde el perfil público. Usa {'{nombre}'} y {'{site_name}'}.</p>
                <input
                  type="text"
                  value={formData.chat_whatsapp_template}
                  onChange={(e) => setFormData({ ...formData, chat_whatsapp_template: e.target.value })}
                  className="w-full bg-[#252538] border border-[#2a2a3e] rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Mensajes de compartir</label>
                <p className="text-xs text-gray-500 mb-2">Plantillas usadas en el modal de compartir del perfil público. Usa {'{nombre}'} y {'{site_name}'} como variables.</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Nombre del sitio</label>
                    <input
                      type="text"
                      value={formData.share_site_name}
                      onChange={(e) => setFormData({ ...formData, share_site_name: e.target.value })}
                      className="w-full bg-[#252538] border border-[#2a2a3e] rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">WhatsApp</label>
                    <input
                      type="text"
                      value={formData.share_whatsapp_template}
                      onChange={(e) => setFormData({ ...formData, share_whatsapp_template: e.target.value })}
                      className="w-full bg-[#252538] border border-[#2a2a3e] rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">X / Twitter</label>
                    <input
                      type="text"
                      value={formData.share_twitter_template}
                      onChange={(e) => setFormData({ ...formData, share_twitter_template: e.target.value })}
                      className="w-full bg-[#252538] border border-[#2a2a3e] rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Telegram</label>
                    <input
                      type="text"
                      value={formData.share_telegram_template}
                      onChange={(e) => setFormData({ ...formData, share_telegram_template: e.target.value })}
                      className="w-full bg-[#252538] border border-[#2a2a3e] rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
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
    </>
  );
}