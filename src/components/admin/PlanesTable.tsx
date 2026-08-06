import { useState } from 'react';
import { Skeleton } from '../ui/Skeleton';
import SearchFilters from './SearchFilters';

interface Plan {
  id: number;
  nombre: string;
  slug: string;
  descripcion: string;
  tipo: 'base' | 'extra';
  duracion_dias: number;
  precio: number;
  moneda: string;
  max_fotos: number;
  max_videos: number;
  max_pausas_permitidas: number;
  permite_vip: number;
  permite_destacado: number;
  uso_unico: number;
  badge: string;
  color_badge: string;
  orden: number;
  activo: number;
  creado_en: string;
  actualizado_en: string;
  total_suscripciones: number;
  total_escorts: number;
}

interface Props {
  planes: Plan[];
  loading: boolean;
  onRefresh: () => void;
}

interface FieldErrors {
  [key: string]: string;
}

export default function PlanesTable({ planes, loading, onRefresh }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Plan | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState('todos');
  const [tipoFilter, setTipoFilter] = useState('todos');

  const [formData, setFormData] = useState({
    nombre: '',
    slug: '',
    descripcion: '',
    tipo: 'base' as 'base' | 'extra',
    duracion_dias: 30,
    precio: 0,
    moneda: 'CLP',
    max_fotos: 5,
    max_videos: 0,
    permite_vip: 0,
    permite_destacado: 0,
    uso_unico: 0,
    max_pausas_permitidas: 3,
    badge: '',
    color_badge: '#6b7280',
    orden: 0,
    activo: 1,
  });

  const resetForm = () => {
    setFormData({
      nombre: '', slug: '', descripcion: '', tipo: 'base', duracion_dias: 30,
      precio: 0, moneda: 'CLP', max_fotos: 5, max_videos: 0,
      permite_vip: 0, permite_destacado: 0,
      uso_unico: 0, max_pausas_permitidas: 3, badge: '', color_badge: '#6b7280', orden: 0, activo: 1,
    });
    setFieldErrors({});
  };

  const openCreate = () => {
    setEditingPlan(null);
    resetForm();
    setShowModal(true);
  };

  const openEdit = (plan: Plan) => {
    setEditingPlan(plan);
    setFormData({
      nombre: plan.nombre, slug: plan.slug, descripcion: plan.descripcion || '',
      tipo: plan.tipo, duracion_dias: plan.duracion_dias, precio: plan.precio,
      moneda: plan.moneda, max_fotos: plan.max_fotos, max_videos: plan.max_videos,
      permite_vip: plan.permite_vip, permite_destacado: plan.permite_destacado,
      uso_unico: plan.uso_unico, max_pausas_permitidas: plan.max_pausas_permitidas,
      badge: plan.badge || '', color_badge: plan.color_badge || '#6b7280',
      orden: plan.orden, activo: plan.activo,
    });
    setFieldErrors({});
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFieldErrors({});

    try {
      const token = localStorage.getItem('admin_token');
      const method = editingPlan ? 'PUT' : 'POST';
      const body = editingPlan ? { ...formData, id: editingPlan.id } : formData;

      const res = await fetch('/api/admin/planes.php', {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (data.success) {
        setShowModal(false);
        resetForm();
        onRefresh();
      } else if (data.fieldErrors) {
        setFieldErrors(data.fieldErrors);
      } else {
        setErrorMsg(data.error || 'Error al guardar');
      }
    } catch (err) {
      setErrorMsg('Error de conexión');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`/api/admin/planes.php?id=${deleteConfirm.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + token },
      });
      const data = await res.json();
      if (data.success) {
        setDeleteConfirm(null);
        onRefresh();
      } else {
        setDeleteConfirm(null);
        setErrorMsg(data.error || 'Error al eliminar');
      }
    } catch (err) {
      setDeleteConfirm(null);
      setErrorMsg('Error de conexión');
    }
  };

  const toggleActivo = async (plan: Plan) => {
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch('/api/admin/planes.php', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ id: plan.id, activo: plan.activo ? 0 : 1 }),
      });
      const data = await res.json();
      if (data.success) onRefresh(); else setErrorMsg(data.error || 'Error');
    } catch (err) {
      setErrorMsg('Error de conexión');
    }
  };

  const formatPrice = (price: number, moneda: string) => {
    if (price === 0) return 'Gratis';
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: moneda, minimumFractionDigits: 0 }).format(price);
  };

  const filteredPlanes = planes.filter(p => {
    if (estado === 'activos' && p.activo !== 1) return false;
    if (estado === 'inactivos' && p.activo !== 0) return false;
    if (tipoFilter !== 'todos' && p.tipo !== tipoFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return p.nombre.toLowerCase().includes(s) || p.slug.toLowerCase().includes(s) || (p.badge && p.badge.toLowerCase().includes(s));
    }
    return true;
  });

  return (
    <div>
      <div className="flex items-start gap-4 mb-6">
        <div className="flex-1">
          <SearchFilters
            search={search}
            onSearch={setSearch}
            placeholder="Buscar planes..."
            filters={[
              { key: 'todos', label: 'Todos' },
              { key: 'activos', label: 'Activos' },
              { key: 'inactivos', label: 'Inactivos' },
            ]}
            activeFilter={estado}
            onFilterChange={setEstado}
          />
          <SearchFilters
            search={search}
            onSearch={setSearch}
            placeholder="Buscar planes..."
            hideSearch
            filters={[
              { key: 'todos', label: 'Todos tipos' },
              { key: 'base', label: 'Base' },
              { key: 'extra', label: 'Extras' },
            ]}
            activeFilter={tipoFilter}
            onFilterChange={setTipoFilter}
          />
        </div>
        <button onClick={openCreate} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors shrink-0">
          <i className="fas fa-plus"></i> Nuevo Plan
        </button>
      </div>

      {/* Table */}
      <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#2a2a3e] text-left text-xs text-gray-400 uppercase">
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Duración</th>
                <th className="px-4 py-3">Precio</th>
                <th className="px-4 py-3">Pausas</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-[#2a2a3e]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Skeleton width={24} height={24} borderRadius={9999} />
                        <div>
                          <Skeleton width={120} height={20} className="mb-1" />
                          <Skeleton width={60} height={14} />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><Skeleton width={60} height={20} borderRadius={9999} /></td>
                    <td className="px-4 py-3"><Skeleton width={80} height={20} /></td>
                    <td className="px-4 py-3"><Skeleton width={80} height={20} /></td>
                    <td className="px-4 py-3"><Skeleton width={50} height={20} /></td>
                    <td className="px-4 py-3"><Skeleton width={44} height={24} borderRadius={9999} /></td>
                    <td className="px-4 py-3 text-right"><Skeleton width={64} height={32} borderRadius={6} /></td>
                  </tr>
                ))
              ) : filteredPlanes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center">
                    <i className="fas fa-crown text-4xl text-gray-600 mb-4"></i>
                    <p className="text-gray-400 mb-4">No hay planes</p>
                    <button onClick={openCreate} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
                      Crear plan
                    </button>
                  </td>
                </tr>
              ) : (
                filteredPlanes.map((plan) => (
                  <tr key={plan.id} className={`border-b border-[#2a2a3e] last:border-0 hover:bg-[#252538] transition-colors ${plan.activo === 0 ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {plan.badge && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold text-white" style={{ backgroundColor: plan.color_badge }}>
                            {plan.badge}
                          </span>
                        )}
                        <div>
                          <div className="text-white font-medium text-sm">{plan.nombre}</div>
                          <div className="text-gray-500 text-xs">/{plan.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${plan.tipo === 'base' ? 'bg-purple-500/20 text-purple-400' : 'bg-amber-500/20 text-amber-400'}`}>
                        {plan.tipo === 'base' ? 'Base' : 'Extra'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-sm">
                      {plan.duracion_dias === 0 ? 'Permanente' : plan.duracion_dias + ' días'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-medium ${plan.precio === 0 ? 'text-gray-400 italic' : 'text-emerald-400'}`}>
                        {formatPrice(plan.precio, plan.moneda)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-sm ${plan.max_pausas_permitidas === 0 ? 'text-gray-500' : 'text-amber-400'}`}>
                        {plan.max_pausas_permitidas === 0 ? 'No' : plan.max_pausas_permitidas}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleActivo(plan)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${plan.activo === 1 ? 'bg-emerald-500' : 'bg-gray-600'}`}>
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${plan.activo === 1 ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEdit(plan)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#2a2a3e] text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors" title="Editar">
                          <i className="fas fa-edit text-sm"></i>
                        </button>
                        <button onClick={() => setDeleteConfirm(plan)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#2a2a3e] text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Eliminar">
                          <i className="fas fa-trash-alt text-sm"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Crear/Editar */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={() => setShowModal(false)}>
          <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-[#2a2a3e]">
              <h3 className="text-lg font-semibold text-white">
                <i className={`fas fa-${editingPlan ? 'edit' : 'plus'} mr-2`}></i>
                {editingPlan ? 'Editar Plan' : 'Nuevo Plan'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white transition-colors">
                <i className="fas fa-times"></i>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Tipo */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Tipo *</label>
                <div className="flex gap-3">
                  {(['base', 'extra'] as const).map((t) => (
                    <label key={t} className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border cursor-pointer transition-colors ${formData.tipo === t ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-[#2a2a3e] text-gray-400 hover:border-gray-600'}`}>
                      <input type="radio" name="tipo" value={t} checked={formData.tipo === t} onChange={(e) => setFormData({ ...formData, tipo: e.target.value as 'base' | 'extra', max_fotos: e.target.value === 'extra' ? 0 : formData.max_fotos, max_videos: e.target.value === 'extra' ? 0 : formData.max_videos })} className="hidden" />
                      <i className={`fas fa-${t === 'base' ? 'box' : 'puzzle-piece'}`}></i>
                      <span className="text-sm font-medium">{t === 'base' ? 'Plan Base' : 'Extra Adicional'}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className={fieldErrors.nombre ? 'space-y-1' : ''}>
                  <label className="block text-sm text-gray-400 mb-1">Nombre *</label>
                  <input type="text" value={formData.nombre} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    className={`w-full bg-[#252538] border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 ${fieldErrors.nombre ? 'border-red-500' : 'border-[#2a2a3e]'}`}
                    placeholder="Ej: Mensual" />
                  {fieldErrors.nombre && <p className="text-red-400 text-xs">{fieldErrors.nombre}</p>}
                </div>
                <div className={fieldErrors.slug ? 'space-y-1' : ''}>
                  <label className="block text-sm text-gray-400 mb-1">Slug</label>
                  <input type="text" value={formData.slug} onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    className={`w-full bg-[#252538] border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 ${fieldErrors.slug ? 'border-red-500' : 'border-[#2a2a3e]'}`}
                    placeholder="Auto-generado" />
                  {fieldErrors.slug && <p className="text-red-400 text-xs">{fieldErrors.slug}</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Descripción</label>
                <textarea value={formData.descripcion} onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })} rows={2}
                  className="w-full bg-[#252538] border border-[#2a2a3e] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 resize-none"
                  placeholder="Descripción del plan..." />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className={fieldErrors.duracion_dias ? 'space-y-1' : ''}>
                  <label className="block text-sm text-gray-400 mb-1">Duración (días) *</label>
                  <input type="number" min={0} value={formData.duracion_dias} onChange={(e) => setFormData({ ...formData, duracion_dias: parseInt(e.target.value) || 0 })}
                    className={`w-full bg-[#252538] border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 ${fieldErrors.duracion_dias ? 'border-red-500' : 'border-[#2a2a3e]'}`} />
                  <p className="text-gray-500 text-xs">0 = Permanente</p>
                  {fieldErrors.duracion_dias && <p className="text-red-400 text-xs">{fieldErrors.duracion_dias}</p>}
                </div>
                <div className={fieldErrors.precio ? 'space-y-1' : ''}>
                  <label className="block text-sm text-gray-400 mb-1">Precio</label>
                  <input type="number" min={0} step="0.01" value={formData.precio} onChange={(e) => setFormData({ ...formData, precio: parseFloat(e.target.value) || 0 })}
                    className={`w-full bg-[#252538] border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 ${fieldErrors.precio ? 'border-red-500' : 'border-[#2a2a3e]'}`} />
                  {fieldErrors.precio && <p className="text-red-400 text-xs">{fieldErrors.precio}</p>}
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Pausas máx.</label>
                  <input type="number" min={0} value={formData.max_pausas_permitidas} onChange={(e) => setFormData({ ...formData, max_pausas_permitidas: parseInt(e.target.value) || 0 })}
                    className="w-full bg-[#252538] border border-[#2a2a3e] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                  <p className="text-gray-500 text-xs">0 = No puede pausar</p>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Moneda</label>
                  <select value={formData.moneda} onChange={(e) => setFormData({ ...formData, moneda: e.target.value })}
                    className="w-full bg-[#252538] border border-[#2a2a3e] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500">
                    <option value="CLP">CLP</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {formData.tipo === 'base' && (
                  <>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Máx. Fotos</label>
                      <input type="number" min={0} value={formData.max_fotos} onChange={(e) => setFormData({ ...formData, max_fotos: parseInt(e.target.value) || 0 })}
                        className="w-full bg-[#252538] border border-[#2a2a3e] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Máx. Videos</label>
                      <input type="number" min={0} value={formData.max_videos} onChange={(e) => setFormData({ ...formData, max_videos: parseInt(e.target.value) || 0 })}
                        className="w-full bg-[#252538] border border-[#2a2a3e] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                    </div>
                  </>
                )}
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Orden</label>
                  <input type="number" value={formData.orden} onChange={(e) => setFormData({ ...formData, orden: parseInt(e.target.value) || 0 })}
                    className="w-full bg-[#252538] border border-[#2a2a3e] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Badge</label>
                  <input type="text" value={formData.badge} onChange={(e) => setFormData({ ...formData, badge: e.target.value })}
                    className="w-full bg-[#252538] border border-[#2a2a3e] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                    placeholder="Ej: Gratis, Premium" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Color Badge</label>
                  <div className="flex gap-2">
                    <input type="color" value={formData.color_badge} onChange={(e) => setFormData({ ...formData, color_badge: e.target.value })}
                      className="w-10 h-9 rounded border border-[#2a2a3e] bg-transparent cursor-pointer" />
                    <input type="text" value={formData.color_badge} onChange={(e) => setFormData({ ...formData, color_badge: e.target.value })}
                      className="flex-1 bg-[#252538] border border-[#2a2a3e] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                  </div>
                </div>
              </div>

              <div className="bg-[#252538] rounded-lg p-4 space-y-3">
                <p className="text-sm text-gray-400 font-medium">Permisos y opciones</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { key: 'permite_vip', label: 'Permite VIP', icon: 'fa-crown' },
                    { key: 'permite_destacado', label: 'Permite Destacado', icon: 'fa-star' },
                    { key: 'uso_unico', label: 'Uso único por email', icon: 'fa-fingerprint' },
                    { key: 'activo', label: 'Activo', icon: 'fa-power-off' },
                  ].map((item) => (
                    <label key={item.key} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={formData[item.key as keyof typeof formData] === 1}
                        onChange={(e) => setFormData({ ...formData, [item.key]: e.target.checked ? 1 : 0 })}
                        className="w-4 h-4 rounded border-gray-600 text-blue-600 focus:ring-blue-500 bg-[#1a1a2e]" />
                      <span className="text-sm text-gray-300 flex items-center gap-1.5">
                        <i className={`fas ${item.icon} text-xs text-gray-500`}></i>{item.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-[#2a2a3e] hover:bg-[#353550] text-gray-300 rounded-lg text-sm font-medium transition-colors">Cancelar</button>
                <button type="submit" disabled={submitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
                  {submitting && <i className="fas fa-spinner fa-spin"></i>}
                  {editingPlan ? 'Actualizar' : 'Crear'} Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Error */}
      {errorMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={() => setErrorMsg('')}>
          <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-exclamation-circle text-red-400 text-xl"></i>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Error</h3>
              <p className="text-gray-400 text-sm">{errorMsg}</p>
            </div>
            <button onClick={() => setErrorMsg('')} className="w-full px-4 py-2 bg-[#2a2a3e] hover:bg-[#353550] text-gray-300 rounded-lg text-sm font-medium transition-colors">
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Modal Eliminar */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-exclamation-triangle text-red-400 text-xl"></i>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">¿Eliminar plan?</h3>
              <p className="text-gray-400 text-sm">¿Eliminar <strong className="text-white">"{deleteConfirm.nombre}"</strong>?{(deleteConfirm.total_escorts ?? 0) > 0 && <span className="block mt-2 text-yellow-400"> Tiene {deleteConfirm.total_escorts} escort(s) asociada(s).</span>}</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 px-4 py-2 bg-[#2a2a3e] hover:bg-[#353550] text-gray-300 rounded-lg text-sm font-medium transition-colors">Cancelar</button>
              <button onClick={handleDelete} disabled={(deleteConfirm.total_escorts ?? 0) > 0} className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors">
                <i className="fas fa-trash-alt mr-1"></i> Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}