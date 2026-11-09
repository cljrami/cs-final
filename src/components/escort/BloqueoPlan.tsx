// src/components/escort/BloqueoPlan.tsx
// ÚNICA pantalla de bloqueo por plan para TODAS las secciones del panel
// (perfil, fotos, historias, comentarios, estadísticas, datos, extras, VIP,
// verificación, pausar-aviso y resumen). No muestra la pantalla de la sección:
// solo el aviso + CTA para activar/contratar el plan.
// - motivo "vencido": el plan anterior venció → nada del panel se puede
//   modificar hasta contratar un nuevo plan.
// - motivo "sin-plan": la cuenta aún no tiene plan.
// El historial (pagos, comentarios, estadísticas pasadas) se conserva intacto.

interface Props {
  motivo?: 'vencido' | 'sin-plan';
}

export default function BloqueoPlan({ motivo = 'sin-plan' }: Props) {
  const esVencido = motivo === 'vencido';

  return (
    <div className="w-full max-w-full mx-auto my-10">
      <div className="bg-[#13131a] border border-red-500/30 rounded-2xl p-8 md:p-10 text-center shadow-lg shadow-red-500/5">
        <div className="w-16 h-16 mx-auto mb-5 bg-red-500/10 rounded-2xl flex items-center justify-center">
          <i className="fas fa-lock text-red-400 text-2xl"></i>
        </div>

        <h2 className="text-xl md:text-2xl font-bold text-white mb-2">
          {esVencido ? 'Tu plan está vencido' : 'Sin plan activo'}
        </h2>

        <p className="text-gray-400 text-sm leading-relaxed mb-6 max-w-lg mx-auto">
          {esVencido
            ? 'No puedes modificar nada de tu panel mientras tu plan esté vencido. Contrata un nuevo plan para reactivar tu anuncio y volver a editar tus datos.'
            : 'Activa tu plan para poder editar tus datos.'}
        </p>

        <a
          href="/micuenta/mi-plan"
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-red-500/20"
        >
          <i className="fas fa-credit-card"></i>
          {esVencido ? 'Contratar un nuevo plan' : 'Activar mi plan'}
        </a>

        <div className="mt-6">
          <a
            href="/micuenta/pagos"
            className="inline-flex items-center gap-2 text-gray-500 hover:text-white transition-colors text-xs"
          >
            <i className="fas fa-receipt"></i>
            Ver mi historial de pagos
          </a>
        </div>
      </div>
    </div>
  );
}
