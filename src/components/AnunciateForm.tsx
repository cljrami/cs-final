import { useState, useRef } from 'react';

const categorias = [
  { value: 'night_club', label: 'Night club' },
  { value: 'discoteca', label: 'Discoteca' },
  { value: 'sex_shop', label: 'Sex shop' },
  { value: 'bar', label: 'Bar' },
  { value: 'sauna', label: 'Sauna' },
  { value: 'otro', label: 'Otro' },
];

export default function AnunciateForm() {
  const [form, setForm] = useState({
    anunciante: '',
    categoria: 'night_club',
    contacto: '',
    web: '',
    titulo: '',
    texto: '',
    enlace_url: '',
  });
  const [imagenUrl, setImagenUrl] = useState('');
  const [preview, setPreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<{type:'ok'|'err', text:string} | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string,string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setMsg({type:'err', text:'Selecciona una imagen válida'});
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMsg({type:'err', text:'La imagen no debe pesar más de 5 MB'});
      return;
    }
    setUploading(true);
    setMsg(null);
    const fd = new FormData();
    fd.append('imagen', file);
    try {
      const res = await fetch('/api/banners/upload-public.php', { method:'POST', body:fd });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error al subir');
      setImagenUrl(data.url);
      setPreview(data.url);
    } catch (err:any) {
      setMsg({type:'err', text: err.message || 'Error al subir imagen'});
    } finally {
      setUploading(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setMsg(null);
    setFieldErrors({});
    try {
      const payload = {
        anunciante: form.anunciante.trim(),
        categoria: form.categoria,
        contacto: form.contacto.trim(),
        web: form.web.trim(),
        titulo: form.titulo.trim(),
        texto: form.texto.trim(),
        enlace_url: form.enlace_url.trim(),
        imagen_url: imagenUrl,
      };
      const res = await fetch('/api/banners/create-public.php', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!data.success) {
        if (data.fieldErrors) setFieldErrors(data.fieldErrors);
        throw new Error(data.error || 'Revisa los datos');
      }
      setMsg({type:'ok', text: data.message || 'Solicitud enviada'});
      setForm({ anunciante:'', categoria:'night_club', contacto:'', web:'', titulo:'', texto:'', enlace_url:'' });
      setImagenUrl('');
      setPreview('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err:any) {
      setMsg({type:'err', text: err.message || 'Error de conexión'});
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="grid sm:grid-cols-2 gap-5">
        <div className="space-y-2">
          <label className="block text-xs uppercase tracking-widest text-gray-400 font-semibold">Nombre del negocio *</label>
          <input value={form.anunciante} onChange={e=>setForm({...form, anunciante:e.target.value})} required className="w-full bg-[#0f0f15] border border-white/10 rounded-2xl px-4 py-3 text-white outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10 transition" placeholder="Ej: Night Club Divino" />
          {fieldErrors.anunciante && <p className="text-red-400 text-xs">{fieldErrors.anunciante}</p>}
        </div>
        <div className="space-y-2">
          <label className="block text-xs uppercase tracking-widest text-gray-400 font-semibold">Categoría</label>
          <select value={form.categoria} onChange={e=>setForm({...form, categoria:e.target.value})} className="w-full bg-[#0f0f15] border border-white/10 rounded-2xl px-4 py-3 text-white outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10 transition">
            {categorias.map(c=> <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        <div className="space-y-2">
          <label className="block text-xs uppercase tracking-widest text-gray-400 font-semibold">Whatsapp o email</label>
          <input value={form.contacto} onChange={e=>setForm({...form, contacto:e.target.value})} className="w-full bg-[#0f0f15] border border-white/10 rounded-2xl px-4 py-3 text-white outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10 transition" placeholder="+569xxxxxxx" />
          {fieldErrors.contacto && <p className="text-red-400 text-xs">{fieldErrors.contacto}</p>}
        </div>
        <div className="space-y-2">
          <label className="block text-xs uppercase tracking-widest text-gray-400 font-semibold">Sitio web</label>
          <input value={form.web} onChange={e=>setForm({...form, web:e.target.value})} placeholder="https://..." className="w-full bg-[#0f0f15] border border-white/10 rounded-2xl px-4 py-3 text-white outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10 transition" />
          {fieldErrors.web && <p className="text-red-400 text-xs">{fieldErrors.web}</p>}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        <div className="space-y-2">
          <label className="block text-xs uppercase tracking-widest text-gray-400 font-semibold">Título del aviso</label>
          <input value={form.titulo} onChange={e=>setForm({...form, titulo:e.target.value})} placeholder="Ej: Entrada liberada hoy" className="w-full bg-[#0f0f15] border border-white/10 rounded-2xl px-4 py-3 text-white outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10 transition" />
        </div>
        <div className="space-y-2">
          <label className="block text-xs uppercase tracking-widest text-gray-400 font-semibold">Enlace de destino</label>
          <input value={form.enlace_url} onChange={e=>setForm({...form, enlace_url:e.target.value})} placeholder="https://wa.me/569..." className="w-full bg-[#0f0f15] border border-white/10 rounded-2xl px-4 py-3 text-white outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10 transition" />
          {fieldErrors.enlace_url && <p className="text-red-400 text-xs">{fieldErrors.enlace_url}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-xs uppercase tracking-widest text-gray-400 font-semibold">Texto corto opcional</label>
        <input value={form.texto} onChange={e=>setForm({...form, texto:e.target.value})} placeholder="Ej: Opens 8PM - VIP" className="w-full bg-[#0f0f15] border border-white/10 rounded-2xl px-4 py-3 text-white outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10 transition" />
      </div>

      <div className="space-y-2">
        <label className="block text-xs uppercase tracking-widest text-gray-400 font-semibold">Imagen del banner * Máx 5 MB</label>
        <div onDragOver={e=>e.preventDefault()} onDrop={onDrop} onDragEnter={e=>e.preventDefault()} className="border-2 border-dashed border-white/15 rounded-[1.5rem] p-8 text-center bg-[#0f0f15] hover:border-red-500/50 transition group">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-3 group-hover:border-red-500/40 transition">
            <i className="fas fa-cloud-upload-alt text-gray-400 text-xl" />
          </div>
          <p className="text-sm text-gray-300">Arrastra tu imagen aquí o <button type="button" onClick={()=>fileInputRef.current?.click()} className="text-red-400 font-medium hover:underline">haz clic para seleccionar</button></p>
          <p className="text-xs text-gray-500 mt-1">PNG, JPG, WEBP, GIF • Máximo 5 MB</p>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onSelectFile} />
          {uploading && <p className="text-xs text-gray-400 mt-3">Subiendo...</p>}
          {preview && (
            <div className="mt-4 inline-flex items-center gap-3 p-2 rounded-2xl bg-white/5 border border-white/10">
              <img src={preview} alt="preview" className="h-14 w-auto rounded-xl border border-white/10 object-cover" />
              <button type="button" onClick={()=>{ setImagenUrl(''); setPreview(''); if(fileInputRef.current) fileInputRef.current.value=''; }} className="text-xs text-red-400 hover:underline">Quitar</button>
            </div>
          )}
        </div>
        {fieldErrors.imagen_url && <p className="text-red-400 text-xs">{fieldErrors.imagen_url}</p>}
      </div>

      <button disabled={sending || uploading} type="submit" className="w-full bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-600 disabled:opacity-60 text-white rounded-2xl py-4 font-semibold shadow-lg shadow-red-900/30 transition">
        <span className="inline-flex items-center justify-center gap-2">
          <i className="fas fa-paper-plane" />
          {sending ? 'Enviando...' : 'Enviar mi banner'}
        </span>
      </button>

      {msg && (
        <div className={`mt-2 p-3 rounded-2xl text-sm text-center ${msg.type==='ok' ? 'bg-green-500/10 border border-green-500/20 text-green-300' : 'bg-red-500/10 border border-red-500/20 text-red-300'}`}>{msg.text}</div>
      )}
    </form>
  );
}

