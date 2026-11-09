// src/components/escort/AudioUploader.tsx
// Interfaz de grabación/subida de audio de presentación (máx 15s, 2MB).
// Soporta grabación vía micrófono (MediaRecorder) o selección de archivo.
// Reutilizable dentro de GaleriaManager o MicroProfileSettings.

import { useState, useRef, useEffect, useCallback } from 'react';
import { uploadAudioPreview, deleteAudioPreview } from '../../lib/audioUtils';
import { showToast } from '../ui/Toast';

const MAX_DURATION = 15;
const MAX_SIZE = 20 * 1024 * 1024;

export interface AudioUploaderProps {
  currentAudioUrl?: string | null;
  onAudioUpdate: (url: string | null) => void;
  disabled?: boolean;
}

export default function AudioUploader({ currentAudioUrl, onAudioUpdate, disabled }: AudioUploaderProps) {
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [success] = useState('');
  const setSuccess = (m: string) => showToast(m);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentAudioUrl ?? null);
  const [duration, setDuration] = useState<number | null>(null);

  // Sync prop changes (e.g. after parent refetch or after delete confirm from server)
  useEffect(() => {
    setPreviewUrl(currentAudioUrl ?? null);
  }, [currentAudioUrl]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>( null);
  const fileReaderRef = useRef<FileReader | null>(null);

  const getToken = () => {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return '';
    try {
      return localStorage.getItem('escort_token') || '';
    } catch {
      return '';
    }
  };
  const token = getToken();

  const reset = useCallback(() => {
    setError('');
    setSuccess('');
    setUploadProgress(0);
    setRecordingTime(0);
    setDuration(null);
    audioChunksRef.current = [];
  }, []);

  const clearPreview = async () => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setDuration(null);
    try {
      if (token) {
        const res = await deleteAudioPreview(token);
        if (!res.success) {
          setError(res.error || 'Error al eliminar audio');
          return;
        }
      }
      setPreviewUrl(null);
      setSuccess('Audio eliminado');
      onAudioUpdate(null);
      setTimeout(() => setSuccess(''), 2000);
    } catch (e: any) {
      setError(e.message || 'Error al eliminar audio');
    }
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const validateFile = async (file: File): Promise<{ valid: boolean; duration?: number; error?: string }> => {
    if (!file.type.startsWith('audio/')) {
      return { valid: false, error: 'Archivo no es de audio' };
    }
    if (file.size > MAX_SIZE) {
      return { valid: false, error: `Audio demasiado grande (máx ${MAX_SIZE / (1024*1024)}MB)` };
    }
    return new Promise(resolve => {
      const audio = document.createElement('audio');
      audio.preload = 'metadata';
      audio.onloadedmetadata = () => {
        URL.revokeObjectURL(audio.src);
        const dur = audio.duration || 0;
        resolve({ valid: true, duration: dur });
      };
      audio.onerror = () => resolve({ valid: false, error: 'No se pudo leer el audio' });
      audio.src = URL.createObjectURL(file);
    });
  };

  const uploadFile = async (file: File) => {
    reset();
    setUploading(true);

    try {
      const res = await uploadAudioPreview(file, token, (pct) => setUploadProgress(pct));
      if (!res.success || !res.url) {
        throw new Error(res.error || 'Error al subir audio');
      }

      setPreviewUrl(res.url);
      setSuccess('Audio actualizado');
      onAudioUpdate(res.url);

      setTimeout(() => { setSuccess(''); }, 2000);
    } catch (err: any) {
      setError(err.message || 'Error al subir audio');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const validation = await validateFile(file);
    if (!validation.valid) {
      setError(validation.error || 'Archivo inválido');
      return;
    }
    await uploadFile(file);
    setDuration(validation.duration || null);
  };

  const startRecording = useCallback(async () => {
    reset();
    setError('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: BlobPart[] = [];
      audioChunksRef.current = chunks;

      const mime = MediaRecorder.isTypeSupported('audio/webm; codecs=opus')
        ? 'audio/webm; codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/wav';

      const mr = new MediaRecorder(stream, { mimeType: mime });
      mediaRecorderRef.current = mr;

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mr.onstop = async () => {
        const blob = new Blob(chunks, { type: mime });
        const file = new File([blob], 'audio_preview_' + Date.now() + '.' + (mime.includes('webm') ? 'webm' : 'wav'), {
          type: blob.type,
        });

        const validation = await validateFile(file);
        if (!validation.valid) {
          setError(validation.error || 'Grabación inválida');
          return;
        }

        setDuration(validation.duration || null);
        setRecordingTime(0);

        stream.getTracks().forEach(t => t.stop());
        await uploadFile(file);
      };

      mr.start(100);
      setRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime(t => {
          if (t + 1 >= MAX_DURATION) {
            stopRecording();
            return MAX_DURATION;
          }
          return t + 1;
        });
      }, 1000);

    } catch (err: any) {
      setError(err.name === 'NotAllowedError' ? 'Debes permitir el acceso al micrófono' : 'Micrófono no disponible');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }, []);

  useEffect(() => {
    return () => {
      stopTimer();
      if (fileReaderRef.current) fileReaderRef.current.abort();
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  return (
    <div className="mt-6 p-4 bg-raised rounded-xl border border-gray-700">
      <h4 className="text-sm font-semibold text-ink mb-3 flex items-center gap-2">
        <i className="fas fa-microphone text-red-400"></i>
        Audio de presentación (máx. 15s)
      </h4>

      {error && (
        <div className="mb-3 text-sm text-red-400 bg-red-500/10 border border-red-500/30 px-3 py-2 rounded-lg flex items-center gap-2">
          <i className="fas fa-exclamation-triangle"></i>{error}
        </div>
      )}

      {success && (
        <div className="mb-3 text-sm text-green-400 bg-green-500/10 border border-green-500/30 px-3 py-2 rounded-lg flex items-center gap-2">
          <i className="fas fa-check-circle"></i>{success}
        </div>
      )}

      {/* Preview del audio actual */}
      {previewUrl && (
        <div className="mb-4 p-3 bg-gray-900/50 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <audio
              src={previewUrl}
              preload="none"
              controls
              className="w-48 h-8 opacity-70"
            />
            {duration !== null && (
              <span className="text-xs text-muted">{duration.toFixed(1)}s</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={clearPreview}
              className="text-red-400 hover:text-red-300 p-1"
              title="Eliminar audio"
              disabled={uploading || disabled}
            >
              <i className="fas fa-trash-alt text-sm"></i>
            </button>
          </div>
        </div>
      )}

      {/* Progreso de grabación */}
      {recording && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-red-400 flex items-center gap-1">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
              Grabando... {recordingTime}s
            </span>
            <button
              onClick={stopRecording}
              className="text-xs text-gray-400 hover:text-gray-300"
            >
              <i className="fas fa-stop mr-1"></i>Detener
            </button>
          </div>
          <div className="w-full h-1 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-red-500 transition-all"
              style={{ width: `${(recordingTime / MAX_DURATION) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Controles de grabación/subida */}
      {!previewUrl && !recording && !uploading && (
        <div className="flex gap-2">
          <button
            onClick={startRecording}
            disabled={disabled}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className="fas fa-microphone"></i>
            Grabar con micrófono
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-gray-700/30 hover:bg-gray-700/50 border border-gray-600 text-gray-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className="fas fa-file-audio"></i>
            Seleccionar archivo
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileSelect}
            className="hidden"
            capture="environment"
          />
        </div>
      )}

      {/* Progreso de subida */}
      {uploading && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-400">Subiendo audio...</span>
            <span className="text-xs text-gray-400">{uploadProgress}%</span>
          </div>
          <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-red-500 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}
