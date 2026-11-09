import { adminFileUrl, escortFileUrl } from '../../lib/fileUrl';

interface Props {
  url: string | null | undefined;
  scope: 'admin' | 'escort';
  group?: string;
  variant?: 'thumb' | 'preview';
  alt?: string;
}

export default function ComprobanteThumb({
  url,
  scope,
  group,
  variant = 'thumb',
  alt = 'Comprobante de pago',
}: Props) {
  if (!url) {
    return <span className="text-gray-600 text-xs">—</span>;
  }

  const src = scope === 'admin' ? adminFileUrl(url) : escortFileUrl(url);

  // Extraer path real si la URL está proxificada por serve-upload
  let urlForTest = url || '';
  const serveMatch = urlForTest.match(/[?&]path=([^&]+)/);
  if (serveMatch) {
    try {
      urlForTest = decodeURIComponent(serveMatch[1]);
    } catch {}
  }

  const isPdf = /\.pdf(?:[?#]|$)/i.test(urlForTest);
  const isImage =
    /\.(jpe?g|png|webp|gif)(?:[?#]|$)/i.test(urlForTest) ||
    // Si la URL es proxificada a verificaciones o comprobantes, asumir imagen
    /uploads\/(?:verificaciones|comprobantes)\//i.test(urlForTest);
  const isThumb = variant === 'thumb';
  const fancyGroup = group || 'comprobante';

  if (isPdf) {
    return (
      <a
        href={src}
        target="_blank"
        rel="noopener noreferrer"
        title="Ver comprobante PDF"
        className={`flex items-center justify-center mx-auto rounded-lg bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 transition-colors ${isThumb ? 'w-10 h-10' : 'w-full py-6'}`}
      >
        <i className={`fas fa-file-pdf text-red-400 ${isThumb ? 'text-lg' : 'text-3xl'}`} />
      </a>
    );
  }

  if (isImage) {
    return (
      <a
        data-fancybox={fancyGroup}
        data-type="image"
        href={src}
        title={alt}
        className={isThumb ? 'block w-10 h-10 mx-auto' : 'block'}
      >
        <img
          src={src}
          alt={alt}
          className={
            isThumb
              ? 'w-10 h-10 rounded-lg object-cover cursor-pointer hover:opacity-80 transition-opacity border border-emerald-500/30'
              : 'w-full max-h-48 rounded-lg object-contain bg-black/30 cursor-pointer hover:opacity-80 transition-opacity'
          }
          loading="lazy"
        />
      </a>
    );
  }

  // Otro tipo de documento
  return (
    <a
      data-fancybox={fancyGroup}
      href={src}
      title={alt}
      className={`flex items-center justify-center mx-auto rounded-lg bg-sky-500/10 border border-sky-500/30 hover:bg-sky-500/20 transition-colors ${isThumb ? 'w-10 h-10' : 'w-full py-6'}`}
    >
      <i className={`fas fa-file-alt text-sky-400 ${isThumb ? 'text-lg' : 'text-3xl'}`} />
    </a>
  );
}
