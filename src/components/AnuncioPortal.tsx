// src/components/AnuncioPortal.tsx
// Portal del cliente: métricas del banner mediante su código de acceso.

import { useState, useEffect } from 'react';

interface Metricas {
  impresiones: number;
  clicks: number;
  ctr: number;
}

interface BannerInfo {
  titulo: string;
  anunciante: string;
  categoria: string;
  texto: string | null;
  imagen_url: string;
  placement: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado: string;
  estado_pago: string;
  precio: number;
  moneda: string;
}

const PLACEMENTS: Record<string, string> = {
  home_top: 'Home · Banner superior',
  home_entre_secciones: 'Home · Entre secciones',
  ciudad_top: 'Ciudad · Banner superior',
  perfil_top: 'Perfil · Banner superior',
  perfil_pre_footer: 'Perfil · Antes del pie',
  blog_articulo: 'Blog · En el artículo',
  footer: 'Footer',
};

export default function AnuncioPortal({ codigoInicial = '' }: { codigoInicial?: string }) {
  const [codigo, setCodigo] = useState(codigoInicial);
  const [banner, setBanner] = useState<BannerInfo | null>(null);
  const [metricas, setMetricas] = useState<Metricas | null>(null);
  const [serie, setSerie] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const cargar = async (cod: string) => {
    const limpio = cod.trim().toUpperCase();
    if (limpio.length < 6) {
      setError('Ingresa el código que te entregamos (mínimo 6 caracteres).');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/banners/portal.php?codigo=${encodeURIComponent(limpio)}`);
      const data = await res.json();
      if (data.success) {
        setBanner(data.banner);
        setMetricas(data.metricas);
        setSerie(data.serie || []);
        const url = new URL(window.location.href);
        url.searchParams.set('c', limpio);
        window.history.replaceState({}, '', url.toString());
      } else {
        setError(data.error || 'No encontramos tu anuncio');
        setBanner(null);
        setMetricas(null);
      }
    } catch {
      setError('Error de conexión. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // La página es estática: el código llega por query string en tiempo de ejecución
    const deUrl = new URLSearchParams(window.location.search).get('c') || '';
    const codigoFinal = codigoInicial || deUrl;
    if (codigoFinal) {
      setCodigo(codigoFinal);
      cargar(codigoFinal);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const maxImp = Math.max(...serie.map((s) => Number(s.impresiones) || 0), 1);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-ink mb-2">Estadísticas de tu anuncio</h1>
        <p className="text-muted text-sm">Ingresa el código de acceso que te entregamos para ver el rendimiento de tu banner.</p>
      </div>

      <div className="bg-surface border border-white/5 rounded-2xl p-5 md:p-6 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            onKeyDown={(e) => { if (e.key === 'Enter') cargar(codigo); }}
            placeholder="Código de acceso (ej: K7MP2X9Q)"
            className="flex-1 bg-raised border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm tracking-widest uppercase focus:outline-none focus:border-red-500"
          />
          <button
            onClick={() => cargar(codigo)}
            disabled={loading}
            className="px-6 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {loading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-chart-line"></i>} Ver estadísticas
          </button>
        </div>
        {error && <p className="text-red-400 text-sm mt-3"><i className="fas fa-exclamation-circle mr-1"></i>{error}</p>}
      </div>

      {banner && metricas && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-surface border border-white/5 rounded-2xl p-5">
              <div className="text-xs uppercase tracking-wider text-muted mb-1">Impresiones</div>
              <div className="text-3xl font-bold text-ink">{metricas.impresiones.toLocaleString('es-CL')}</div>
              <div className="text-xs text-muted mt-1">Veces que se mostró tu banner</div>
            </div>
            <div className="bg-surface border border-white/5 rounded-2xl p-5">
              <div className="text-xs uppercase tracking-wider text-muted mb-1">Clicks</div>
              <div className="text-3xl font-bold text-red-500">{metricas.clicks.toLocaleString('es-CL')}</div>
              <div className="text-xs text-muted mt-1">Visitas a tu negocio</div>
            </div>
            <div className="bg-surface border border-white/5 rounded-2xl p-5">
              <div className="text-xs uppercase tracking-wider text-muted mb-1">CTR</div>
              <div className="text-3xl font-bold text-ink">{metricas.ctr}%</div>
              <div className="text-xs text-muted mt-1">Clics por impresión</div>
            </div>
          </div>

          <div className="bg-surface border border-white/5 rounded-2xl p-5 mb-6">
            <div className="flex items-start gap-4">
              {banner.imagen_url && (
                <img src={banner.imagen_url} alt="" className="w-32 h-20 object-cover rounded-lg border border-white/10" />
              )}
              <div className="flex-1 min-w-0">
                <h2 className="text-white font-semibold truncate">{banner.anunciante}</h2>
                <p className="text-sm text-muted">{banner.texto || banner.titulo}</p>
                <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
                  <span><i className="fas fa-map-marker-alt mr-1"></i>{PLACEMENTS[banner.placement] || banner.placement}</span>
                  <span><i className="fas fa-calendar mr-1"></i>{banner.fecha_inicio} → {banner.fecha_fin}</span>
                  <span className={banner.estado_pago === 'pagado' ? 'text-green-400' : 'text-amber-400'}>
                    <i className="fas fa-credit-card mr-1"></i>{banner.estado_pago === 'pagado' ? 'Pagado' : 'Pendiente de pago'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {serie.length > 0 && (
            <div className="bg-surface border border-white/5 rounded-2xl p-5">
              <h3 className="text-white font-semibold mb-4">Impresiones por día</h3>
              <div className="flex items-end gap-1 h-32">
                {serie.slice(-30).map((s: any, i: number) => {
                  const h = Math.max(2, ((Number(s.impresiones) || 0) / maxImp) * 100);
                  return (
                    <div
                      key={i}
                      className="flex-1 bg-red-500/70 rounded-t"
                      style={{ height: `${h}%` }}
                      title={`${s.fecha}: ${s.impresiones} impresiones / ${s.clicks} clicks`}
                    />
                  );
                })}
              </div>
              <p className="text-xs text-gray-600 mt-2">Últimos {Math.min(30, serie.length)} días con actividad</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
