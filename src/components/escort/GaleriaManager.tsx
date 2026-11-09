import { useState, useRef, useEffect, useCallback } from 'react';
import Sortable from 'sortablejs';
import ConfirmModal from '../ui/ConfirmModal';
import { Skeleton } from '../ui/Skeleton';
import { videoSrcToGif, uploadGifBlob } from '../../lib/gifUtils';
import AudioUploader from './AudioUploader';
import { showToast } from '../ui/Toast';
import '@fancyapps/ui/dist/fancybox/fancybox.css';

interface Foto {
  id: number;
  url: string;
  tipo?: string;
  esPortada: number;
  orden: number;
  gif_url?: string | null;
}

interface UploadItem {
  tempId: string;
  name: string;
  tipo: string;
  progress: number;
}

const API_BASE = '/api/escort';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('escort_token') || '';
  return {
    'Authorization': `Bearer ${token}`
  };
}

let Fancybox: any = null;

export default function GaleriaManager() {
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [successMsg] = useState('');
  const setSuccessMsg = (m: string) => showToast(m);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [maxFotos, setMaxFotos] = useState(5);
  const [maxVideos, setMaxVideos] = useState(0);
  const [permiteAudio, setPermiteAudio] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [gifProgress, setGifProgress] = useState(0);
  const [gifModalOpen, setGifModalOpen] = useState(false);
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const esTactil = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      import('@fancyapps/ui').then((mod: any) => {
        Fancybox = mod.Fancybox || mod.default;
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    fetchFotos();
  }, []);

  const fetchAudioPreview = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/fotos/upload-audio.php`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.success) setCurrentAudioUrl(data.url ?? null);
    } catch {
      setCurrentAudioUrl(null);
    }
  }, []);

  useEffect(() => {
    fetchAudioPreview();
  }, [fetchAudioPreview]);

  useEffect(() => {
    if (!esTactil || !gridRef.current || fotos.length < 2) return;

    const sortable = Sortable.create(gridRef.current, {
      draggable: '.foto-card',
      animation: 200,
      forceFallback: true,
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      dragClass: 'sortable-drag',
      filter: '.no-drag',
      preventOnFilter: true,
      onEnd: () => {
        if (!gridRef.current) return;
        const cards = Array.from(gridRef.current.querySelectorAll<HTMLElement>('.foto-card'));
        const ordered = cards
          .map(card => Number(card.dataset.fotoId))
          .map((id, index) => ({ id, orden: index }));
        setFotos(prev => {
          const orderMap = new Map(ordered.map(f => [f.id, f.orden]));
          return prev.map(f => ({ ...f, orden: orderMap.get(f.id) ?? f.orden }));
        });
        guardarOrden(ordered);
      }
    });

    return () => sortable.destroy();
  }, [esTactil, fotos.length]);

  const guardarOrden = async (fotosOrdenadas: { id: number; orden: number }[]) => {
    try {
      await fetch(`${API_BASE}/fotos/ordenar.php`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ fotos: fotosOrdenadas })
      });
    } catch (err) {
      console.error('Error guardando orden:', err);
    }
  };

  const fetchFotos = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/fotos/listar.php`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setFotos(data.fotos || []);
      if (data.maxFotos !== undefined) setMaxFotos(data.maxFotos);
      if (data.maxVideos !== undefined) setMaxVideos(data.maxVideos);
      if (data.permiteAudio !== undefined) setPermiteAudio(data.permiteAudio);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const uploadFile = async (file: File): Promise<void> => {
    const isVideo = file.type.startsWith('video/');
    const tempId = `upload_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    setUploads(prev => [...prev, {
      tempId,
      name: file.name,
      tipo: isVideo ? 'video' : 'imagen',
      progress: 0
    }]);

    const formData = new FormData();
    formData.append('fotos[]', file);

    try {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE}/fotos/upload.php`);
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
          } catch { reject(new Error('Error del servidor')); }
        };
        xhr.onerror = () => reject(new Error('Error de red'));
        xhr.send(formData);
      });

      setUploads(prev => prev.filter(u => u.tempId !== tempId));

      if (!result.success) {
        setError(result.error || 'Error al subir');
        return;
      }

      if (result.duplicados > 0) {
        setError('Foto duplicada ignorada');
        return;
      }

      if (result.fotos?.length) {
        const newFotos = result.fotos;
        setFotos(prev => [...prev, ...newFotos]);
        setSuccessMsg(newFotos[0].tipo === 'video' ? 'Video subido' : 'Foto subida');
        // Generar GIF de preview automáticamente para videos
        if (newFotos[0].tipo === 'video') {
          const fotoVideo = newFotos[0];
          (async () => {
            try {
              setGifProgress(10);
              const gifResult = await videoSrcToGif(fotoVideo.url, 'gif_preview.gif', {
                onProgress: (pct) => setGifProgress(pct)
              });
              setGifProgress(0);
              const token = localStorage.getItem('escort_token') || '';
              const uploadRes = await uploadGifBlob(gifResult.blob, token, fotoVideo.id);
              if (uploadRes.success && uploadRes.url) {
                setFotos(prev => prev.map(f => f.id === fotoVideo.id ? { ...f, gif_url: uploadRes.url } : f));
              }
              setTimeout(() => URL.revokeObjectURL(gifResult.url), 5000);
            } catch (e) {
              console.error('Error generando GIF preview', e);
              setGifProgress(0);
            }
          })();
        }
        setTimeout(() => setSuccessMsg(''), 2000);
      }
    } catch (err: any) {
      setUploads(prev => prev.filter(u => u.tempId !== tempId));
      setError(err.message);
    }
  };

  const fotosReales = fotos.filter(f => f.tipo === 'imagen');
  const videosReales = fotos.filter(f => f.tipo === 'video');

  const libreFotos = Math.max(0, maxFotos - fotosReales.length);
  const libreVideos = maxVideos > 0 ? Math.max(0, maxVideos - videosReales.length) : 0;

  const MAX_IMG_MB = 10;
  const MAX_VIDEO_MB = 50;

  const handleFiles = (files: FileList) => {
    const items = Array.from(files);
    const fotosSeleccionadas = items.filter(f => f.type.startsWith('image/'));
    const videosSeleccionados = items.filter(f => f.type.startsWith('video/'));
    const archivosInvalidos = items.filter(f => !f.type.startsWith('image/') && !f.type.startsWith('video/'));

    let pendientes: File[] = [];

    // Validar archivos con extensión/formato inválido
    if (archivosInvalidos.length > 0) {
      archivosInvalidos.forEach(f => {
        showToast(`Formato no permitido: ${f.name}`, 'error');
      });
    }

    // Validar y filtrar fotos por tamaño y cupo
    const fotosValidas: File[] = [];
    if (fotosSeleccionadas.length > 0) {
      if (libreFotos <= 0) {
        showToast('Límite de fotos alcanzado. Actualiza tu plan.', 'error');
      } else {
        fotosSeleccionadas.slice(0, libreFotos).forEach(f => {
          const maxBytes = MAX_IMG_MB * 1024 * 1024;
          if (f.size > maxBytes) {
            showToast(`La imagen supera los ${MAX_IMG_MB} MB: ${f.name}`, 'error');
          } else {
            fotosValidas.push(f);
          }
        });
      }
    }

    // Validar y filtrar videos por tamaño y cupo
    const videosValidos: File[] = [];
    if (videosSeleccionados.length > 0) {
      if (maxVideos <= 0) {
        showToast('Tu plan no incluye videos.', 'error');
      } else if (libreVideos <= 0) {
        showToast('Límite de videos alcanzado. Actualiza tu plan.', 'error');
      } else {
        videosSeleccionados.slice(0, libreVideos).forEach(f => {
          const maxBytes = MAX_VIDEO_MB * 1024 * 1024;
          if (f.size > maxBytes) {
            showToast(`El video supera los ${MAX_VIDEO_MB} MB: ${f.name}`, 'error');
          } else {
            videosValidos.push(f);
          }
        });
      }
    }

    pendientes = [...fotosValidas, ...videosValidos];

    if (pendientes.length) pendientes.forEach(f => uploadFile(f));
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

  const setPortada = async (id: number) => {
    const foto = fotos.find(f => f.id === id);
    let gifUrl: string | null = null;

    try {
      if (foto && foto.tipo === 'video') {
        setError('');
        setGifModalOpen(true);
        setGifProgress(10);
        const gifResult = await videoSrcToGif(foto.url, 'gif_portada.gif', {
          onProgress: (pct) => setGifProgress(pct)
        });
        setGifProgress(100);
        const token = localStorage.getItem('escort_token') || '';
        const uploadRes = await uploadGifBlob(gifResult.blob, token, id);
        if (!uploadRes.success || !uploadRes.url) {
          throw new Error(uploadRes.error || 'Error subiendo GIF');
        }
        gifUrl = uploadRes.url;
        setTimeout(() => URL.revokeObjectURL(gifResult.url), 5000);
      }

      const payload: { fotoId: number; gifUrl?: string } = { fotoId: id };
      if (gifUrl) payload.gifUrl = gifUrl;

      const res = await fetch(`${API_BASE}/fotos/portada.php`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await res.text();
        throw new Error(`Servidor error (${res.status}): ${text.slice(0, 200)}`);
      }

      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      setFotos(prev => prev.map(f => ({
        ...f,
        esPortada: f.id === id ? 1 : 0,
        gif_url: f.id === id ? (gifUrl || f.gif_url) : f.gif_url
      })));
      fetchFotos();
      setSuccessMsg(foto?.tipo === 'video' ? 'Portada animada actualizada' : 'Portada actualizada');
      setTimeout(() => { setSuccessMsg(''); setGifProgress(0); setGifModalOpen(false); }, 1500);
    } catch (err: any) {
      setError(err.message);
      setGifProgress(0);
      setGifModalOpen(false);
    }
  };

  const confirmEliminar = (id: number) => setDeleteId(id);

  const eliminarFoto = async () => {
    if (deleteId === null) return;
    const id = deleteId;
    setDeleteId(null);
    try {
      const res = await fetch(`${API_BASE}/fotos/eliminar.php?id=${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setFotos(prev => prev.filter(f => f.id !== id));
      setSuccessMsg('Eliminado');
      setTimeout(() => setSuccessMsg(''), 2000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDragStart = (e: React.DragEvent, id: number) => {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, id: number) => {
    e.preventDefault();
    if (id !== draggingId) setDragOverId(id);
  };

  const handleDragLeave = () => setDragOverId(null);

  const handleDropReorder = async (e: React.DragEvent, targetId: number) => {
    e.preventDefault();
    if (draggingId === null || draggingId === targetId) {
      setDraggingId(null);
      setDragOverId(null);
      return;
    }
    const newFotos = [...fotos];
    const dragIndex = newFotos.findIndex(f => f.id === draggingId);
    const dropIndex = newFotos.findIndex(f => f.id === targetId);
    const [removed] = newFotos.splice(dragIndex, 1);
    newFotos.splice(dropIndex, 0, removed);
    const updated = newFotos.map((f, i) => ({ ...f, orden: i }));
    setFotos(updated);
    setDraggingId(null);
    setDragOverId(null);
    guardarOrden(updated.map(f => ({ id: f.id, orden: f.orden })));
  };

  const openFancybox = (index: number) => {
    if (Fancybox && typeof window !== 'undefined') {
      const items = fotos.map(f => ({
        src: f.url,
        type: f.tipo === 'video' ? 'video' : 'image',
        poster: f.gif_url || undefined,
      }));
      Fancybox.show(items, { startIndex: index, Thumbs: false });
    }
  };

  return (
    <div className="space-y-6" onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}>
      <style>{`
        .sortable-ghost {
          opacity: 0.5;
          transform: scale(0.95) rotate(2deg);
        }
        .sortable-chosen {
          opacity: 0.6;
        }
      `}</style>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <i className="fas fa-images text-red-500"></i>
          Mi Galería
        </h1>
        <p className="text-gray-500 mt-1">Fotos y videos • Arrastra para ordenar</p>
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

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} borderRadius="1rem" />
          ))}
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h3 className="text-white font-medium flex items-center gap-2">
              <i className="fas fa-layer-group text-red-400"></i>
              Galería
            </h3>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-gray-300">
                <i className="fas fa-image text-gray-500 mr-1.5"></i>
                {fotosReales.length} / {maxFotos} fotos
              </span>
              <span className="text-gray-300">
                <i className="fas fa-video text-gray-500 mr-1.5"></i>
                {videosReales.length} / {maxVideos || 0} videos
              </span>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/avif,image/gif,image/bmp,video/mp4,video/webm,video/quicktime"
            onChange={handleInputChange}
            className="hidden"
          />

          <div ref={gridRef} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {uploads.map((u) => (
              <div key={u.tempId} className="relative aspect-3/4 rounded-2xl overflow-hidden bg-gray-800/80 border border-gray-700/50">
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

            {fotos.map((foto, index) => (
              <div
                key={foto.id}
                data-foto-id={foto.id}
                {...(!esTactil ? {
                  draggable: true,
                  onDragStart: (e) => handleDragStart(e, foto.id),
                  onDragOver: (e) => handleDragOver(e, foto.id),
                  onDragLeave: handleDragLeave,
                  onDrop: (e) => handleDropReorder(e, foto.id)
                } : {})}
                className={`foto-card relative aspect-3/4 rounded-2xl overflow-hidden group transition-all duration-300 ${
                  !esTactil ? 'cursor-move' : 'cursor-default'
                } ${!esTactil && draggingId === foto.id ? 'opacity-50 scale-95 rotate-2' : ''
                } ${!esTactil && dragOverId === foto.id && dragOverId !== draggingId ? 'scale-105 ring-2 ring-red-500' : ''} ${
                  foto.esPortada ? 'ring-2 ring-yellow-500' : ''
                }`}
              >
                {foto.tipo === 'video' ? (
                  <div className="relative w-full h-full cursor-pointer" onClick={() => openFancybox(index)}>
                    {foto.gif_url ? (
                      <img src={foto.gif_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                        <i className="fas fa-play-circle text-white text-5xl opacity-60"></i>
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <i className="fas fa-play-circle text-white text-5xl drop-shadow-lg opacity-80"></i>
                    </div>
                  </div>
                ) : (
                  <img
                    src={foto.url}
                    alt=""
                    className="w-full h-full object-cover cursor-pointer"
                    onClick={() => openFancybox(index)}
                  />
                )}

                {foto.tipo === 'video' && (
                  <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm rounded-full px-2.5 py-1 flex items-center gap-1.5">
                    <i className="fas fa-video text-red-400 text-xs"></i>
                    <span className="text-white text-xs">Video</span>
                  </div>
                )}

                <div className={`absolute inset-0 bg-linear-to-t from-black/80 via-transparent to-transparent transition-opacity duration-300 ${
                  esTactil ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}>
                  <div className="absolute bottom-0 left-0 right-0 p-3 flex items-center justify-between">
                    <button
                      onClick={(e) => { e.stopPropagation(); setPortada(foto.id); }}
                      className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                        foto.esPortada
                          ? 'bg-yellow-500 text-black'
                          : 'bg-white/20 hover:bg-yellow-500/80 text-white hover:text-black'
                      }`}
                      title={foto.esPortada ? 'Portada actual' : 'Establecer como portada'}
                    >
                      <i className={`fas ${foto.esPortada ? 'fa-star' : 'fa-regular fa-star'}`}></i>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); confirmEliminar(foto.id); }}
                      className="w-9 h-9 rounded-full bg-red-500/80 hover:bg-red-500 text-white flex items-center justify-center transition-all"
                      title="Eliminar"
                    >
                      <i className="fas fa-trash-alt text-sm"></i>
                    </button>
                  </div>
                  {foto.esPortada ? (
                    <div className="absolute top-3 right-3 bg-yellow-500 text-black text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                      <i className="fas fa-star text-[10px]"></i>
                      PORTADA
                    </div>
                  ) : null}
                  <div className="absolute top-3 right-3 w-7 h-7 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center text-white text-xs font-medium">
                    {foto.orden + 1}
                  </div>
                </div>
              </div>
            ))}

            {libreFotos > 0 && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="relative aspect-3/4 rounded-2xl border-2 border-dashed border-gray-700 hover:border-red-500/60 hover:bg-red-500/5 transition-all duration-300 flex flex-col items-center justify-center gap-2 group"
              >
                <div className="w-14 h-14 rounded-full bg-gray-800 group-hover:bg-red-500/20 flex items-center justify-center group-hover:scale-110 transition-all">
                  <i className="fas fa-plus text-gray-500 group-hover:text-red-400 text-2xl transition-colors"></i>
                </div>
                <span className="text-gray-500 group-hover:text-gray-300 text-sm font-medium transition-colors">Agregar</span>
                <span className="text-gray-600 text-xs">
                  {libreFotos} foto{libreFotos === 1 ? '' : 's'} · {maxVideos > 0 ? `${libreVideos} video${libreVideos === 1 ? '' : 's'}` : 'sin videos'}
                </span>
              </button>
            )}
          </div>

          {fotos.length === 0 && uploads.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-gray-500">
              <i className="fas fa-images text-6xl mb-4 opacity-20"></i>
              <p className="text-lg">Tu galería está vacía</p>
              <p className="text-sm mt-1">Agrega fotos y videos para mostrar tu perfil</p>
            </div>
          )}
        </div>
      )}

      <ConfirmModal
        isOpen={deleteId !== null}
        title="Eliminar"
        message="Eliminar este archivo permanentemente?"
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
        onConfirm={eliminarFoto}
        onCancel={() => setDeleteId(null)}
      />

      {gifModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70">
          <div className="w-full max-w-md bg-[#1a1a24] border border-white/10 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <i className="fas fa-magic text-blue-400 text-xl"></i>
              <h3 className="text-lg font-semibold text-white">Generando portada animada</h3>
            </div>
            <p className="text-gray-300 mb-4">Generando portada animada (GIF)… {gifProgress}%</p>
            <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${gifProgress}%` }} />
            </div>
            <p className="text-xs text-gray-500 mt-3">Espere, este proceso es obligatorio.</p>
          </div>
        </div>
      )}

      <AudioUploader
        currentAudioUrl={currentAudioUrl}
        onAudioUpdate={(url) => {
          setCurrentAudioUrl(url);
          if (!url) fetchAudioPreview();
        }}
        disabled={!permiteAudio}
      />
      {!permiteAudio && (
        <div className="mt-2 text-xs text-red-400/80 bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2 flex items-start gap-2">
          <i className="fas fa-ban mt-0.5 flex-shrink-0" />
          <span>Este plan no incluye audio de presentación. Contrata un plan que lo permita en <a href="/micuenta/mi-plan" className="text-red-300 underline decoration-red-400/50">Mi Plan</a>.</span>
        </div>
      )}
    </div>
  );
}
