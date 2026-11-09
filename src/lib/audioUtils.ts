// src/lib/audioUtils.ts
// Helpers para subir y eliminar el audio de presentación de la escort.
// - uploadAudioPreview: FormData con barra de progreso
// - deleteAudioPreview: elimina el audio actual del escort

const API_BASE = '/api/escort/fotos';

export async function uploadAudioPreview(
  file: File,
  token: string,
  onProgress?: (pct: number) => void
): Promise<{ success: boolean; url?: string; error?: string }> {
  return new Promise((resolve) => {
    const formData = new FormData();
    formData.append('audio_preview', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/upload-audio.php`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      const contentType = xhr.getResponseHeader('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        resolve({ success: false, error: `Servidor error (${xhr.status}): ${xhr.responseText.slice(0, 200)}` });
        return;
      }
      try {
        const data = JSON.parse(xhr.responseText);
        if (data.success) {
          resolve({ success: true, url: data.url });
        } else {
          resolve({ success: false, error: data.error || 'Error al subir audio' });
        }
      } catch {
        resolve({ success: false, error: 'Respuesta inválida del servidor' });
      }
    };

    xhr.onerror = () => {
      resolve({ success: false, error: 'Error de red' });
    };

    xhr.send(formData);
  });
}

export async function deleteAudioPreview(
  token: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/upload-audio.php?_method=delete`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: new URLSearchParams({ _method: 'delete' }),
    });

    const contentType = res.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await res.text();
      return { success: false, error: `Servidor error (${res.status}): ${text.slice(0, 200)}` };
    }

    const data = await res.json();
    return { success: data.success, error: data.error };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error de conexión' };
  }
}
