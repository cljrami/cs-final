// src/lib/gifUtils.ts
// Genera una portada animada GIF (o frame estático WebP como fallback) a partir
// de un video, procesado 100% client-side con gif.js.
// La portada usa las mismas proporciones que las imágenes de la galería (3:4)
// con recorte central tipo 'cover', y dura ~5s optimizada para quedar <=~1.5MB
// (el servidor acepta hasta 2MB). Si se excede igual se degrada a WebP estático.

import GIF from 'gif.js';

const WORKER_URL = '/js/gif.worker.js';

// La galería renderiza las imágenes en aspect 3:4 (aspect-3/4).
const RATIO_WIDTH = 3;
const RATIO_HEIGHT = 4;
const RATIO = RATIO_HEIGHT / RATIO_WIDTH; // alto = ancho * 4/3

export interface GifGenOptions {
  width?: number;
  height?: number;
  fps?: number;
  segundos?: number;
  quality?: number;
  maxBytes?: number;
  onProgress?: (pct: number) => void;
}

export interface GifResult {
  blob: Blob;
  url: string;
  width: number;
  height: number;
  ext: 'gif' | 'webp';
}

interface PassParams {
  width: number;
  height: number;
  fps: number;
  segundos: number;
  quality: number;
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  video: HTMLVideoElement
) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const scale = Math.max(canvasW / vw, canvasH / vh);
  const sw = canvasW / scale;
  const sh = canvasH / scale;
  const sx = (vw - sw) / 2;
  const sy = (vh - sh) / 2;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvasW, canvasH);
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvasW, canvasH);
}

function loadVideo(videoSrc: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.src = videoSrc;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.crossOrigin = 'anonymous';

    let done = false;
    const cleanup = () => {
      video.removeEventListener('loadedmetadata', onMeta);
      video.removeEventListener('error', onError);
      window.clearTimeout(timeout);
      if (!video.paused) video.pause();
      video.removeAttribute('src');
    };
    const fail = (msg: string) => {
      if (done) return;
      done = true;
      cleanup();
      reject(new Error(msg));
    };
    const onMeta = () => {
      if (done) return;
      done = true;
      window.clearTimeout(timeout);
      resolve(video);
    };
    const onError = () => fail('Error al cargar el video para generar la portada');

    video.addEventListener('loadedmetadata', onMeta);
    video.addEventListener('error', onError);

    const timeout = window.setTimeout(() => fail('El video se pegó al extraer la portada (timeout)'), 20_000);

    video.load();
    const playAttempt = video.play();
    if (playAttempt && typeof playAttempt.catch === 'function') {
      playAttempt.catch(() => {});
    }
  });
}

function seekVideo(video: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      resolve();
    };
    video.addEventListener('seeked', onSeeked);
    video.currentTime = t;
  });
}

function renderGifPass(
  video: HTMLVideoElement,
  p: PassParams,
  onProgress: (pct: number) => void
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const duration = video.duration || 0;
    const availableFrames = Math.max(Math.floor(duration * p.fps) - 1, 1);
    const totalFrames = Math.min(
      Math.max(Math.floor(p.segundos * p.fps), 1),
      availableFrames
    );

    if (totalFrames < 1) {
      reject(new Error('El video no tiene duración válida'));
      return;
    }

    const gif = new GIF({
      workers: 2,
      workerScript: WORKER_URL,
      quality: p.quality,
      width: p.width,
      height: p.height,
      repeat: 0,
      transparent: null,
      debug: false,
      dither: false,
    });

    let frameCount = 0;
    let settled = false;
    let stall: number | undefined;

    const teardown = () => {
      if (settled) return;
      settled = true;
      video.removeEventListener('seeked', onSeeked);
      if (stall) window.clearTimeout(stall);
    };

    const onSeeked = () => {
      if (settled) return;
      try {
        // Un canvas nuevo por frame: gif.js con copy:false referencia el canvas,
        // así que cada frame necesita su propio canvas con su contenido.
        const canvas = document.createElement('canvas');
        canvas.width = p.width;
        canvas.height = p.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('No se pudo obtener el contexto del canvas');
        drawCover(ctx, p.width, p.height, video);
        gif.addFrame(ctx, { copy: false, delay: Math.round(1000 / p.fps) });

        frameCount++;
        onProgress(Math.min(90, Math.round((frameCount / totalFrames) * 90)));

        if (frameCount < totalFrames) {
          video.currentTime = Math.min(frameCount / p.fps, duration - 0.05);
        } else {
          gif.render();
        }
      } catch (err: any) {
        teardown();
        reject(err);
      }
    };

    gif.on('progress', (pct: number) => {
      if (!settled) onProgress(90 + Math.round((pct as number) * 10));
    });
    gif.on('finished', (blob: Blob) => {
      teardown();
      resolve(blob);
    });
    gif.on('abort', () => {
      teardown();
      reject(new Error('La generación de la portada se canceló'));
    });

    stall = window.setTimeout(() => {
      if (!settled && frameCount < totalFrames) {
        teardown();
        reject(new Error('El video se pegó al extraer los frames (timeout 20s)'));
      }
    }, 20_000);

    video.addEventListener('seeked', onSeeked);
    video.currentTime = 0;
  });
}

