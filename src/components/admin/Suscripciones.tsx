import { useState, useEffect } from 'react';

interface Suscripcion {
  suscripcion_id: number;
  escort: {
    id: number;
    nombre: string;
    email: string;
    telefono: string | null;
    ciudad: string | null;
    foto_principal: string | null;
    verificado: boolean;
    vip: boolean;
  };
  plan: {
    id: number;
    nombre: string;
    slug: string;
    tipo: 'base' | 'extra';
    duracion_dias: number;
    precio: number;
    badge: string | null;
    color: string | null;
    permite_vip: boolean;
    permite_destacado: boolean;
  };
  suscripcion: {
    fecha_inicio: string | null;
    fecha_aprobacion: string | null;
    fecha_rechazo: string | null;
    fecha_fin: string | null;
    precio_pagado: number;
    moneda: string;
    estado: string;
    estado_raw: string;
    dias_restantes: number;
    auto_renovar: boolean;
    comprobante_pago: string | null;
    creado_en: string;
    contador_pausas: number;
    aprobado_por: string | null;
    rechazado_por: string | null;
  };
}

export default function Suscripciones() {
  const [suscripciones, setSuscripciones] = useState<Suscripcion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedSuscripcion, setSelectedSuscripcion] = useState<Suscripcion | null>(null);
  const [notasAdmin, setNotasAdmin] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [confirmarEliminar, setConfirmarEliminar] = useState<Suscripcion | null>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : '';

  useEffect(() => {
    fetchSuscripciones();
  }, [page]);

  const fetchSuscripciones = async () => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/admin/suscripciones.php?page=${page}&per_page=20`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await res.json();
      if (data.success) {
        setSuscripciones(data.suscripciones);
        setTotalPages(data.pagination.total_pages);
      } else {
        setError(data.error || 'Error cargando suscripciones');
      }
    } catch (e) {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const handleAprobar = async () => {
    if (!selectedSuscripcion) return;
    setProcesando(true);

    try {
      const res = await fetch('/api/admin/aprobar-suscripcion.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          suscripcion_id: selectedSuscripcion.suscripcion_id,
          accion: 'aprobar',
          notas: notasAdmin
        })
      });

      const data = await res.json();
      if (data.success) {
        setSelectedSuscripcion(null);
        setNotasAdmin('');
        fetchSuscripciones();
      } else {
        setError(data.error || 'Error al aprobar');
      }
    } catch (e) {
      setError('Error de conexión');
    } finally {
      setProcesando(false);
    }
  };

  const handleRechazar = async () => {
    if (!selectedSuscripcion) return;
    setProcesando(true);

    try {
      const res = await fetch('/api/admin/aprobar-suscripcion.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          suscripcion_id: selectedSuscripcion.suscripcion_id,
          accion: 'rechazar',
          notas: notasAdmin
        })
      });

      const data = await res.json();
      if (data.success) {
        setSelectedSuscripcion(null);
        setNotasAdmin('');
        fetchSuscripciones();
      } else {
        setError(data.error || 'Error al rechazar');
      }
    } catch (e) {
      setError('Error de conexión');
    } finally {
      setProcesando(false);
    }
  };

  const handleEliminar = async () => {
    if (!confirmarEliminar) return;
    setProcesando(true);

    try {
      const res = await fetch('/api/admin/eliminar-suscripcion.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          suscripcion_id: confirmarEliminar.suscripcion_id
        })
      });

      const data = await res.json();
      if (data.success) {
        setConfirmarEliminar(null);
        fetchSuscripciones();
      } else {
        setError(data.error || 'Error al eliminar');
      }
    } catch (e) {
      setError('Error de conexión');
    } finally {
      setProcesando(false);
    }
  };

  const getEstadoBadge = (estado: string) => {
    const styles: Record<string, string> = {
      activa: 'bg-green-500/10 text-green-400 border-green-500/20',
      pendiente_aprobacion: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      pausada: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      expirada: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
      rechazada: 'bg-red-500/10 text-red-400 border-red-500/20',
      cancelada: 'bg-purple-500/10 text-purple-400 border-purple-500/20'
    };
    return styles[estado] || 'bg-gray-500/10 text-gray-400 border-gray-500/20';
  };

  const estadoLabels: Record<string, string> = {
    activa: 'Activa',
    pendiente_aprobacion: 'Pendiente',
    pausada: 'Pausada',
    expirada: 'Expirada',
    rechazada: 'Rechazada',
    cancelada: 'Cancelada'
  };

  if (loading && suscripciones.length === 0) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse bg-[#13131a] border border-gray-800 rounded-2xl p-6 h-32" />
        <div className="animate-pulse bg-[#13131a] border border-gray-800 rounded-2xl p-6 h-32" />
        <div className="animate-pulse bg-[#13131a] border border-gray-800 rounded-2xl p-6 h-32" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Suscripciones</h1>
          <p className="text-gray-500 text-sm mt-1">Todas las suscripciones de planes base y extras</p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl flex items-center gap-2">
          <i className="fas fa-exclamation-triangle" />
          {error}
          <button onClick={() => setError('')} className="ml-auto text-sm hover:text-red-300">✕</button>
        </div>
      )}

      {/* Tabla */}
      <div className="bg-[#13131a] border border-gray-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left text-gray-400 text-xs uppercase tracking-wider px-6 py-4">Escort</th>
                <th className="text-left text-gray-400 text-xs uppercase tracking-wider px-6 py-4">Plan</th>
                <th className="text-left text-gray-400 text-xs uppercase tracking-wider px-6 py-4">Estado</th>
                <th className="text-left text-gray-400 text-xs uppercase tracking-wider px-6 py-4">Vencimiento</th>
                <th className="text-left text-gray-400 text-xs uppercase tracking-wider px-6 py-4">Pago</th>
                <th className="text-right text-gray-400 text-xs uppercase tracking-wider px-6 py-4">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {suscripciones.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <i className="fas fa-inbox text-3xl mb-3 block" />
                    No hay suscripciones
                  </td>
                </tr>
              ) : (
                suscripciones.map(sub => (
                  <tr key={sub.suscripcion_id} className="hover:bg-[#1a1a24] transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gray-800 overflow-hidden flex-shrink-0">
                          {sub.escort.foto_principal ? (
                            <img src={sub.escort.foto_principal} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-600">
                              <i className="fas fa-user" />
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="text-white font-medium text-sm flex items-center gap-2">
                            {sub.escort.nombre}
                            {sub.escort.verificado && (
                              <i className="fas fa-check-circle text-blue-400 text-xs" title="Verificada" />
                            )}
                            {sub.escort.vip && (
                              <i className="fas fa-crown text-amber-400 text-xs" title="VIP" />
                            )}
                          </div>
                          <div className="text-gray-500 text-xs">{sub.escort.email}</div>
                          {sub.escort.ciudad && (
                            <div className="text-gray-600 text-xs">
                              <i className="fas fa-map-marker-alt mr-1" />
                              {sub.escort.ciudad}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium"
                          style={{
                            backgroundColor: (sub.plan.color || '#6366f1') + '15',
                            color: sub.plan.color || '#6366f1',
                            border: `1px solid ${(sub.plan.color || '#6366f1')}30`
                          }}
                        >
                          {sub.plan.badge || sub.plan.nombre}
                        </span>
                        {sub.plan.tipo === 'extra' && (
                          <span className="text-purple-400 text-xs">
                            <i className="fas fa-star mr-1" />Extra
                          </span>
                        )}
                      </div>
                      <div className="text-gray-500 text-xs mt-1">{sub.plan.duracion_dias} días</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border ${getEstadoBadge(sub.suscripcion.estado)}`}>
                        {estadoLabels[sub.suscripcion.estado] || sub.suscripcion.estado}
                      </span>
                      {sub.suscripcion.contador_pausas > 0 && (
                        <div className="text-gray-600 text-xs mt-1">
                          <i className="fas fa-pause-circle mr-1" />
                          {sub.suscripcion.contador_pausas} pausas
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {sub.suscripcion.fecha_fin ? (
                        <div>
                          <div className="text-white text-sm">
                            {new Date(sub.suscripcion.fecha_fin).toLocaleDateString('es-CL')}
                          </div>
                          {sub.suscripcion.dias_restantes > 0 && sub.suscripcion.estado === 'activa' && (
                            <div className="text-green-400 text-xs">
                              {sub.suscripcion.dias_restantes} días restantes
                            </div>
                          )}
                          {sub.suscripcion.dias_restantes <= 0 && sub.suscripcion.estado === 'activa' && (
                            <div className="text-red-400 text-xs">Vencido</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-600 text-xs">Sin fecha</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-white text-sm font-medium">
                        ${sub.suscripcion.precio_pagado.toLocaleString()}
                      </div>
                      <div className="text-gray-500 text-xs">{sub.suscripcion.moneda}</div>
                      {sub.suscripcion.comprobante_pago && (
                        <a
                          href={sub.suscripcion.comprobante_pago}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 text-xs inline-flex items-center gap-1 mt-1"
                        >
                          <i className="fas fa-receipt" /> Ver
                        </a>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Aprobar/Rechazar si está pendiente */}
                        {sub.suscripcion.estado === 'pendiente_aprobacion' && (
                          <button
                            onClick={() => {
                              setSelectedSuscripcion(sub);
                              setNotasAdmin('');
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors text-xs font-medium"
                            title="Revisar y aprobar/rechazar"
                          >
                            <i className="fas fa-gavel" />
                            Revisar
                          </button>
                        )}

                        {/* Cancelar/Eliminar si está activa o pendiente */}
                        {(sub.suscripcion.estado === 'activa' || sub.suscripcion.estado === 'pendiente_aprobacion') && (
                          <button
                            onClick={() => setConfirmarEliminar(sub)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors text-xs font-medium"
                            title="Cancelar y eliminar suscripción"
                          >
                            <i className="fas fa-trash-alt" />
                            Cancelar
                          </button>
                        )}

                        {/* Ya procesada */}
                        {sub.suscripcion.estado !== 'pendiente_aprobacion' && 
                         sub.suscripcion.estado !== 'activa' && (
                          <span className="text-gray-600 text-xs">
                            {sub.suscripcion.aprobado_por ? `Aprob. ${sub.suscripcion.aprobado_por}` : 
                             sub.suscripcion.rechazado_por ? `Rech. ${sub.suscripcion.rechazado_por}` : 
                             'Finalizado'}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-800">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed text-sm"
            >
              <i className="fas fa-chevron-left mr-1" /> Anterior
            </button>
            <span className="text-gray-500 text-sm">Página {page} de {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed text-sm"
            >
              Siguiente <i className="fas fa-chevron-right ml-1" />
            </button>
          </div>
        )}
      </div>

      {/* Modal de aprobar/rechazar */}
      {selectedSuscripcion && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#1a1a2e] border border-gray-800 rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="p-6 border-b border-gray-800">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <i className={`fas ${selectedSuscripcion.plan.tipo === 'base' ? 'fa-gem' : 'fa-star'} text-blue-400 text-xl`} />
                </div>
                <div>
                  <h3 className="text-white font-bold">Revisar Suscripción</h3>
                  <p className="text-gray-500 text-sm">{selectedSuscripcion.escort.nombre}</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-[#13131a] rounded-xl p-3">
                  <div className="text-gray-500 text-xs mb-1">Plan</div>
                  <div className="text-white font-medium">{selectedSuscripcion.plan.nombre}</div>
                  <div className="text-gray-500 text-xs">{selectedSuscripcion.plan.duracion_dias} días · ${selectedSuscripcion.plan.precio.toLocaleString()}</div>
                </div>
                <div className="bg-[#13131a] rounded-xl p-3">
                  <div className="text-gray-500 text-xs mb-1">Tipo</div>
                  <div className={selectedSuscripcion.plan.tipo === 'base' ? 'text-blue-400' : 'text-purple-400'}>
                    {selectedSuscripcion.plan.tipo === 'base' ? 'Plan Base' : 'Extra (Destacado)'}
                  </div>
                </div>
              </div>

              {selectedSuscripcion.suscripcion.comprobante_pago && (
                <div className="bg-[#13131a] rounded-xl p-3">
                  <div className="text-gray-500 text-xs mb-2">Comprobante de pago</div>
                  <a
                    href={selectedSuscripcion.suscripcion.comprobante_pago}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm"
                  >
                    <i className="fas fa-external-link-alt" />
                    Ver comprobante
                  </a>
                </div>
              )}

              <div>
                <label className="block text-gray-500 text-xs uppercase tracking-wider mb-2">
                  Notas (opcional para aprobar, requerido para rechazar)
                </label>
                <textarea
                  value={notasAdmin}
                  onChange={(e) => setNotasAdmin(e.target.value)}
                  placeholder="Observaciones, motivo de rechazo, etc..."
                  rows={3}
                  className="w-full bg-[#13131a] border border-gray-700 rounded-xl py-3 px-4 text-white placeholder-gray-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/30 transition-all text-sm resize-none"
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-800 flex gap-3">
              <button
                onClick={() => setSelectedSuscripcion(null)}
                className="flex-1 px-4 py-2.5 bg-[#2d2d44] hover:bg-[#3d3d5c] text-white font-medium rounded-xl transition-colors text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleRechazar}
                disabled={procesando}
                className="flex-1 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-medium rounded-xl transition-colors text-sm border border-red-500/20"
              >
                {procesando ? <i className="fas fa-circle-notch fa-spin" /> : <><i className="fas fa-times mr-1" /> Rechazar</>}
              </button>
              <button
                onClick={handleAprobar}
                disabled={procesando}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-green-500/20 text-sm"
              >
                {procesando ? <i className="fas fa-circle-notch fa-spin" /> : <><i className="fas fa-check mr-1" /> Aprobar</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmar eliminar/cancelar */}
      {confirmarEliminar && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#1a1a2e] border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl p-6">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                <i className="fas fa-exclamation-triangle text-red-400 text-xl" />
              </div>
              <h3 className="text-white font-bold text-lg">¿Cancelar suscripción?</h3>
              <p className="text-gray-400 text-sm mt-2">
                Esto eliminará la suscripción de <strong className="text-white">{confirmarEliminar.plan.nombre}</strong> de <strong className="text-white">{confirmarEliminar.escort.nombre}</strong>.
              </p>
              {confirmarEliminar.plan.tipo === 'base' && (
                <p className="text-amber-400 text-xs mt-3 bg-amber-500/10 rounded-lg px-3 py-2">
                  <i className="fas fa-exclamation-circle mr-1" />
                  Al eliminar el plan base, también se perderá el VIP y los extras activos.
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setConfirmarEliminar(null)}
                className="flex-1 px-4 py-2.5 bg-[#2d2d44] hover:bg-[#3d3d5c] text-white font-medium rounded-xl transition-colors text-sm"
              >
                No, mantener
              </button>
              <button
                onClick={handleEliminar}
                disabled={procesando}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-red-500/20 text-sm"
              >
                {procesando ? <i className="fas fa-circle-notch fa-spin" /> : <><i className="fas fa-trash-alt mr-1" /> Sí, cancelar</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}