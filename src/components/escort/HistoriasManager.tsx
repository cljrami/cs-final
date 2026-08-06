import { useState, useRef, useEffect } from 'react';
import ConfirmModal from '../ui/ConfirmModal';

interface Historia {
  id: number;
  url: string;
  tipo: 'imagen' | 'video';
  expiraEn: string;
  vistas: number;
}

interface UploadItem {
  tempId: string;
  name: string;
  tipo: string;
  progress: number;
}

const API_BASE = '/api/escort';

const MAX_IMG_SIZE = 10 * 1024 * 1024;
const MAX_VID_SIZE = 50 * 1024 * 1024;

const formatSize = (bytes: number) => bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;

const validateFile = (file: File): string | null => {
  const isVideo = file.type.startsWith('video/');
  const maxSize = isVideo ? MAX_VID_SIZE : MAX_IMG_SIZE;
  const label = isVideo ? 'video' : 'imagen';
  if (file.size > maxSize) {
    return `No se puede subir este ${label} (${formatSize(file.size)}). El límite es ${isVideo ? '50 MB' : '10 MB'}.`;
  }
  return null;
};

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('escort_token') || '';
  return {
    'Authorization': `Bearer ${token}`
  };
}

function getTiempoRestante(expiraEn: string): string {
  const diff = new Date(expiraEn).getTime() - Date.now();
  const horas = Math.floor(diff / (1000 * 60 * 60));
  if (horas > 0) return `${horas}h restantes`;
  const minutos = Math.floor(diff / (1000 * 60));
  return `${minutos}m restantes`;
}

