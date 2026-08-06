import { useEffect, useRef, useState } from 'react';
import QRCodeLib from 'qrcode';

interface QRCodeProps {
  url: string;
  title?: string;
  size?: number;
}

export default function QRCode({ url, title, size = 200 }: QRCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (canvasRef.current) {
      QRCodeLib.toCanvas(canvasRef.current, url, {
        width: size,
        margin: 2,
        color: { dark: '#ffffff', light: '#0f0f1a' },
      });
    }
  }, [url, size]);

  const downloadQR = () => {
    if (!canvasRef.current) return;
    setDownloading(true);
    const link = document.createElement('a');
    link.download = `qr-${title?.toLowerCase().replace(/\s+/g, '-') || 'codigo'}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
    setTimeout(() => setDownloading(false), 1000);
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <canvas ref={canvasRef} className="rounded-xl" />
      {title && <p className="text-gray-400 text-xs text-center">{title}</p>}
      <button
        onClick={downloadQR}
        disabled={downloading}
        className="px-4 py-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-all flex items-center gap-2"
      >
        <i className="fas fa-download"></i>
        {downloading ? 'Descargando...' : 'Descargar QR'}
      </button>
    </div>
  );
}
