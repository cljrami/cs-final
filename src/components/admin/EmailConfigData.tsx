import { useEffect, useState, useRef } from 'react';
import { Skeleton } from '../ui/Skeleton';

interface EmailTemplate {
  id: number;
  codigo: string;
  nombre: string;
  asunto: string;
  cuerpo_html: string;
  variables_disponibles: string;
  updated_at: string;
}

export default function EmailConfigData() {
  const [config, setConfig] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [formFrom, setFormFrom] = useState('nocontestar@kimi.zona8.cl');
  const [formFromName, setFormFromName] = useState('Kimi - No responder');

  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [editModal, setEditModal] = useState<EmailTemplate | null>(null);
  const [editAsunto, setEditAsunto] = useState('');
  const [editCuerpo, setEditCuerpo] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : '';

  const mailHeader = (title: string) => `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{margin:0;padding:0;background-color:#0a0a0f;font-family:Arial,Helvetica,sans-serif}p{color:#9ca3af;font-size:15px;line-height:1.6;margin:0 0 12px 0}strong{color:#ffffff}a{color:#ef4444;text-decoration:none;font-weight:600}table.info{width:100%;background:#0f0f1a;border-radius:12px;padding:16px;margin:16px 0;border-collapse:collapse}table.info td{color:#9ca3af;padding:4px 0}table.info td:last-child{color:#ffffff;font-weight:600}ul,ol{color:#d1d5db;padding-left:20px;margin:12px 0}li{margin:4px 0}.btn{display:inline-block;background:linear-gradient(135deg,#ef4444,#dc2626);color:#ffffff;padding:14px 32px;border-radius:12px;text-decoration:none;font-weight:700;font-size:16px}.fallback{color:#6b7280;font-size:12px;word-break:break-all;margin:8px 0 0 0}.warning{color:#9ca3af;font-size:13px;margin:8px 0 0 0}.text-center{text-align:center}.text-green{color:#22c55e}.text-red{color:#ef4444}.text-amber{color:#fbbf24}</style></head><body style="margin:0;padding:0;background-color:#0a0a0f;font-family:Arial,Helvetica,sans-serif"><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px"><table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%"><tr><td style="background:#16161f;border-radius:16px;padding:40px;border:1px solid #2a2a3e"><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="text-align:center;padding-bottom:24px"><h1 style="color:#ffffff;font-size:24px;margin:0;font-weight:700">${title}</h1></td></tr><tr><td style="color:#9ca3af;font-size:15px;line-height:1.6">`;

  const mailFooter = () => `</td></tr></table></td></tr><tr><td style="text-align:center;padding-top:24px"><p style="color:#6b7280;font-size:12px;margin:0">&copy; 2026 Kimi. Todos los derechos reservados.<br>Si no solicitaste este correo, ignóralo.</p></td></tr></table></td></tr></table></body></html>`;

  useEffect(() => {
    fetchConfig();
    fetchTemplates();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/admin/email-config.php', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.config) {
        setFormFrom(data.config.email_from || 'nocontestar@kimi.zona8.cl');
        setFormFromName(data.config.email_from_name || 'Kimi - No responder');
        setConfig(data.config);
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    setTemplatesLoading(true);
    try {
      const res = await fetch('/api/admin/email-templates.php', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setTemplates(data.templates);
    } catch {} finally {
      setTemplatesLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    setSaved('');
    try {
      const res = await fetch('/api/admin/email-config.php', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email_from: formFrom, email_from_name: formFromName }),
      });
      const data = await res.json();
      if (data.success) {
        setSaved('Configuración guardada');
        setTimeout(() => setSaved(''), 3000);
      } else {
        setErrorMsg(data.error || 'Error');
      }
    } catch {
      setErrorMsg('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (tmpl: EmailTemplate) => {
    setEditModal(tmpl);
    setEditAsunto(tmpl.asunto);
    setEditCuerpo(tmpl.cuerpo_html);
    setShowPreview(false);
    setErrorMsg('');
  };

  const insertVar = (v: string) => {
    const ta = bodyRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const text = editCuerpo;
    setEditCuerpo(text.substring(0, start) + '{{' + v + '}}' + text.substring(end));
    setTimeout(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = start + v.length + 4;
    }, 0);
  };

  const handleSaveTemplate = async () => {
    if (!editModal) return;
    if (!editAsunto.trim()) { setErrorMsg('El asunto es requerido'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/email-templates.php', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: editModal.id, asunto: editAsunto, cuerpo_html: editCuerpo }),
      });
      const data = await res.json();
      if (data.success) {
        setSaved('Plantilla actualizada');
        setEditModal(null);
        fetchTemplates();
        setTimeout(() => setSaved(''), 3000);
      } else {
        setErrorMsg(data.error || 'Error');
      }
    } catch {
      setErrorMsg('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const renderPreview = () => {
    if (!editModal) return '';
    let body = editCuerpo;
    try {
      const vars = JSON.parse(editModal.variables_disponibles || '{}');
      Object.entries(vars).forEach(([key]) => {
        body = body.replace(new RegExp('\\{\\{' + key + '\\}\\}', 'g'), `<span style="color:#fbbf24;font-weight:600">[${key}]</span>`);
      });
    } catch {}
    return mailHeader(editAsunto) + body + mailFooter();
  };

  return (
    <>
      <div>
        <h1 className="text-2xl md:text-3xl font-bold mb-2">Configuración de Email</h1>
        <p className="text-admin-muted mb-8">Administra el remitente y las plantillas de correo</p>

        {saved && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 mb-4 text-emerald-400 text-sm flex items-center gap-2 max-w-2xl">
            <i className="fas fa-check-circle"></i> {saved}
          </div>
        )}

        {/* From config */}
        <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl p-6 max-w-2xl mb-8">
          <h3 className="text-white font-bold mb-1">Remitente</h3>
          <p className="text-xs text-gray-500 mb-4">Dirección y nombre que aparecen como remitente de los correos</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Dirección From</label>
              <input type="email" value={formFrom}
                onChange={(e) => setFormFrom(e.target.value)}
                className="w-full bg-[#252538] border border-[#2a2a3e] rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Nombre From</label>
              <input type="text" value={formFromName}
                onChange={(e) => setFormFromName(e.target.value)}
                className="w-full bg-[#252538] border border-[#2a2a3e] rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500" />
            </div>
          </div>
          <button onClick={handleSaveConfig} disabled={saving}
            className="mt-4 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
            {saving && <i className="fas fa-spinner fa-spin"></i>}
            <i className="fas fa-save"></i> Guardar
          </button>
        </div>

        {/* Templates */}
        <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl p-6 max-w-2xl">
          <h3 className="text-white font-bold mb-1">Plantillas de Correo</h3>
          <p className="text-xs text-gray-500 mb-4">Personaliza el asunto y contenido de cada tipo de correo</p>

          {templatesLoading ? (
            <div className="space-y-3">
              {[1,2,3,4].map(i => <Skeleton key={i} height={56} className="w-full rounded-lg" />)}
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8">
              <i className="fas fa-envelope-open text-gray-600 text-3xl mb-3"></i>
              <p className="text-gray-500 text-sm">No hay plantillas disponibles</p>
            </div>
          ) : (
            <div className="space-y-2">
              {templates.map(tmpl => (
                <div key={tmpl.id} className="bg-[#252538] border border-[#2a2a3e] rounded-lg p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                    <i className="fas fa-envelope text-blue-400"></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium truncate">{tmpl.nombre}</div>
                    <div className="text-gray-500 text-xs truncate">
                      <span className="text-gray-600 font-mono">{tmpl.codigo}</span>
                      <span className="mx-2">·</span>
                      {tmpl.asunto}
                    </div>
                  </div>
                  <button onClick={() => openEditModal(tmpl)}
                    className="px-3 py-1.5 bg-[#2d2d44] hover:bg-[#3d3d5c] text-gray-300 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5">
                    <i className="fas fa-edit"></i> Editar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 bg-black/70 backdrop-blur-sm" onClick={() => !saving && setEditModal(null)}>
          <div className="bg-[#1a1a2e] border border-[#2d2d44] rounded-2xl w-full max-w-3xl shadow-2xl p-6 max-h-[95vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-white">Editar Plantilla</h3>
                <p className="text-gray-500 text-sm">{editModal.nombre} <span className="text-gray-600 font-mono">({editModal.codigo})</span></p>
              </div>
              <button onClick={() => setEditModal(null)} className="w-8 h-8 rounded-lg hover:bg-[#252538] flex items-center justify-center text-gray-400 hover:text-white">
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Asunto del correo</label>
                <input type="text" value={editAsunto} onChange={(e) => setEditAsunto(e.target.value)}
                  className="w-full bg-[#252538] border border-[#2a2a3e] rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm text-gray-400">Cuerpo del correo</label>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setShowPreview(!showPreview)}
                      className={`px-3 py-1 text-xs rounded-lg transition-colors ${showPreview ? 'bg-blue-600 text-white' : 'bg-[#252538] text-gray-400 hover:text-white'}`}>
                      <i className="fas fa-eye mr-1"></i> Vista previa
                    </button>
                  </div>
                </div>

                {editModal.variables_disponibles && !showPreview && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {Object.entries(JSON.parse(editModal.variables_disponibles)).map(([key, val]) => (
                      <button key={key} onClick={() => insertVar(key)}
                        className="text-[11px] bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 px-2 py-0.5 rounded-md transition-colors cursor-pointer border border-blue-500/20">
                        <code>{'{{' + key + '}}'}</code>
                        <span className="text-gray-500 ml-1">— {val as string}</span>
                      </button>
                    ))}
                  </div>
                )}

                {showPreview ? (
                  <div className="bg-white rounded-lg overflow-hidden max-h-[50vh] overflow-y-auto">
                    <iframe
                      srcDoc={renderPreview()}
                      className="w-full h-[400px] border-0"
                      title="Vista previa"
                    />
                  </div>
                ) : (
                  <textarea ref={bodyRef} value={editCuerpo} onChange={(e) => setEditCuerpo(e.target.value)} rows={16}
                    className="w-full bg-[#252538] border border-[#2a2a3e] rounded-lg px-4 py-3 text-white text-xs font-mono leading-relaxed focus:outline-none focus:border-blue-500 resize-y" />
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditModal(null)}
                className="flex-1 px-4 py-2.5 bg-[#2d2d44] hover:bg-[#3d3d5c] text-white font-medium rounded-lg transition-colors text-sm">
                Cancelar
              </button>
              <button onClick={handleSaveTemplate} disabled={saving}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg transition-all shadow-lg shadow-blue-500/20 text-sm flex items-center justify-center gap-2">
                {saving && <i className="fas fa-spinner fa-spin"></i>}
                <i className="fas fa-save"></i> Guardar Plantilla
              </button>
            </div>
          </div>
        </div>
      )}

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
