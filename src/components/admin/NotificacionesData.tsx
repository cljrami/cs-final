import { useEffect, useState } from 'react';
import { Skeleton } from '../ui/Skeleton';

interface NotifEvent {
  key: string;
  label: string;
  desc: string;
}

const EVENTOS: NotifEvent[] = [
  { key: 'notify_inscripciones', label: 'Inscripciones', desc: 'Nueva escort registrada' },
  { key: 'notify_usuarios', label: 'Usuarios', desc: 'Nuevo usuario registrado' },
  { key: 'notify_pagos', label: 'Pagos / Planes', desc: 'Solicitud de plan, extra, VIP o comprobante' },
  { key: 'notify_verificaciones', label: 'Verificaciones', desc: 'Solicitud de verificación' },
  { key: 'notify_comentarios', label: 'Comentarios y valoraciones', desc: 'Comentario o valoración de un usuario' },
  { key: 'notify_favoritos', label: 'Favoritos', desc: 'Agregar o quitar de favoritos' },
  { key: 'notify_reportes', label: 'Reportes', desc: 'Nuevo reporte de escort/usuario' },
  { key: 'notify_contacto', label: 'Contacto', desc: 'Mensajes del formulario de contacto' },
  { key: 'notify_perfil', label: 'Perfil', desc: 'Escort actualizó su perfil' },
  { key: 'notify_fotos', label: 'Fotos', desc: 'Subir, cambiar portada, eliminar u ordenar fotos' },
  { key: 'notify_historias', label: 'Historias', desc: 'Publicar o eliminar una historia' },
  { key: 'notify_planes', label: 'Pausas', desc: 'Pausar o reactivar el plan' },
  { key: 'notify_disponibilidad', label: 'Disponibilidad', desc: 'Marcarse disponible / no disponible' },
  { key: 'notify_cuentas', label: 'Cuentas', desc: 'Escort eliminó su cuenta' },
  { key: 'notify_codigos', label: 'Códigos de verificación', desc: 'Generación de código por la escort' },
];

export default function NotificacionesData() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saved, setSaved] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [emails, setEmails] = useState('');
  const [toggles, setToggles] = useState<Record<string, boolean>>({});
  const [testEmail, setTestEmail] = useState('');
  const [lastSent, setLastSent] = useState('');

  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : '';

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch('/api/admin/email-notificaciones.php', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success && data.config) {
          setEmails(data.config.admin_notify_emails || '');
          setLastSent(data.config.admin_notify_last_sent || '');
          const initial: Record<string, boolean> = {};
          EVENTOS.forEach(ev => {
            const val = data.config[ev.key];
            initial[ev.key] = val === undefined || val === '' ? true : ['1', 'true', 'si', 'sí', 'on'].includes(String(val).toLowerCase());
          });
          setToggles(initial);
        }
      } catch {} finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved('');
    setErrorMsg('');
    try {
      const body: Record<string, string> = { admin_notify_emails: emails };
      EVENTOS.forEach(ev => {
        body[ev.key] = toggles[ev.key] ? '1' : '0';
      });
      const res = await fetch('/api/admin/email-notificaciones.php', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setSaved('Configuración guardada');
        setTimeout(() => setSaved(''), 3000);
      } else {
        setErrorMsg(data.error || 'Error al guardar');
      }
    } catch {
      setErrorMsg('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setErrorMsg('');
    setSaved('');
    try {
      const res = await fetch('/api/admin/email-notificaciones.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: testEmail.trim() || emails.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setSaved('Correo de prueba enviado');
        setTimeout(() => setSaved(''), 4000);
      } else {
        setErrorMsg(data.error || 'Error al enviar la prueba');
      }
    } catch {
      setErrorMsg('Error de conexión');
    } finally {
      setTesting(false);
    }
  };

  return (
    <>
      <div>
        <h1 className="text-2xl md:text-3xl font-bold mb-2">Notificaciones por Email</h1>
        <p className="text-admin-muted mb-8">Destino y eventos que se notifican por correo</p>

        {saved && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 mb-4 text-emerald-400 text-sm flex items-center gap-2 max-w-2xl">
            <i className="fas fa-check-circle"></i> {saved}
          </div>
        )}

        <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl p-6 max-w-2xl mb-8">
          <h3 className="text-white font-bold mb-1">Correos de destino</h3>
          <p className="text-xs text-gray-500 mb-4">Separados por coma. A estos correos llegarán todas las notificaciones de actividad.</p>
          {loading ? (
            <Skeleton height={42} className="w-full rounded-lg" />
          ) : (
            <input
              type="text"
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              placeholder="admin@example.com, otro@example.com"
              className="w-full bg-[#252538] border border-[#2a2a3e] rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
            />
          )}

          <div className="flex flex-wrap items-center gap-3 mt-5">
            <button onClick={handleSave} disabled={saving || loading}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
              {saving && <i className="fas fa-spinner fa-spin"></i>}
              <i className="fas fa-save"></i> Guardar
            </button>

            <div className="flex items-center gap-2">
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="correo para prueba (opcional)"
                className="bg-[#252538] border border-[#2a2a3e] rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 w-64"
              />
              <button onClick={handleTest} disabled={testing || loading}
                className="px-5 py-2.5 bg-[#2d2d44] hover:bg-[#3d3d5c] disabled:opacity-50 text-gray-300 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
                {testing && <i className="fas fa-spinner fa-spin"></i>}
                <i className="fas fa-paper-plane"></i> Enviar prueba
              </button>
            </div>
          </div>

          {lastSent && (
            <p className="text-xs text-gray-500 mt-3">
              Último envío registrado: <span className="text-gray-300">{lastSent}</span>
            </p>
          )}
        </div>

        <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl p-6 max-w-2xl">
          <h3 className="text-white font-bold mb-1">Eventos notificados</h3>
          <p className="text-xs text-gray-500 mb-4">Activa o desactiva cada tipo de notificación</p>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} height={52} className="w-full rounded-lg" />)}
            </div>
          ) : (
            <div className="space-y-2">
              {EVENTOS.map(ev => (
                <div key={ev.key} className="flex items-center gap-4 bg-[#252538] border border-[#2a2a3e] rounded-lg px-4 py-3">
                  <button
                    onClick={() => setToggles({ ...toggles, [ev.key]: !toggles[ev.key] })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 cursor-pointer ${toggles[ev.key] ? 'bg-emerald-500' : 'bg-gray-600'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${toggles[ev.key] ? 'translate-x-6' : 'translate-x-1'}`}></span>
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium">{ev.label}</div>
                    <div className="text-gray-500 text-xs">{ev.desc}</div>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-md ${toggles[ev.key] ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                    {toggles[ev.key] ? 'Activo' : 'Apagado'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

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
