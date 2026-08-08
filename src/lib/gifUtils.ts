// src/lib/gifUtils.ts
// Generador de GIFs animados a partir de videos (cliente-side usando gif.js)
// Reemplaza a la foto_principal cuando un video se usa como portada.

import GIF from 'gif.js';

const WORKER_URL = '/js/gif.worker.js';

export interface GifGenOptions {
  width?: number;
  height?: number;
  fps?: number;
  segundos?: number;
  quality?: number;
  onProgress?: (pct: number) => void;
}

export interface GifResult {
  blob: Blob;
  url: string;
  width: number;
  height: number;
}

export async function videoSrcToGif(
  videoSrc: string,
  fileName: string,
  opts: GifGenOptions = {}
): Promise<GifResult> {
  const {
    width = 320,
    height = null as number | null,
    fps = 15,
    segundos = 4,
    quality = 10,
    onProgress = () => {},
  } = opts;

  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.src = videoSrc;
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';

    const cleanup = () => {
      video.removeEventListener('loadedmetadata', onMeta);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      video.removeEventListener('stalled', onStalled);
      if (!video.paused) video.pause();
      video.removeAttribute('src');
    };

    const onError = () => {
      cleanup();
      reject(new Error('Error al cargar video para GIF'));
    };

    const onStalled = () => {
      cleanup();
      reject(new Error('Video se atascó durante extracción (timeout)'));
    };

    let gif: GIF | null = null;
    let frameCount = 0;
    let totalFrames = 0;
    let currentTime = 0;
    let gifWidth = 0;
    let gifHeight = 0;
    const interval = 1000 / fps;

    const finalize = (blob: Blob, w: number, h: number) => {
      cleanup();
      onProgress(100);
      const url = URL.createObjectURL(blob);
      resolve({ blob, url, width: w, height: h });
    };

    const onSeeked = () => {
      if (!gif) return;

      const canvas = document.createElement('canvas');
      canvas.width = gifWidth;
      canvas.height = gifHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        onError();
        return;
      }

      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, gifWidth, gifHeight);
      ctx.drawImage(video, 0, 0, gifWidth, gifHeight);
      gif.addFrame(ctx, { copy: false, delay: Math.round(interval) });

      frameCount++;
      onProgress(Math.round((frameCount / totalFrames) * 100));
      currentTime += interval / 1000;

      if (frameCount < totalFrames && currentTime < video.duration) {
        video.currentTime = Math.min(currentTime, video.duration - 0.05);
      } else {
        gif.render();
      }
    };

    const onMeta = async () => {
      try {
        const videoDuration = video.duration || 4;
        const availableFrames = Math.floor(videoDuration * fps);
        totalFrames = Math.min(
          Math.floor(segundos * fps),
          Math.max(availableFrames - 1, 2)
        );

        const vW = video.videoWidth;
        const vH = video.videoHeight;
        gifWidth = width;
        let calculatedHeight = height;
        if (calculatedHeight === null) {
          calculatedHeight = Math.round(gifWidth * (vH / vW));
        }
        gifHeight = Math.min(calculatedHeight, 520);
        gifWidth = Math.min(gifWidth, 320);

        gif = new GIF({
          workers: 1,
          workerScript: WORKER_URL,
          quality,
          width: gifWidth,
          height: gifHeight,
          repeat: 0,
          transparent: null,
          debug: false,
          dither: false,
        });

        gif.on('progress', (pct: number) => onProgress(Math.round(pct * 100)));
        gif.on('finished', (blob: Blob) => {
          finalize(blob, gifWidth, gifHeight);
        });
        gif.on('abort', onError);
        gif.on('start', () => {
          video.currentTime = 0;
        });

        currentTime = 0;
        video.currentTime = 0;
      } catch {
        onError();
      }
    };

    video.addEventListener('loadedmetadata', onMeta);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onError);
    video.addEventListener('stalled', onStalled);

    let timeoutId: ReturnType<typeof setTimeout>;
    timeoutId = setTimeout(() => {
      if (gif && gif.running === false && frameCount === 0) {
        onError();
      }
    }, 20_000);

    video.load();
    const playAttempt = video.play();
    if (playAttempt && typeof playAttempt.then === 'function') {
      playAttempt.catch(() => {});
    }
  });
}

export async function uploadGifBlob(
  blob: Blob,
  token: string,
  fileName: string = 'gif_portada.gif'
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const file = new File([blob], fileName, { type: 'image/gif' });
    const formData = new FormData();
    formData.append('gif_portada', file);

    const res = await fetch('/api/escort/fotos/upload-gif.php', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const data = await res.json();
    if (!data.success) {
      return { success: false, error: data.error || 'Error al subir GIF' };
    }
    return { success: true, url: data.url };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error de conexión' };
  }
}
