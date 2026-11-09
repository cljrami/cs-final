// src/components/escort/CargaSeccion.tsx
// Esqueleto neutro que se muestra mientras los porteros del panel
// (AprobacionRequerida / PlanRequerido) consultan el estado real.
// Evita el parpadeo de tarjetas de bloqueo ("en moderación" / "sin plan")
// antes de saber si corresponden.

export default function CargaSeccion() {
  return (
    <div className="w-full max-w-full mx-auto my-10" aria-busy="true" aria-label="Cargando sección">
      <div className="bg-[#13131a] border border-white/5 rounded-2xl p-8 md:p-10">
        <div className="w-16 h-16 mx-auto mb-5 bg-white/5 rounded-2xl animate-pulse" />
        <div className="h-6 w-2/3 mx-auto mb-3 bg-white/5 rounded-lg animate-pulse" />
        <div className="h-4 w-1/2 mx-auto mb-8 bg-white/5 rounded-lg animate-pulse" />
        <div className="h-10 w-48 mx-auto bg-white/5 rounded-xl animate-pulse" />
      </div>
    </div>
  );
}
