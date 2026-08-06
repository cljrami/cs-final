import { useState, useRef, useEffect } from 'react';
import Sortable from 'sortablejs';
import ConfirmModal from '../ui/ConfirmModal';

interface Foto {
  id: number;
  url: string;
  tipo?: string;
  esPortada: number;
  orden: number;
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
  const [successMsg, setSuccessMsg] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [maxFotos, setMaxFotos] = useState(5);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
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

  useEffect(() => {
    if (!esTactil || !gridRef.current || fotos.length < 2) return;

    const sortable = Sortable.create(gridRef.current, {
      draggable: '.foto-card',
      animation: 200,
      forceFallback: true,
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      dragClass: 'sortable-drag',
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
        setFotos(prev => [...prev, ...result.fotos]);
        setSuccessMsg(result.fotos[0].tipo === 'video' ? 'Video subido' : 'Foto subida');
        setTimeout(() => setSuccessMsg(''), 2000);
      }
    } catch (err: any) {
      setUploads(prev => prev.filter(u => u.tempId !== tempId));
      setError(err.message);
    }
  };

  const handleFiles = (files: FileList) => {
    const espacioLibre = maxFotos - fotos.length;
    if (espacioLibre <= 0) {
      setError(`Límite de ${maxFotos} archivos alcanzado. Actualiza tu plan.`);
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

  const setPortada = async (id: number) => {
    try {
      const res = await fetch(`${API_BASE}/fotos/portada.php`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fotoId: id })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setFotos(prev => prev.map(f => ({ ...f, esPortada: f.id === id ? 1 : 0 })));
      setSuccessMsg('Portada actualizada');
      setTimeout(() => setSuccessMsg(''), 2000);
    } catch (err: any) {
      setError(err.message);
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
      const items = fotos.map(f => ({ src: f.url }));
      Fancybox.show(items, { startIndex: index, Thumbs: { autoStart: false } });
    }
  };

  const espacioLibre = maxFotos - fotos.length;

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
            <div key={i} className="aspect-3/4 rounded-2xl bg-gray-800 animate-pulse" />
          ))}
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-medium flex items-center gap-2">
              <i className="fas fa-layer-group text-red-400"></i>
              {fotos.length} / {maxFotos}
            </h3>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/avif,image/gif,image/bmp,video/mp4,video/webm,video/quicktime"
              onChange={handleInputChange}
              className="hidden"
            />
          </div>

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
                className={`foto-card relative aspect-3/4 rounded-2xl overflow-hidden group cursor-move transition-all duration-300 ${
                  !esTactil && draggingId === foto.id ? 'opacity-50 scale-95 rotate-2' : ''
                } ${!esTactil && dragOverId === foto.id && dragOverId !== draggingId ? 'scale-105 ring-2 ring-red-500' : ''} ${
                  foto.esPortada ? 'ring-2 ring-yellow-500' : ''
                }`}
              >
                {foto.tipo === 'video' ? (
                  <video
                    src={foto.url}
                    className="w-full h-full object-cover"
                    muted
                    loop
                    playsInline
                    onMouseEnter={(e) => e.currentTarget.play()}
                    onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                  />
                ) : (
                  <img
                    src={foto.url}
                    alt=""
                    className="w-full h-full object-cover"
                    {...(!esTactil ? { onClick: () => openFancybox(index) } : {})}
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

            {espacioLibre > 0 && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="relative aspect-3/4 rounded-2xl border-2 border-dashed border-gray-700 hover:border-red-500/60 hover:bg-red-500/5 transition-all duration-300 flex flex-col items-center justify-center gap-2 group"
              >
                <div className="w-14 h-14 rounded-full bg-gray-800 group-hover:bg-red-500/20 flex items-center justify-center group-hover:scale-110 transition-all">
                  <i className="fas fa-plus text-gray-500 group-hover:text-red-400 text-2xl transition-colors"></i>
                </div>
                <span className="text-gray-500 group-hover:text-gray-300 text-sm font-medium transition-colors">Agregar</span>
                <span className="text-gray-600 text-xs">Fotos y videos</span>
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
    </div>
  );
}