function captureFrame(
  video: HTMLVideoElement,
  w: number,
  h: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('No se pudo crear el canvas del frame estático'));
      return;
    }
    drawCover(ctx, w, h, video);
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('No se pudo generar el frame estático'))),
      'image/webp',
      0.8
    );
  });
}

function finalize(blob: Blob, width: number, height: number, ext: 'gif' | 'webp'): GifResult {
  const url = URL.createObjectURL(blob);
  return { blob, url, width, height, ext };
}

export async function videoSrcToGif(
  videoSrc: string,
  fileName: string,
  opts: GifGenOptions = {}
): Promise<GifResult> {
  const {
    width = 280,
    height = Math.round(width * RATIO),
    fps = 8,
    segundos = 5,
    quality = 20,
    maxBytes = 1.5 * 1024 * 1024,
    onProgress = () => {},
  } = opts;

  const video = await loadVideo(videoSrc);

  // Intentos en orden: GIF óptimo → GIF ultra-liviano → frame estático WebP
  const attempts: PassParams[] = [
    { width, height, fps, segundos, quality },
    {
      width: Math.round(width * 0.7),
      height: Math.round(height * 0.7),
      fps: Math.min(fps, 6),
      segundos: Math.max(2, Math.round(segundos * 0.6)),
      quality: 20,
    },
  ];

  for (const attempt of attempts) {
    try {
      onProgress(5);
      const gifBlob = await renderGifPass(video, attempt, onProgress);
      if (gifBlob.size <= maxBytes) {
        return finalize(gifBlob, attempt.width, attempt.height, 'gif');
      }
      onProgress(92);
    } catch {
      // intentar el siguiente modo (o el fallback estático)
    }
  }

  // Fallback: portada estática WebP con las mismas dimensiones 3:4
  try {
    const seekTo = Math.min(video.duration || 1, 1);
    await seekVideo(video, seekTo);
    const frameBlob = await captureFrame(video, width, height);
    return finalize(frameBlob, width, height, 'webp');
  } catch (err: any) {
    throw err;
  }
}

export async function uploadGifBlob(
  blob: Blob,
  token: string,
  fotoId?: number | null,
  fileName: string = 'portada'
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const type = blob.type || 'image/gif';
    const ext = type.includes('webp')
      ? 'webp'
      : type.includes('jpeg')
        ? 'jpg'
        : 'gif';
    const fullName = /\.\w+$/.test(fileName) ? fileName : `${fileName}.${ext}`;
    const file = new File([blob], fullName, { type });

    const formData = new FormData();
    // El campo se mantiene como gif_portada por compatibilidad con el backend
    // aunque internamente pueda ser webp/jpeg (el backend lo acepta).
    formData.append('gif_portada', file);
    if (fotoId) formData.append('fotoId', String(fotoId));

    const res = await fetch('/api/escort/fotos/upload-gif.php', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    const contentType = res.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await res.text();
      return { success: false, error: `Servidor devolvió error (${res.status}): ${text.slice(0, 200)}` };
    }

    const data = await res.json();
    if (!data.success) {
      return { success: false, error: data.error || 'Error al subir la portada' };
    }
    return { success: true, url: data.url, ...(data.error ? { error: data.error } : {}) };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error de conexión' };
  }
}