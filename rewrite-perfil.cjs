const fs = require('fs');

let content = fs.readFileSync('src/components/escort/PerfilPublico.tsx', 'utf8');

const startMarker = '{/* Descripción corta y larga apiladas */}';
const endMarker = '{/* Formulario de valoración / comentario */}';

const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker);

if (startIdx !== -1 && endIdx !== -1) {
  const before = content.substring(0, startIdx);
  const after = content.substring(endIdx);
  
  const newSection = `              {/* Descripción corta y larga apiladas */}
              {(perfil!.descripcion_corta?.trim() || perfil!.descripcion_larga?.trim()) && (
                <div className="mb-8">
                  <h2 className="text-ink font-bold text-lg flex items-center gap-2 mb-4">
                    <i className="fas fa-align-left text-red-500"></i> Descripción
                  </h2>
                  {perfil!.descripcion_corta?.trim() && (
                    <div
                      className="text-muted text-base leading-relaxed ql-editor mb-6"
                      dangerouslySetInnerHTML={{ __html: renderHtmlSeguro(perfil!.descripcion_corta.trim()) }}
                    />
                  )}
                  {perfil!.descripcion_larga?.trim() && (
                    <div
                      className="text-muted text-base leading-relaxed ql-editor"
                      dangerouslySetInnerHTML={{ __html: renderHtmlSeguro(perfil!.descripcion_larga.trim()) }}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Audio de presentación - Sección dedicada */}
          {perfil!.audio_preview && (
            <div className="mt-8 p-4 bg-surface border border-gray-700 rounded-xl">
              <h3 className="text-ink font-bold flex items-center gap-2 mb-3">
                <i className="fas fa-microphone text-red-400"></i> Audio de presentación
              </h3>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <audio
                    src={perfil!.audio_preview}
                    preload="metadata"
                    controls
                    className="w-full max-w-xs h-10"
                  />
                  <span className="text-xs text-muted">Máx. 15s</span>
                </div>
              </div>
            </div>
          )}

          `;
  
  const newContent = before + newSection + after;
  fs.writeFileSync('src/components/escort/PerfilPublico.tsx', newContent, 'utf8');
  console.log('File rewritten successfully');
} else {
  console.log('Markers not found:', startIdx, endIdx);
}