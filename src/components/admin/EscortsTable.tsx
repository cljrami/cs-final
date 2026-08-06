// src/components/admin/EscortsTable.tsx

import { useState, useMemo, useRef, useEffect } from 'react';
import { Skeleton } from '../ui/Skeleton';

interface Escort {
  id: number;
  nombre: string;
  edad: number;
  ciudad: string;
  estado: string;
  verificado: number;
  vip: number;
  activa: number;
  created_at: string;
}

interface EscortsTableProps {
  escorts: Escort[];
  loading?: boolean;
  onRefresh?: () => void;
}

const estadoConfig: Record<number, { bg: string; text: string; icon: string; label: string }> = {
  0: { bg: '#3d3d1a', text: '#fbbf24', icon: 'fa-clock', label: 'Pendiente' },
  1: { bg: '#1a3d2e', text: '#10b981', icon: 'fa-check-circle', label: 'Aprobada' },
  '-1': { bg: '#3d1a1a', text: '#ef4444', icon: 'fa-times-circle', label: 'Rechazada' },
};

export default function EscortsTable({ escorts, loading, onRefresh }: EscortsTableProps) {
  const [filter, setFilter] = useState('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [menuOpen, setMenuOpen] = useState<number | null>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const [actionLoading, setActionLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [confirmModal, setConfirmModal] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const menuButtonRefs = useRef<Record<number, HTMLButtonElement | null>>({});

  const confirmAction = (message: string, onConfirm: () => void) => {
    setConfirmModal({ message, onConfirm });
  };

  const filters = [
    { id: 'pendientes', label: 'Pendientes', icon: 'fa-clock' },
    { id: 'aprobadas', label: 'Aprobadas', icon: 'fa-check' },
    { id: 'rechazadas', label: 'Rechazadas', icon: 'fa-times' },
    { id: 'todos', label: 'Todos', icon: 'fa-list' },
    { id: 'papelera', label: 'Papelera', icon: 'fa-trash' },
  ];

  const filteredEscorts = useMemo(() => {
    let result = [...escorts];

    switch (filter) {
      case 'pendientes':
        result = result.filter(e => e.activa === 0);
        break;
      case 'aprobadas':
        result = result.filter(e => e.activa === 1);
        break;
      case 'rechazadas':
        result = result.filter(e => e.activa === -1);
        break;
      case 'papelera':
        result = [];
        break;
      case 'todos':
      default:
        break;
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(e => 
        e.nombre.toLowerCase().includes(term) ||
        e.ciudad.toLowerCase().includes(term)
      );
    }

    return result;
  }, [escorts, filter, searchTerm]);

  const toggleMenu = (escortId: number) => {
    if (menuOpen === escortId) {
      setMenuOpen(null);
      return;
    }

    const btn = menuButtonRefs.current[escortId];
    if (btn) {
      const rect = btn.getBoundingClientRect();
      // Posicionar el menú arriba del botón si está muy abajo en la pantalla
      const spaceBelow = window.innerHeight - rect.bottom;
      const menuHeight = 200; // aproximado
      
      let top = rect.bottom + 8;
      if (spaceBelow < menuHeight && rect.top > menuHeight) {
        top = rect.top - menuHeight - 8;
      }

      setMenuPos({
        top,
        left: rect.right - 192, // 192 = w-48 (12rem)
      });
      setMenuOpen(escortId);
    }
  };

  const callApi = async (endpoint: string, body: object) => {
    setApiError('');
    setActionLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`/api/admin/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        if (onRefresh) onRefresh();
      } else {
        setApiError(data.error || 'Error del servidor');
      }
    } catch (e) {
      setApiError('Error de conexión: ' + (e instanceof Error ? e.message : 'desconocido'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleAction = (action: string, escortId: number) => {
    setMenuOpen(null);
    
    switch (action) {
      case 'aprobar':
        confirmAction('¿Aprobar esta escort?', () => callApi('escort-aprobar', { id: escortId }));
        break;
      case 'rechazar':
        confirmAction('¿Rechazar esta escort?', () => callApi('escort-rechazar', { id: escortId }));
        break;
      case 'editar': {
        const adminToken = localStorage.getItem('admin_token');
        if (!adminToken) {
          setApiError('Sesión de administrador no encontrada');
          break;
        }
        setApiError('');
        setActionLoading(true);
        (async () => {
          try {
            const res = await fetch(`/api/admin/escort-login-as.php?id=${escortId}`, {
              headers: { Authorization: 'Bearer ' + adminToken },
            });
            const data = await res.json();
            if (data.success) {
              localStorage.setItem('escort_token', data.token);
              localStorage.setItem('escort_data', JSON.stringify(data.escort || { id: escortId }));
              window.open('/micuenta/perfil', '_blank');
            } else {
              setApiError(data.error || 'No se pudo abrir el editor');
            }
          } catch (e) {
            setApiError('Error de conexión');
          } finally {
            setActionLoading(false);
          }
        })();
        break;
      }
      case 'eliminar':
        confirmAction('¿Eliminar esta escort?', () => callApi('escort-eliminar', { id: escortId }));
        break;
      case 'ver':
        window.open(`/${escortId}`, '_blank');
        break;
    }
  };

  // Cerrar menú al hacer click fuera o al presionar Escape
  useEffect(() => {
    if (!menuOpen) return;

    const handleClick = () => setMenuOpen(null);
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(null);
    };

    // Delay para no cerrar inmediatamente al abrir
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClick);
    }, 100);

    document.addEventListener('keydown', handleEscape);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [menuOpen]);

  return (
    <div>
      {apiError && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-4 text-red-400 text-sm flex items-center gap-2">
          <i className="fas fa-exclamation-circle"></i>
          {apiError}
          <button onClick={() => setApiError('')} className="ml-auto text-red-400/60 hover:text-red-400"><i className="fas fa-times"></i></button>
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {filters.map(f => (
          <button
            key={f.id}
            onClick={() => !loading && setFilter(f.id)}
            disabled={loading}
            className={`
              flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium
              whitespace-nowrap flex-shrink-0 transition-all
              ${loading 
                ? 'opacity-50 cursor-not-allowed bg-admin-card text-admin-muted' 
                : filter === f.id 
                  ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg shadow-red-500/20' 
                  : 'bg-admin-card text-admin-muted hover:text-white hover:bg-[#252538]'
              }
            `}
          >
            <i className={`fas ${f.icon}`}></i>
            {f.label}
          </button>
        ))}
        
        <div className="flex-1 min-w-4" />
        
        <div className={`flex items-center bg-admin-card border border-admin-border rounded-lg px-4 flex-shrink-0 ${loading ? 'opacity-50' : 'focus-within:border-yellow-400'} transition-colors`}>
          <i className="fas fa-search text-gray-500"></i>
          <input
            type="text"
            placeholder="Buscar escort..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            disabled={loading}
            className="bg-transparent border-none text-white px-3 py-2.5 outline-none text-sm min-w-[150px] placeholder-gray-600"
          />
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-admin-card border border-admin-border rounded-2xl overflow-x-auto">
        <table className="w-full min-w-[600px] border-collapse">
          <thead>
            <tr className="border-b border-admin-border">
              <th className="p-4 text-left text-xs text-admin-muted uppercase tracking-wider">
                <i className="fas fa-user mr-2"></i>Escort
              </th>
              <th className="p-4 text-left text-xs text-admin-muted uppercase tracking-wider">
                <i className="fas fa-map-marker-alt mr-2"></i>Ciudad
              </th>
              <th className="p-4 text-left text-xs text-admin-muted uppercase tracking-wider">
                <i className="fas fa-tag mr-2"></i>Estado
              </th>
              <th className="p-4 text-center text-xs text-admin-muted uppercase tracking-wider">
                <i className="fas fa-shield-alt"></i>
              </th>
              <th className="p-4 text-center text-xs text-admin-muted uppercase tracking-wider">
                <i className="fas fa-crown"></i>
              </th>
              <th className="p-4 text-right text-xs text-admin-muted uppercase tracking-wider">
                <i className="fas fa-cog"></i>
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, rowIndex) => (
                <tr key={rowIndex} className="border-b border-admin-border">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <Skeleton circle width={40} height={40} />
                      <div>
                        <Skeleton width={120} height={16} className="mb-1" />
                        <Skeleton width={60} height={12} />
                      </div>
                    </div>
                  </td>
                  <td className="p-4"><Skeleton width={80} height={16} /></td>
                  <td className="p-4"><Skeleton width={70} height={24} borderRadius={9999} /></td>
                  <td className="p-4 text-center"><Skeleton circle width={16} height={16} /></td>
                  <td className="p-4 text-center"><Skeleton circle width={16} height={16} /></td>
                  <td className="p-4 text-right">
                    <Skeleton width={32} height={32} borderRadius={6} />
                  </td>
                </tr>
              ))
            ) : filteredEscorts.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-12 text-center text-admin-muted">
                  <i className="fas fa-inbox text-4xl mb-4 block opacity-30"></i>
                  No hay escorts para mostrar
                </td>
              </tr>
            ) : (
              filteredEscorts.map(escort => {
                const estado = estadoConfig[escort.activa] || estadoConfig[0];
                
                return (
                  <tr 
                    key={escort.id} 
                    className="border-b border-admin-border transition-colors hover:bg-[#252538]"
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 min-w-[40px] bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-lg flex items-center justify-center">
                          <i className="fas fa-user text-black"></i>
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium whitespace-nowrap text-sm">{escort.nombre}</div>
                          <div className="text-xs text-admin-muted">{escort.edad} años</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-admin-muted whitespace-nowrap text-sm">
                      <i className="fas fa-map-marker-alt mr-2 text-gray-600"></i>
                      {escort.ciudad}
                    </td>
                    <td className="p-4">
                      <span 
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap"
                        style={{ backgroundColor: estado.bg, color: estado.text }}
                      >
                        <i className={`fas ${estado.icon} text-[0.6rem]`}></i>
                        {estado.label}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      {escort.verificado ? (
                        <i className="fas fa-check-circle text-green-500" title="Verificada"></i>
                      ) : (
                        <i className="fas fa-clock text-yellow-400" title="Pendiente"></i>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      {escort.vip ? (
                        <i className="fas fa-crown text-yellow-400" title="VIP"></i>
                      ) : (
                        <span className="text-gray-700">—</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <button 
                        ref={el => { menuButtonRefs.current[escort.id] = el; }}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleMenu(escort.id);
                        }}
                        className="bg-transparent border border-admin-border text-admin-muted p-2 rounded-lg hover:text-white hover:border-admin-muted transition-colors"
                      >
                        <i className="fas fa-ellipsis-v"></i>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal: Confirmación */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={() => setConfirmModal(null)}>
          <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                  <i className="fas fa-question-circle text-yellow-400 text-lg"></i>
                </div>
                <p className="text-white text-sm leading-relaxed">{confirmModal.message}</p>
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setConfirmModal(null)}
                  className="px-4 py-2 bg-[#2a2a3e] hover:bg-[#353550] text-gray-300 rounded-lg text-sm font-medium transition-colors">
                  Cancelar
                </button>
                <button onClick={() => { confirmModal.onConfirm(); setConfirmModal(null); }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Menú desplegable FUERA de la tabla (fixed, no se corta) */}
      {menuOpen && (
        <div 
          className="fixed w-48 bg-[#1a1a2e] border border-admin-border rounded-xl shadow-xl z-[200] overflow-hidden"
          style={{ top: menuPos.top, left: menuPos.left }}
          onClick={(e) => e.stopPropagation()}
        >
          {(() => {
            const escort = filteredEscorts.find(e => e.id === menuOpen);
            if (!escort) return null;
            
            return (
              <div className="py-1">
                <button
                  onClick={() => handleAction('ver', escort.id)}
                  className="w-full text-left px-4 py-2.5 text-sm text-admin-muted hover:bg-[#2d2d44] hover:text-white transition-colors flex items-center gap-2"
                >
                  <i className="fas fa-eye w-4"></i>Ver perfil
                </button>
                
                {escort.activa === 0 && (
                  <button
                    onClick={() => handleAction('aprobar', escort.id)}
                    className="w-full text-left px-4 py-2.5 text-sm text-green-400 hover:bg-[#2d2d44] transition-colors flex items-center gap-2"
                  >
                    <i className="fas fa-check w-4"></i>Aprobar
                  </button>
                )}
                
                {escort.activa === 0 && (
                  <button
                    onClick={() => handleAction('rechazar', escort.id)}
                    className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-[#2d2d44] transition-colors flex items-center gap-2"
                  >
                    <i className="fas fa-times w-4"></i>Rechazar
                  </button>
                )}
                
                <button
                  onClick={() => handleAction('editar', escort.id)}
                  className="w-full text-left px-4 py-2.5 text-sm text-admin-muted hover:bg-[#2d2d44] hover:text-white transition-colors flex items-center gap-2"
                >
                  <i className="fas fa-edit w-4"></i>Editar
                </button>
                
                <button
                  onClick={() => handleAction('eliminar', escort.id)}
                  className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-[#2d2d44] transition-colors flex items-center gap-2"
                >
                  <i className="fas fa-trash w-4"></i>Eliminar
                </button>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}