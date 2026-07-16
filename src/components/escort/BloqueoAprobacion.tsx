// src/components/escort/BloqueoAprobacion.tsx
// Tarjeta que se muestra en lugar de los formularios mientras la cuenta
// de la escort está pendiente de aprobación del administrador.

export default function BloqueoAprobacion() {
  return (
    <div className="w-full max-w-full mx-auto my-10">
      <div className="bg-[#13131a] border border-amber-500/30 rounded-2xl p-8 md:p-10 text-center shadow-lg shadow-amber-500/5">
        <div className="w-16 h-16 mx-auto mb-5 bg-amber-500/10 rounded-2xl flex items-center justify-center">
          <i className="fas fa-lock text-amber-400 text-2xl"></i>
        </div>

        <h2 className="text-xl md:text-2xl font-bold text-white mb-2">
          Cuenta pendiente de aprobación
        </h2>

        <p className="text-gray-400 text-sm leading-relaxed mb-6">
          Gracias por registrarte. Tus datos, fotos, planes y el resto de tu
          panel aparecerán <span className="text-amber-400 font-medium">habilitados</span>{' '}
          una vez que el administrador apruebe tu cuenta. Te avisaremos por
          esta misma bandeja de notificaciones cuando esté lista.
        </p>

        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium">
          <i className="fas fa-hourglass-half"></i>
          Esperando aprobación del administrador
        </div>
      </div>
    </div>
  );
}
