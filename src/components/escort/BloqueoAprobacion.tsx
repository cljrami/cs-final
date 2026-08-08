// src/components/escort/BloqueoAprobacion.tsx
// Tarjeta que se muestra en lugar de los formularios del panel mientras la
// cuenta de la escort está pendiente de aprobación (plan/pago en moderación).
// El único acceso permitido en este estado es "Mi Plan" para seleccionar plan.

export default function BloqueoAprobacion() {
  return (
    <div className="w-full max-w-full mx-auto my-10">
      <div className="bg-[#13131a] border border-amber-500/30 rounded-2xl p-8 md:p-10 text-center shadow-lg shadow-amber-500/5">
        <div className="w-16 h-16 mx-auto mb-5 bg-amber-500/10 rounded-2xl flex items-center justify-center">
          <i className="fas fa-lock text-amber-400 text-2xl"></i>
        </div>

        <h2 className="text-xl md:text-2xl font-bold text-white mb-2">
          Tus datos estarán disponibles cuando se apruebe tu suscripción
        </h2>

        <p className="text-gray-400 text-sm leading-relaxed mb-3 max-w-lg mx-auto">
          Esta sección se encuentra inactiva porque aún no se encuentra{' '}
          <span className="text-amber-400 font-medium">aprobado tu plan y tu pago</span>.
        </p>
        <p className="text-gray-500 text-sm leading-relaxed mb-6 max-w-lg mx-auto">
          Selecciona un plan para enviar tu solicitud al administrador. Una vez aprobada,
          podrás completar tu perfil, subir fotos y contratar extras desde tu panel.
        </p>

        <a
          href="/micuenta/mi-plan"
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-amber-500/20"
        >
          <i className="fas fa-credit-card"></i>
          Seleccionar mi plan
        </a>

        <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium">
          <i className="fas fa-hourglass-half"></i>
          Esperando aprobación del administrador
        </div>
      </div>
    </div>
  );
}
