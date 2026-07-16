// src/components/EscortProfile.tsx
import { useState, useEffect, useCallback } from 'react';
import { sanitizeHtml } from '../lib/sanitize';
import { Fancybox } from '@fancyapps/ui';
import '@fancyapps/ui/dist/fancybox/fancybox.css';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import Navbar from './Navbar';
import Footer from './Footer';

// ─── Tipos ─────────────────────────────────────────────────────────

interface Servicio {
  nombre: string;
  icono: string | null;
  precio_extra: number | null;
  incluido: number;
}

interface Tarifas {
  '30min'?: number;
  '1h'?: number;
  '2h'?: number;
  noche?: number;
}

interface Escort {
  id: number;
  nombre: string;
  edad: number;
  ciudad: string;
  descripcion_corta: string | null;
  descripcion_larga: string | null;
  telefono: string | null;
  whatsapp: string | null;
  foto_principal: string | null;
  verificado: number;
  vip: number;
  estado: string | null;
  altura: string | null;
  peso: string | null;
  created_at: string;
  fotos: string[];
  servicios: Servicio[];
  tarifas: Tarifas;
}

interface ApiResponse {
  success: boolean;
  escort?: Escort;
  message?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────

const formatPhone = (phone: string | null): string => {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11 && cleaned.startsWith('56')) {
    return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 3)} ${cleaned.slice(3, 7)} ${cleaned.slice(7)}`;
  }
  return phone;
};

const getWhatsAppLink = (phone: string | null): string => {
  if (!phone) return '#';
  const cleaned = phone.replace(/\D/g, '');
  const waNumber = cleaned.startsWith('56') ? cleaned : `56${cleaned}`;
  return `https://wa.me/${waNumber}`;
};

const getMedidas = (escort: Escort): string | null => {
  const match = escort.descripcion_larga?.match(/\d{2,3}-\d{2,3}-\d{2,3}/);
  return match ? match[0] : null;
};

const getEscortIdFromPath = (): number => {
  const path = window.location.pathname;
  const match = path.match(/^\/(\d+)\/?$/);
  return match ? parseInt(match[1], 10) : 0;
};

// ─── Componente Principal ───────────────────────────────────────────

