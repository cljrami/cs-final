// src/components/escort/AudioPreviewPlayer.tsx
// Botón de play superpuesto que reproduce el audio de presentación (15s) del escort.
// Singleton global: garantiza que solo un audio se reproduzca a la vez en toda la UI.

import { useState, useEffect, useRef, useCallback } from 'react';

let globalAudio: HTMLAudioElement | null = null;
const listeners = new Set<(playing: boolean) => void>();

function setGlobalPlaying(url: string | null) {
  if (globalAudio) {
    globalAudio.pause();
    globalAudio = null;
  }
  listeners.forEach(cb => cb(false));

  if (url) {
    const audio = new Audio(url);
    audio.preload = 'auto';
    globalAudio = audio;

    audio.addEventListener('ended', () => {
      listeners.forEach(cb => cb(false));
      globalAudio = null;
    }, { once: true });

    audio.play().catch(() => {});
  }
}

interface Props {
  audioUrl: string | null | undefined;
  size?: 'sm' | 'md';
}

export default function AudioPreviewPlayer({ audioUrl, size = 'md' }: Props) {
  const [playing, setPlaying] = useState(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    listeners.add(setPlaying);
    return () => {
      listeners.delete(setPlaying);
    };
  }, []);

  useEffect(() => {
    if (!globalAudio) return;
    const handleGlobalPause = () => setPlaying(false);
    globalAudio.addEventListener('pause', handleGlobalPause);
    return () => globalAudio?.removeEventListener('pause', handleGlobalPause);
  }, []);

  if (!audioUrl) return null;

  const toggle = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (playing && globalAudio) {
      globalAudio.pause();
    } else {
      setGlobalPlaying(audioUrl);
    }
  }, [playing, audioUrl]);

  const btnSize = size === 'sm' ? 'w-7 h-7' : 'w-10 h-10';
  const iconSize = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <button
      onClick={toggle}
      className={`
        absolute bottom-2 right-2 z-20 rounded-full
        bg-red-500/90 hover:bg-red-500 text-white
        flex items-center justify-center
        shadow-lg shadow-black/30
        transition-all duration-200 hover:scale-110
        ${playing ? 'animate-pulse ring-2 ring-red-400' : ''}
        ${btnSize}
      `}
      title={playing ? 'Detener audio' : 'Escuchar presentación'}
    >
      {playing ? (
        <i className={`fas fa-pause ${iconSize}`}></i>
      ) : (
        <i className={`fas fa-play ${iconSize}`}></i>
      )}
    </button>
  );
}