export default function HistoriasManager() {
  const [historias, setHistorias] = useState<Historia[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [maxVideos, setMaxVideos] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fotoPrincipal, setFotoPrincipal] = useState('');

  const fetchHistorias = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/historias/listar.php`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error('Error al cargar historias');
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error');
      setHistorias(data.historias || []);
      if (data.maxVideos !== undefined) setMaxVideos(data.maxVideos);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchPerfil = async () => {
    try {
      const res = await fetch(`${API_BASE}/datos/perfil.php`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success && data.foto_principal) {
        setFotoPrincipal(data.foto_principal);
      }
    } catch {}
  };

  useEffect(() => {
    fetchHistorias();
    fetchPerfil();
    const interval = setInterval(fetchHistorias, 60000);
    return () => clearInterval(interval);
  }, []);

  const uploadFile = async (file: File): Promise<void> => {
    const isVideo = file.type.startsWith('video/');
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    const tempId = `upload_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    setUploads(prev => [...prev, {
      tempId,
      name: file.name,
      tipo: isVideo ? 'video' : 'imagen',
      progress: 0
    }]);

    const formData = new FormData();
    formData.append('historias[]', file);

    try {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE}/historias/upload.php`);
      xhr.setRequestHeader('Authorization', getAuthHeaders()['Authorization']);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          setUploads(prev => prev.map(u => u.tempId === tempId ? { ...u, progress: pct } : u));
        }
      };

      const result = await new Promise<any>((resolve, reject) => {
        xhr.onload = () => {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch {
            reject(new Error(xhr.status === 413
              ? 'No se puede subir. El archivo supera los límites de tamaño del servidor.'
              : 'No se puede subir. El archivo podría ser demasiado grande o el servidor no responde.'
            ));
          }
        };
        xhr.onerror = () => reject(new Error('Error de red'));
        xhr.send(formData);
      });

      setUploads(prev => prev.filter(u => u.tempId !== tempId));

      if (!result.success) {
        setError(result.error || 'Error al subir');
        return;
      }

      if (result.historias?.length) {
        setHistorias(prev => [...prev, ...result.historias]);
        setSuccessMsg(result.historias[0].tipo === 'video' ? 'Video subido a historia' : 'Foto subida a historia');
        setTimeout(() => setSuccessMsg(''), 2000);
      }
    } catch (err: any) {
      setUploads(prev => prev.filter(u => u.tempId !== tempId));
      setError(err.message);
    }
  };

  const handleFiles = (files: FileList) => {
    if (maxVideos <= 0) {
      setError('Tu plan no incluye historias. Actualiza tu plan para subir contenido.');
      return;
    }
    const espacioLibre = maxVideos - historias.length;
    if (espacioLibre <= 0) {
      setError(`Límite de ${maxVideos} historias activas alcanzado. Actualiza tu plan.`);
      return;
    }
    const toUpload = Array.from(files).slice(0, espacioLibre);
    toUpload.forEach(f => uploadFile(f));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      handleFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files?.length) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const confirmEliminar = (id: number) => setDeleteId(id);

  const ejecutarEliminar = async () => {
    if (deleteId === null) return;
    const id = deleteId;
    setDeleteId(null);
    try {
      const res = await fetch(`${API_BASE}/historias/eliminar.php?id=${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setHistorias(prev => prev.filter(h => h.id !== id));
      setSuccessMsg('Historia eliminada');
      setTimeout(() => setSuccessMsg(''), 2000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const espacioLibre = maxVideos - historias.length;

  return (
    <div className="space-y-6" onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <i className="fas fa-history text-red-500"></i>
          Mis Historias
        </h1>
        <p className="text-gray-500 mt-1">Contenido temporal de 24 horas</p>
      </div>

      {successMsg && (
        <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-xl flex items-center gap-2 animate-pulse">
          <i className="fas fa-check-circle"></i>{successMsg}
        </div>
      )}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl flex items-center gap-2">
          <i className="fas fa-exclamation-triangle"></i>{error}
          <button onClick={() => setError('')} className="ml-auto text-red-400/70 hover:text-red-400">
            <i className="fas fa-times"></i>
          </button>
        </div>
      )}

      <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl p-5">
          <p className="text-gray-400 text-sm font-medium mb-4 flex items-center gap-2">
            <i className="fas fa-eye text-blue-400"></i>
            Así te verán tus clientes
          </p>
          <div className="flex items-center gap-4 overflow-x-auto pb-2 scrollbar-thin">
            <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 p-0.5 cursor-pointer hover:scale-105 transition-transform">
                <div className="w-full h-full rounded-full bg-[#1a1a2e] flex items-center justify-center overflow-hidden">
                  {fotoPrincipal ? (
                    <img src={fotoPrincipal} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <i className="fas fa-user text-gray-500 text-lg"></i>
                  )}
                </div>
              </div>
              <span className="text-[10px] text-gray-500 whitespace-nowrap">Tu perfil</span>
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center gap-1.5 flex-shrink-0 group"
            >
              <div className="w-16 h-16 rounded-full border-2 border-dashed border-gray-600 hover:border-red-500/60 flex items-center justify-center group-hover:bg-red-500/5 transition-all">
                <i className="fas fa-plus text-gray-500 group-hover:text-red-400 text-xl transition-colors"></i>
              </div>
              <span className="text-[10px] text-gray-600 group-hover:text-gray-400 whitespace-nowrap transition-colors">Agregar</span>
            </button>

            {historias.map((h) => (
              <div key={h.id} className="flex flex-col items-center gap-1.5 flex-shrink-0 group">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-500 to-orange-500 p-0.5 cursor-pointer hover:scale-105 transition-transform relative">
                  <div className="w-full h-full rounded-full overflow-hidden bg-[#1a1a2e]">
                    {h.tipo === 'video' ? (
                      <div className="w-full h-full flex items-center justify-center bg-gray-800">
                        <i className="fas fa-play text-white/70 text-lg"></i>
                      </div>
                    ) : (
                      <img src={h.url} alt="" className="w-full h-full object-cover" />
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-gray-500 whitespace-nowrap">
                    {h.tipo === 'video' ? 'Video' : 'Foto'}
                  </span>
                  <span className="text-[9px] text-gray-600">{h.vistas} vis.</span>
                </div>
              </div>
            ))}

            {historias.length === 0 && (
              <div className="text-gray-600 text-xs flex items-center gap-2 py-4">
                <i className="fas fa-arrow-left text-lg"></i>
                Agrega tu primera historia
              </div>
            )}
          </div>
        </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-medium flex items-center gap-3">
            <i className="fas fa-layer-group text-red-400"></i>
            <span><i className="fas fa-image text-blue-400 mr-1 text-xs"></i>{historias.filter(h => h.tipo !== 'video').length} fotos</span>
            <span className="text-gray-600">|</span>
            <span><i className="fas fa-video text-red-400 mr-1 text-xs"></i>{historias.filter(h => h.tipo === 'video').length} videos</span>
              <span className="text-gray-500 text-xs ml-1">/ {maxVideos || 0}</span>
            </h3>
            <span className="text-gray-500 text-sm">
              {historias.length > 0 ? (
                <span className="flex items-center gap-1">
                  <i className="fas fa-circle text-[8px] text-green-500"></i>
                  Historia activa
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <i className="fas fa-circle text-[8px] text-gray-600"></i>
                  Sin historia activa
                </span>
              )}
            </span>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/avif,image/gif,image/bmp,video/mp4,video/webm,video/quicktime"
              onChange={handleInputChange}
              className="hidden"
            />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-[9/16] rounded-2xl bg-gray-800 animate-pulse" />
            ))
          ) : historias.length === 0 && uploads.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-20 text-gray-500">
              <i className="fas fa-history text-6xl mb-4 opacity-20"></i>
              <p className="text-lg">Tu historia está vacía</p>
              <p className="text-sm mt-1">Agrega contenido temporal de 24 horas</p>
            </div>
          ) : (
            <>
            {uploads.map((u) => (
              <div key={u.tempId} className="relative aspect-[9/16] rounded-2xl overflow-hidden bg-gray-800/80 border border-gray-700/50">
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <i className={`fas ${u.tipo === 'video' ? 'fa-video' : 'fa-image'} text-gray-500 text-2xl`}></i>
                  <p className="text-gray-500 text-xs text-center px-2 truncate max-w-full">{u.name}</p>
                  <div className="w-4/5 bg-gray-700 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full bg-red-500 rounded-full transition-all duration-300"
                      style={{ width: `${u.progress}%` }}
                    />
                  </div>
                  <span className="text-gray-400 text-xs">{u.progress}%</span>
                </div>
              </div>
            ))}

            {historias.map((h) => (
              <div key={h.id} className="relative aspect-[9/16] rounded-2xl overflow-hidden group bg-gray-800 border border-gray-800 hover:border-gray-700 transition-all">
                {h.tipo === 'video' ? (
                  <video
                    src={h.url}
                    className="w-full h-full object-cover"
                    muted
                    loop
                    playsInline
                    onMouseEnter={(e) => e.currentTarget.play()}
                    onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                  />
                ) : (
                  <img src={h.url} alt="" className="w-full h-full object-cover" />
                )}

                <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm rounded-full px-2.5 py-1 flex items-center gap-1.5">
                  <i className={`fas ${h.tipo === 'video' ? 'fa-video text-red-400' : 'fa-image text-blue-400'} text-xs`}></i>
                  <span className="text-white text-xs capitalize">{h.tipo}</span>
                </div>

                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300">
                  <div className="absolute bottom-0 left-0 right-0 p-3 flex items-center justify-between">
                    <div>
                      <p className="text-green-400 text-xs font-medium flex items-center gap-1">
                        <i className="fas fa-clock"></i>
                        {getTiempoRestante(h.expiraEn)}
                      </p>
                      <p className="text-gray-400 text-xs flex items-center gap-1 mt-1">
                        <i className="fas fa-eye"></i>
                        {h.vistas} vistas
                      </p>
                    </div>
                    <button
                      onClick={() => confirmEliminar(h.id)}
                      className="w-9 h-9 rounded-full bg-red-500/80 hover:bg-red-500 text-white flex items-center justify-center transition-all"
                      title="Eliminar"
                    >
                      <i className="fas fa-trash-alt text-sm"></i>
                    </button>
                  </div>
                </div>

                <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1">
                  <i className="fas fa-eye text-white/70 text-[10px]"></i>
                  <span className="text-white text-[10px] font-medium">{h.vistas}</span>
                </div>

                <button
                  onClick={() => confirmEliminar(h.id)}
                  className="absolute bottom-3 right-3 md:hidden w-9 h-9 rounded-full bg-red-500/80 hover:bg-red-500 active:bg-red-500 text-white flex items-center justify-center transition-all z-10"
                  title="Eliminar"
                >
                  <i className="fas fa-trash-alt text-sm"></i>
                </button>
              </div>
            ))}

            {espacioLibre > 0 && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="relative aspect-[9/16] rounded-2xl border-2 border-dashed border-gray-700 hover:border-red-500/60 hover:bg-red-500/5 transition-all duration-300 flex flex-col items-center justify-center gap-2 group"
              >
                <div className="w-14 h-14 rounded-full bg-gray-800 group-hover:bg-red-500/20 flex items-center justify-center group-hover:scale-110 transition-all">
                  <i className="fas fa-plus text-gray-500 group-hover:text-red-400 text-2xl transition-colors"></i>
                </div>
                <span className="text-gray-500 group-hover:text-gray-300 text-sm font-medium transition-colors">Agregar</span>
                <span className="text-gray-600 text-xs">Fotos y videos</span>
              </button>
            )}
            </>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={deleteId !== null}
        title="Eliminar historia"
        message="¿Eliminar esta historia permanentemente?"
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
        onConfirm={ejecutarEliminar}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