export default function EscortProfile() {
  const escortId = getEscortIdFromPath();
  
  const [escort, setEscort] = useState<Escort | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liked, setLiked] = useState(false);
  const [copied, setCopied] = useState(false);

  // Inicializar Fancybox
  useEffect(() => {
    if (!escort?.fotos?.length) return;

    Fancybox.bind('[data-fancybox="gallery"]', {
      animated: true,
      showClass: 'f-fadeIn',
      hideClass: 'f-fadeOut',
      dragToClose: true,
      Toolbar: {
        display: {
          left: ['infobar'],
          middle: ['zoomIn', 'zoomOut', 'toggle1to1', 'rotateCCW', 'rotateCW', 'flipX', 'flipY'],
          right: ['slideshow', 'close'],
        },
      },
      Thumbs: { autoStart: false },
      Image: { zoom: true },
    } as any);

    return () => {
      Fancybox.destroy();
    };
  }, [escort?.fotos]);

  // Fetch escort data desde la API PHP
  useEffect(() => {
    const fetchEscort = async () => {
      if (escortId <= 0) {
        setError('ID no válido');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/escort.php?id=${escortId}`);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data: ApiResponse = await response.json();

        if (!data.success || !data.escort) {
          throw new Error(data.message || 'Escort no encontrada');
        }

        setEscort(data.escort);
      } catch (err) {
        console.error('Error fetching escort:', err);
        setError(err instanceof Error ? err.message : 'Error al cargar el perfil');
      } finally {
        setLoading(false);
      }
    };

    fetchEscort();
  }, [escortId]);

  // Handlers
  const handleLike = useCallback(() => {
    setLiked(prev => !prev);
  }, []);

  const handleShare = useCallback(async () => {
    const url = window.location.href;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: escort?.nombre ? `${escort.nombre} - CSEscorts` : 'CSEscorts',
          url,
        });
      } catch {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [escort?.nombre]);

  const handleCall = useCallback(() => {
    if (escort?.telefono) {
      window.location.href = `tel:${escort.telefono.replace(/\D/g, '')}`;
    }
  }, [escort?.telefono]);

  const handleContact = useCallback(() => {
    const phone = (escort?.whatsapp || escort?.telefono) ?? null;
    const waLink = getWhatsAppLink(phone);
    if (waLink !== '#') {
      window.open(waLink, '_blank');
    }
  }, [escort?.whatsapp, escort?.telefono]);

  const handleGoHome = useCallback(() => {
    window.location.href = '/';
  }, []);

  // ─── Loading State ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f1a]">
        <Navbar />
        <div className="pt-20 pb-12">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2 mb-8">
              <Skeleton width={40} height={16} />
              <span className="text-gray-600">/</span>
              <Skeleton width={80} height={16} />
              <span className="text-gray-600">/</span>
              <Skeleton width={100} height={16} />
            </div>

            <div className="flex flex-col md:flex-row gap-8">
              <div className="shrink-0">
                <Skeleton circle width={160} height={160} />
              </div>
              <div className="flex-1 space-y-4">
                <div className="flex items-center gap-3">
                  <Skeleton width={200} height={32} />
                  <Skeleton width={60} height={20} />
                </div>
                <Skeleton width={150} height={24} />
                <Skeleton width={300} height={16} />
                <div className="flex gap-3 flex-wrap">
                  <Skeleton width={100} height={40} />
                  <Skeleton width={120} height={40} />
                  <Skeleton width={100} height={40} />
                  <Skeleton width={100} height={40} />
                </div>
              </div>
            </div>

            <div className="mt-8 space-y-4">
              <Skeleton width={200} height={16} />
              <Skeleton count={3} height={14} />
            </div>

            <div className="mt-10">
              <Skeleton width={150} height={24} className="mb-4" />
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} height={200} className="rounded-lg" />
                ))}
              </div>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // ─── Error State ───────────────────────────────────────────────────

  if (error || !escort) {
    return (
      <div className="min-h-screen bg-[#0f0f1a]">
        <Navbar />
        <div className="pt-20 pb-12 flex items-center justify-center min-h-[60vh]">
          <div className="text-center px-4">
            <i className="fas fa-exclamation-circle text-red-500 text-5xl mb-4"></i>
            <h1 className="text-white text-xl font-semibold mb-2">
              {error || 'Perfil no encontrado'}
            </h1>
            <p className="text-gray-500 mb-6">La escort que buscas no existe o no está disponible.</p>
            <button
              onClick={handleGoHome}
              className="px-6 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
            >
              <i className="fas fa-arrow-left mr-2"></i>
              Volver al inicio
            </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // ─── Render Principal ──────────────────────────────────────────────

  const medidas = getMedidas(escort);
  const hasTarifas = Object.keys(escort.tarifas).length > 0;
  const phoneFormatted = formatPhone(escort.telefono);

  return (
    <div className="min-h-screen bg-[#0f0f1a]">
      <Navbar />

      <main className="pt-20 pb-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm mb-8 text-gray-500">
            <a href="/" className="hover:text-red-400 transition-colors">Inicio</a>
            <span>/</span>
            <a 
              href={`/ciudad/${encodeURIComponent(escort.ciudad.toLowerCase())}`}
              className="hover:text-red-400 transition-colors capitalize"
            >
              {escort.ciudad}
            </a>
            <span>/</span>
            <span className="text-gray-400">{escort.nombre}</span>
          </nav>

          {/* Header: Avatar + Info */}
          <div className="flex flex-col md:flex-row gap-6 md:gap-8 mb-10">
            
            {/* Avatar */}
            <div className="shrink-0">
              <div className="relative">
                <div className="w-36 h-36 md:w-44 md:h-44 rounded-full overflow-hidden bg-[#1a1a2e] border-2 border-white/10">
                  {escort.foto_principal ? (
                    <img
                      src={escort.foto_principal}
                      alt={escort.nombre}
                      className="w-full h-full object-cover"
                      loading="eager"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <i className="fas fa-user text-gray-600 text-4xl"></i>
                    </div>
                  )}
                </div>
                
                {escort.vip === 1 && (
                  <div className="absolute -bottom-1 -right-1 w-10 h-10 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center border-2 border-[#0f0f1a] shadow-lg">
                    <i className="fas fa-crown text-white text-xs"></i>
                  </div>
                )}
                
                {escort.verificado === 1 && (
                  <div className="absolute -top-1 -right-1 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center border-2 border-[#0f0f1a]">
                    <i className="fas fa-check text-white text-xs"></i>
                  </div>
                )}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <h1 className="text-2xl md:text-3xl font-bold text-white">
                  {escort.nombre}
                </h1>
                <span className="text-gray-400 text-lg">
                  , {escort.edad} Años
                </span>
              </div>

              {escort.telefono && (
                <a 
                  href={`tel:${escort.telefono.replace(/\D/g, '')}`}
                  className="inline-block text-green-400 text-lg font-semibold mb-3 hover:text-green-300 transition-colors"
                >
                  {phoneFormatted}
                </a>
              )}

              <div className="flex items-center gap-2 text-sm text-gray-400 mb-5 flex-wrap">
                <span className="uppercase tracking-wide">MUJER</span>
                <span className="text-gray-600">/</span>
                <span className="flex items-center gap-1">
                  <span className="text-white font-semibold">2</span>
                  <span className="text-red-400">ME GUSTAS</span>
                  <i className="fas fa-heart text-red-500 text-xs"></i>
                </span>
                <span className="text-gray-600">/</span>
                <span className="uppercase tracking-wide">{escort.ciudad}</span>
              </div>

              {/* Botones */}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleCall}
                  disabled={!escort.telefono}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-red-500 hover:bg-red-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium text-sm transition-all shadow-lg shadow-red-500/20"
                >
                  <i className="fas fa-phone-alt"></i>
                  Llamar
                </button>

                <button
                  onClick={handleContact}
                  disabled={!escort.whatsapp && !escort.telefono}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-green-500 hover:bg-green-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium text-sm transition-all shadow-lg shadow-green-500/20"
                >
                  <i className="fab fa-whatsapp"></i>
                  Contáctame
                </button>

                <button
                  onClick={handleShare}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-red-500/80 hover:bg-red-500 text-white font-medium text-sm transition-all"
                >
                  <i className="fas fa-share-alt"></i>
                  {copied ? '¡Copiado!' : 'Compartir'}
                </button>

                <button
                  onClick={handleLike}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm transition-all ${
                    liked 
                      ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' 
                      : 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30'
                  }`}
                >
                  <i className={`${liked ? 'fas' : 'far'} fa-heart`}></i>
                  Me Gusta
                </button>
              </div>
            </div>
          </div>

          {/* Descripción */}
          {(escort.descripcion_corta || escort.descripcion_larga) && (
            <div className="mb-8">
              <div
                className="text-gray-300 text-base leading-relaxed [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-gray-700 [&_td]:p-2 [&_th]:border [&_th]:border-gray-700 [&_th]:p-2 [&_th]:bg-[#1a1a2e] [&_img]:rounded-lg [&_a]:text-red-400 [&_a]:underline"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(escort.descripcion_larga || escort.descripcion_corta) }}
              />
            </div>
          )}

          {/* Características */}
          <div className="mb-8">
            <h2 className="text-gray-500 text-sm font-medium uppercase tracking-wider mb-3">
              Características
            </h2>
            <div className="flex flex-wrap gap-2">
              {escort.estado && (
                <span className="px-3 py-1.5 rounded-md bg-red-500/20 text-red-400 text-xs font-semibold border border-red-500/30">
                  {escort.estado}
                </span>
              )}
              {escort.peso && (
                <span className="px-3 py-1.5 rounded-md bg-red-500 text-white text-xs font-semibold">
                  {escort.peso} Kg
                </span>
              )}
              {escort.altura && (
                <span className="px-3 py-1.5 rounded-md bg-red-500 text-white text-xs font-semibold">
                  {escort.altura} Cm
                </span>
              )}
              {medidas && (
                <span className="px-3 py-1.5 rounded-md bg-red-500 text-white text-xs font-semibold">
                  {medidas}
                </span>
              )}
              {!escort.estado && !escort.peso && !escort.altura && !medidas && (
                <>
                  <span className="px-3 py-1.5 rounded-md bg-red-500 text-white text-xs font-semibold">Fitness</span>
                  <span className="px-3 py-1.5 rounded-md bg-red-500 text-white text-xs font-semibold">65 Kg</span>
                  <span className="px-3 py-1.5 rounded-md bg-red-500 text-white text-xs font-semibold">170 Cm</span>
                  <span className="px-3 py-1.5 rounded-md bg-red-500 text-white text-xs font-semibold">85-62-85</span>
                </>
              )}
            </div>
          </div>

          {/* Servicios */}
          {escort.servicios.length > 0 && (
            <div className="mb-8">
              <h2 className="text-gray-500 text-sm font-medium uppercase tracking-wider mb-3">
                Servicios Incluidos
              </h2>
              <div className="flex flex-wrap gap-2">
                {escort.servicios.map((servicio, idx) => (
                  <span 
                    key={idx}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold ${
                      servicio.incluido 
                        ? 'bg-red-500 text-white' 
                        : 'bg-red-500/20 text-red-400 border border-red-500/30'
                    }`}
                  >
                    {servicio.nombre}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Tarifas */}
          {hasTarifas && (
            <div className="mb-10">
              <h2 className="text-gray-500 text-sm font-medium uppercase tracking-wider mb-3">
                Tarifas
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {escort.tarifas['30min'] && (
                  <div className="bg-[#1a1a2e] border border-white/10 rounded-lg p-4 text-center">
                    <div className="text-gray-500 text-xs mb-1">30 Minutos</div>
                    <div className="text-white font-bold text-lg">${escort.tarifas['30min'].toLocaleString()}</div>
                  </div>
                )}
                {escort.tarifas['1h'] && (
                  <div className="bg-[#1a1a2e] border border-white/10 rounded-lg p-4 text-center">
                    <div className="text-gray-500 text-xs mb-1">1 Hora</div>
                    <div className="text-white font-bold text-lg">${escort.tarifas['1h'].toLocaleString()}</div>
                  </div>
                )}
                {escort.tarifas['2h'] && (
                  <div className="bg-[#1a1a2e] border border-white/10 rounded-lg p-4 text-center">
                    <div className="text-gray-500 text-xs mb-1">2 Horas</div>
                    <div className="text-white font-bold text-lg">${escort.tarifas['2h'].toLocaleString()}</div>
                  </div>
                )}
                {escort.tarifas.noche && (
                  <div className="bg-[#1a1a2e] border border-white/10 rounded-lg p-4 text-center">
                    <div className="text-gray-500 text-xs mb-1">Toda la Noche</div>
                    <div className="text-white font-bold text-lg">${escort.tarifas.noche.toLocaleString()}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Galería de Fotos (Album Publico) */}
          {escort.fotos.length > 0 && (
            <div className="mb-10">
              <h2 className="text-white text-lg font-bold mb-4 flex items-center gap-2">
                <i className="fas fa-images text-red-500"></i>
                Album Publico
              </h2>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {escort.fotos.map((foto, idx) => (
                  <a
                    key={idx}
                    href={foto}
                    data-fancybox="gallery"
                    data-caption={`${escort.nombre} - Foto ${idx + 1}`}
                    className="group relative aspect-[3/4] rounded-lg overflow-hidden bg-[#1a1a2e] border border-white/10 hover:border-red-500/50 transition-all cursor-zoom-in"
                  >
                    <img
                      src={foto}
                      alt={`${escort.nombre} - ${idx + 1}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <i className="fas fa-expand-alt text-white opacity-0 group-hover:opacity-100 transition-opacity text-xl"></i>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Info adicional */}
          <div className="bg-[#1a1a2e] border border-white/10 rounded-xl p-6 mb-10">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <i className="fas fa-info-circle text-red-500"></i>
              Información
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-gray-500">ID</span>
                <span className="text-gray-300">#{escort.id}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-gray-500">Ciudad</span>
                <span className="text-gray-300 capitalize">{escort.ciudad}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-gray-500">Edad</span>
                <span className="text-gray-300">{escort.edad} años</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-gray-500">Publicado</span>
                <span className="text-gray-300">
                  {new Date(escort.created_at).toLocaleDateString('es-CL')}
                </span>
              </div>
              {escort.verificado === 1 && (
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-gray-500">Verificación</span>
                  <span className="text-blue-400 flex items-center gap-1">
                    <i className="fas fa-check-circle text-xs"></i>
                    Verificada
                  </span>
                </div>
              )}
              {escort.vip === 1 && (
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-gray-500">Membresía</span>
                  <span className="text-yellow-400 flex items-center gap-1">
                    <i className="fas fa-crown text-xs"></i>
                    VIP
                  </span>
                </div>
              )}
            </div>
          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
}