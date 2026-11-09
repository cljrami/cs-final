import { useEffect, useState } from 'react';

interface SiteConfig {
  hero_badge: string;
  hero_titulo: string;
  hero_subtitulo: string;
  confianza_1: string;
  confianza_2: string;
  confianza_3: string;
}

interface Props {
  initialConfig?: Partial<SiteConfig> | null;
}

export default function HeroContent({ initialConfig = null }: Props) {
  const [cfg, setCfg] = useState<Partial<SiteConfig> | null>(initialConfig);

  useEffect(() => {
    fetch('/api/config/site.php')
      .then(r => r.json())
      .then(d => { setCfg(d && d.success ? d.data : {}); })
      .catch(() => setCfg({}));
  }, []);

  const badge = cfg?.hero_badge || 'Perfiles verificados';
  const titulo = cfg?.hero_titulo || 'Encuentra tu Experiencia Hoy';
  const subtitulo = cfg?.hero_subtitulo || 'Perfiles verificados y actualizados diariamente';

  const confianza = [
    { icono: 'fa-check-circle', color: 'text-green-500/50', texto: cfg?.confianza_1 || 'Verificados' },
    { icono: 'fa-shield-alt', color: 'text-blue-500/50', texto: cfg?.confianza_2 || 'Seguro' },
    { icono: 'fa-clock', color: 'text-yellow-500/50', texto: cfg?.confianza_3 || 'Actualizados hoy' },
  ];

  const words = titulo.trim().split(/\s+/);
  const last = words.pop();
  const resto = words.join(' ');

  return (
    <>
      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium mb-6">
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
        {badge}
      </div>
      <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-ink mb-4 leading-tight">
        {resto} <span className="text-red-400">{last}</span>
      </h1>
      <p className="text-muted text-sm md:text-base mb-4 max-w-xl mx-auto">
        {subtitulo}
      </p>
      <div className="flex items-center justify-center gap-6 mt-2 text-xs text-muted">
        {confianza.map((c, i) => (
          <span key={i}><i className={`fas ${c.icono} ${c.color} mr-1`}></i>{c.texto}</span>
        ))}
      </div>
    </>
  );
}
