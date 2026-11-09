// src/components/BannerSlot.tsx
// Slot publicitario reutilizable. Renderiza el banner vigente del placement,
// registra la impresión cuando entra en pantalla (IntersectionObserver) y
// lleva el click al tracker del servidor (redirect 302).

import { useEffect, useRef, useState } from 'react';

export interface BannerData {
  id: number;
  titulo: string;
  anunciante: string;
  categoria: string;
  texto?: string | null;
  imagen_url: string;
  placement: string;
  ciudad?: string | null;
  url: string;
  etiqueta: string;
}

interface Props {
  placement: string;
  ciudad?: string;
  /** Carril dentro de la posición (el footer tiene 2) */
  lane?: number;
  className?: string;
}

export default function BannerSlot({ placement, ciudad, lane = 1, className = '' }: Props) {
  const [banner, setBanner] = useState<BannerData | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const registrado = useRef(false);

  useEffect(() => {
    let activo = true;
    const params = new URLSearchParams({ placement, lane: String(lane) });
    if (ciudad) params.set('ciudad', ciudad);
    fetch(`/api/banners.php?${params.toString()}`, { headers: { Accept: 'application/json' } })
      .then((r) => r.json())
      .then((d) => {
        if (activo && d.success && d.banner) setBanner(d.banner);
      })
      .catch(() => {});
    return () => { activo = false; };
  }, [placement, ciudad, lane]);

  useEffect(() => {
    if (!banner || registrado.current || !ref.current) return;
    const el = ref.current;
    let io: IntersectionObserver | null = null;
    try {
      io = new IntersectionObserver(
        (entradas) => {
          if (!entradas[0]?.isIntersecting) return;
          io?.disconnect();
          registrado.current = true;
          fetch('/api/banners/impresion.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ banner_id: banner.id, placement }),
            keepalive: true,
          }).catch(() => {});
        },
        { threshold: 0.5 }
      );
      io.observe(el);
    } catch {
      // Sin IntersectionObserver: no se registra impresión
    }
    return () => { io?.disconnect(); };
  }, [banner, placement]);

  if (!banner) return null;

  return (
    <div ref={ref} className={`banners-slot ${className}`} data-placement={placement}>
      <a
        href={banner.url}
        target="_blank"
        rel="sponsored nofollow noopener"
        className="block group"
        data-banner-id={banner.id}
      >
        <img
          src={banner.imagen_url}
          alt={banner.titulo || banner.anunciante}
          loading="lazy"
          decoding="async"
          className="mx-auto w-auto max-w-full max-h-[125px] object-contain rounded-xl border border-white/5 group-hover:border-red-500/30 transition-colors"
        />
        {banner.texto && (
          <span className="block mt-1 text-[11px] text-gray-400">{banner.texto}</span>
        )}
        <span className="block mt-1 text-[10px] uppercase tracking-wider text-gray-600">
          {banner.etiqueta}
        </span>
      </a>
    </div>
  );
}
