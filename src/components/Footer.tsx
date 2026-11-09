// src/components/Footer.tsx
import { Skeleton } from './ui/Skeleton';
import { useSiteTexts } from '../hooks/useSiteTexts';
import BannerSlot from './BannerSlot';

interface Props {
  initialTexts?: Record<string, string> | null;
}

export default function Footer({ initialTexts = null }: Props) {
  const texts = useSiteTexts(initialTexts);
  const has = (k: string) => !!(texts && texts[k]);

  const T = {
    logo1: texts?.footer_logo_1 || 'CS',
    logo2: texts?.footer_logo_2 || 'ESCORTS',
    descripcion: texts?.footer_descripcion || texts?.site_descripcion || '',
    paginas: texts?.footer_titulo_paginas || 'Páginas',
    panelEscort: texts?.footer_panel_escort || 'Panel Escort',
    registroUsuario: texts?.footer_registro_usuario || 'Registro Usuario',
    registroEscort: texts?.footer_registro_escort || 'Registro Escort',
    entrarUsuario: texts?.footer_entrar_usuario || 'Entrar como Usuario',
    entrarEscort: texts?.footer_entrar_escort || 'Entrar como Escort',
    negocios: texts?.footer_negocios || 'Negocios',
    anunciaNegocio: texts?.footer_anuncia_negocio || 'Anuncia tu negocio',
    contacto: texts?.footer_titulo_contacto || 'Contacto',
    email: texts?.footer_email || 'contacto@consexvip.cl',
    derechos: texts?.footer_derechos || 'Todos los derechos reservados.',
    mayores18: texts?.footer_mayores18 || 'Solo para mayores de 18 años.',
    copy: texts?.footer_copy || `© ${new Date().getFullYear()} Consexvip - Todos los derechos reservados.`,
    twitter: texts?.footer_url_twitter || '',
    instagram: texts?.footer_url_instagram || '',
    telegram: texts?.footer_url_telegram || '',
  };

  return (
    <footer className="bg-page border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-1 mb-4">
              <span className="text-red-500 font-bold text-lg">{texts ? T.logo1 : <Skeleton width={24} height={20} inline />}</span>
              <span className="text-ink font-semibold text-lg">{texts ? T.logo2 : <Skeleton width={80} height={20} inline />}</span>
            </div>
            <p className="text-muted text-sm leading-relaxed">
              {texts ? T.descripcion : (
                <Skeleton width="100%" height={14} count={2} />
              )}
            </p>
          </div>

          <div>
            <h3 className="text-red-400 font-semibold text-sm uppercase tracking-wider mb-4">{texts ? T.paginas : <Skeleton width={64} height={14} inline />}</h3>
            <ul className="space-y-3">
              <li><a href="/micuenta/resumen" className="text-muted hover:text-ink text-sm transition-colors">{texts ? T.panelEscort : <Skeleton width={90} height={14} inline />}</a></li>
              <li><a href="/unirse" className="text-muted hover:text-ink text-sm transition-colors">{texts ? T.registroUsuario : <Skeleton width={110} height={14} inline />}</a></li>
              <li><a href="/micuenta/registro" className="text-muted hover:text-ink text-sm transition-colors">{texts ? T.registroEscort : <Skeleton width={100} height={14} inline />}</a></li>
              <li><a href="/ingresar" className="text-muted hover:text-ink text-sm transition-colors">{texts ? T.entrarUsuario : <Skeleton width={120} height={14} inline />}</a></li>
              <li><a href="/micuenta/login" className="text-muted hover:text-ink text-sm transition-colors">{texts ? T.entrarEscort : <Skeleton width={110} height={14} inline />}</a></li>
              <li><a href="/negocios" className="text-muted hover:text-ink text-sm transition-colors">{texts ? T.negocios : <Skeleton width={80} height={14} inline />}</a></li>
              <li><a href="/anunciate" className="text-muted hover:text-ink text-sm transition-colors">{texts ? T.anunciaNegocio : <Skeleton width={140} height={14} inline />}</a></li>
            </ul>
          </div>

          <div>
            <h3 className="text-red-400 font-semibold text-sm uppercase tracking-wider mb-4">{texts ? T.contacto : <Skeleton width={64} height={14} inline />}</h3>
            <a href={`mailto:${T.email}`} className="flex items-center gap-2 text-muted hover:text-ink text-sm transition-colors">
              <i className="fas fa-envelope text-muted"></i>
              {texts ? T.email : <Skeleton width={180} height={14} inline />}
            </a>
            <div className="mt-4 flex gap-3">
              {T.twitter ? (
                <a href={T.twitter} target="_blank" rel="noopener noreferrer" aria-label="Twitter" className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-muted hover:text-ink hover:bg-white/10 transition-all">
                  <i className="fab fa-twitter text-sm" aria-hidden="true"></i>
                </a>
              ) : (
                <a href="#" aria-label="Twitter" className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-muted hover:text-ink hover:bg-white/10 transition-all">
                  <i className="fab fa-twitter text-sm" aria-hidden="true"></i>
                </a>
              )}
              {T.instagram ? (
                <a href={T.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-muted hover:text-ink hover:bg-white/10 transition-all">
                  <i className="fab fa-instagram text-sm" aria-hidden="true"></i>
                </a>
              ) : (
                <a href="#" aria-label="Instagram" className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-muted hover:text-ink hover:bg-white/10 transition-all">
                  <i className="fab fa-instagram text-sm" aria-hidden="true"></i>
                </a>
              )}
              {T.telegram ? (
                <a href={T.telegram} target="_blank" rel="noopener noreferrer" aria-label="Telegram" className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-muted hover:text-ink hover:bg-white/10 transition-all">
                  <i className="fab fa-telegram text-sm" aria-hidden="true"></i>
                </a>
              ) : (
                <a href="#" aria-label="Telegram" className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-muted hover:text-ink hover:bg-white/10 transition-all">
                  <i className="fab fa-telegram text-sm" aria-hidden="true"></i>
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-muted text-xs">{texts ? T.copy : '...'}</p>
          <p className="text-muted text-xs">{texts ? T.mayores18 : <Skeleton width={200} height={12} inline />}</p>
        </div>

        {/* Banner de pie (footer) - 2 carriles: se pueden vender 2 anunciantes */}
        <div className="mt-8 space-y-4">
          <BannerSlot placement="footer" lane={1} />
          <BannerSlot placement="footer" lane={2} />
        </div>
      </div>
    </footer>
  );
}
