import { useState, useEffect, useCallback } from 'react';
import DataTable from '../ui/DataTable';
import type { Column, ActionItem } from '../ui/DataTable';
import ConfirmModal from '../ui/ConfirmModal';
import StatCard from '../ui/StatCard';

const API_URL = '/api/admin/administradores.php';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('admin_token') || '';
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
}

interface AdminUser {
  id: number;
  nombre: string;
  email: string;
  rol: string;
  activo: boolean;
  ultimo_login: string | null;
  created_at: string;
}

export default function AdministradoresData() {
  const [items, setItems] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState({ total: 0, superadmins: 0, admins: 0, moderadores: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'crear' | 'editar'>('crear');
  const [editingItem, setEditingItem] = useState<AdminUser | null>(null);
  const [formData, setFormData] = useState({ nombre: '', email: '', password: '', rol: 'moderador' });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingItem, setDeletingItem] = useState<AdminUser | null>(null);

  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem('admin_user') || '{}');
    } catch { return {}; }
  })();
  const isSuperadmin = currentUser?.rol === 'superadmin';

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ search });
      const res = await fetch(`${API_URL}?${params}`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error');
      setItems(data.admins || []);
      setStats(data.stats || { total: 0, superadmins: 0, admins: 0, moderadores: 0 });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchItems(); }, []);

  const openCreate = () => {
    setModalMode('crear');
    setEditingItem(null);
    setFormData({ nombre: '', email: '', password: '', rol: 'moderador' });
    setFieldErrors({});
    setShowModal(true);
  };

  const openEdit = (item: AdminUser) => {
    setModalMode('editar');
    setEditingItem(item);
    setFormData({ nombre: item.nombre, email: item.email, password: '', rol: item.rol });
    setFieldErrors({});
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setFieldErrors({});
    try {
      const isCreate = modalMode === 'crear';
      const body: any = {};
      if (isCreate) {
        body.nombre = formData.nombre;
        body.email = formData.email;
        body.password = formData.password;
        body.rol = formData.rol;
      } else {
        body.id = editingItem!.id;
        if (formData.nombre !== editingItem!.nombre) body.nombre = formData.nombre;
        if (formData.email !== editingItem!.email) body.email = formData.email;
        if (formData.password) body.password = formData.password;
        if (formData.rol !== editingItem!.rol) body.rol = formData.rol;
      }

      const res = await fetch(API_URL, {
        method: isCreate ? 'POST' : 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) {
        if (data.fieldErrors) { setFieldErrors(data.fieldErrors); return; }
        throw new Error(data.error || 'Error');
      }
      setSuccessMsg(isCreate ? 'Administrador creado' : 'Administrador actualizado');
      setTimeout(() => setSuccessMsg(''), 3000);
      setShowModal(false);
      fetchItems();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (item: AdminUser) => {
    setDeletingItem(item);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!deletingItem) return;
    try {
      const res = await fetch(API_URL, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id: deletingItem.id }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error');
      setSuccessMsg('Administrador eliminado');
      setTimeout(() => setSuccessMsg(''), 3000);
      setShowDeleteModal(false);
      setDeletingItem(null);
      fetchItems();
    } catch (err: any) {
      setError(err.message);
      setShowDeleteModal(false);
    }
  };

  const toggleActivo = async (item: AdminUser) => {
    try {
      const res = await fetch(API_URL, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id: item.id, activo: !item.activo }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error');
      setSuccessMsg(item.activo ? 'Administrador desactivado' : 'Administrador activado');
      setTimeout(() => setSuccessMsg(''), 3000);
      fetchItems();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const columns: Column<AdminUser>[] = [
    {
      key: 'nombre', header: 'Administrador', width: '200',
      render: (item) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-white text-xs font-bold">
            {item.nombre?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div>
            <div className="font-medium text-sm text-white">{item.nombre}</div>
            <div className="text-xs text-gray-500">{item.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'rol', header: 'Rol', width: '100', align: 'center',
      render: (item) => {
        const colors: Record<string, string> = {
          superadmin: 'bg-red-500/10 text-red-400 border-red-500/20',
          admin: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
          moderador: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
        };
        return (
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${colors[item.rol] || 'bg-gray-500/10 text-gray-400'}`}>
            <i className={`fas ${item.rol === 'superadmin' ? 'fa-crown' : item.rol === 'admin' ? 'fa-shield-alt' : 'fa-user-shield'}`}></i>
            {item.rol === 'superadmin' ? 'Superadmin' : item.rol === 'admin' ? 'Admin' : 'Moderador'}
          </span>
        );
      },
    },
    {
      key: 'activo', header: 'Estado', width: '80', align: 'center',
      render: (item) => (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${item.activo ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${item.activo ? 'bg-emerald-400' : 'bg-gray-400'}`}></span>
          {item.activo ? 'Activo' : 'Inactivo'}
        </span>
      ),
    },
    {
      key: 'ultimo_login', header: 'Último acceso', width: '120',
      render: (item) => (
        <span className="text-sm text-gray-400">{item.ultimo_login ? new Date(item.ultimo_login).toLocaleDateString('es-CL') : '—'}</span>
      ),
    },
  ];

  const getActions = (item: AdminUser): ActionItem[] => {
    const actions: ActionItem[] = [];
    if (isSuperadmin || currentUser?.id === item.id) {
      actions.push({ label: 'Editar', icon: 'fa-edit', onClick: () => openEdit(item) });
    }
    if (item.id !== currentUser?.id) {
      actions.push({
        label: item.activo ? 'Desactivar' : 'Activar',
        icon: item.activo ? 'fa-pause' : 'fa-play',
        onClick: () => toggleActivo(item),
      });
    }
    if (isSuperadmin && item.id !== currentUser?.id) {
      actions.push({ label: 'Eliminar', icon: 'fa-trash-alt', danger: true, onClick: () => confirmDelete(item) });
    }
    return actions;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <i className="fas fa-user-shield text-red-400"></i> Administradores
          </h1>
          <p className="text-gray-400 mt-1">Gestiona los usuarios del panel de administración</p>
        </div>
        {isSuperadmin && (
          <button onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white text-sm font-semibold rounded-lg transition-all shadow-lg shadow-red-500/20">
            <i className="fas fa-plus"></i> Nuevo Admin
          </button>
        )}
      </div>

      {successMsg && <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-lg flex items-center gap-2"><i className="fas fa-check-circle"></i>{successMsg}</div>}
      {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2"><i className="fas fa-exclamation-triangle"></i>{error} <button onClick={() => setError('')} className="ml-auto"><i className="fas fa-times"></i></button></div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon="fa-users" value={stats.total} label="Total" color="#6b7280" loading={isLoading} />
        <StatCard icon="fa-crown" value={stats.superadmins} label="Superadmins" color="#f59e0b" loading={isLoading} />
        <StatCard icon="fa-shield-halved" value={stats.admins} label="Admins" color="#3b82f6" loading={isLoading} />
        <StatCard icon="fa-user-gear" value={stats.moderadores} label="Moderadores" color="#10b981" loading={isLoading} />
      </div>

      <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre o email..." className="w-full bg-[#252538] border border-[#2a2a3e] rounded-lg px-4 py-2 text-white text-sm outline-none focus:border-red-500/50 transition-colors placeholder-gray-600" />

      <DataTable
        columns={columns}
        data={items}
        loading={isLoading}
        skeletonRows={5}
        emptyMessage="No hay administradores"
        emptyIcon="fa-user-shield"
        getRowKey={(item) => item.id}
        getActions={getActions}
      />

      {/* Modal Crear/Editar */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#1a1a2e] border border-admin-border rounded-2xl w-full max-w-md shadow-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">
              {modalMode === 'crear' ? 'Nuevo Administrador' : 'Editar Administrador'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Nombre</label>
                <input type="text" value={formData.nombre} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  className={`w-full bg-[#252538] border ${fieldErrors.nombre ? 'border-red-500' : 'border-[#2a2a3e]'} rounded-lg px-4 py-2 text-white text-sm outline-none focus:border-red-500/50`} />
                {fieldErrors.nombre && <p className="text-red-400 text-xs mt-1">{fieldErrors.nombre}</p>}
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Email</label>
                <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={`w-full bg-[#252538] border ${fieldErrors.email ? 'border-red-500' : 'border-[#2a2a3e]'} rounded-lg px-4 py-2 text-white text-sm outline-none focus:border-red-500/50`} />
                {fieldErrors.email && <p className="text-red-400 text-xs mt-1">{fieldErrors.email}</p>}
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Contraseña {modalMode === 'editar' && <span className="text-gray-600">(dejar vacío para mantener)</span>}
                </label>
                <input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className={`w-full bg-[#252538] border ${fieldErrors.password ? 'border-red-500' : 'border-[#2a2a3e]'} rounded-lg px-4 py-2 text-white text-sm outline-none focus:border-red-500/50`} />
                {fieldErrors.password && <p className="text-red-400 text-xs mt-1">{fieldErrors.password}</p>}
              </div>
              {isSuperadmin && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Rol</label>
                  <select value={formData.rol} onChange={(e) => setFormData({ ...formData, rol: e.target.value })}
                    className="w-full bg-[#252538] border border-[#2a2a3e] rounded-lg px-4 py-2 text-white text-sm outline-none focus:border-red-500/50">
                    <option value="superadmin">Superadmin</option>
                    <option value="admin">Admin</option>
                    <option value="moderador">Moderador</option>
                  </select>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2.5 bg-[#2d2d44] hover:bg-[#3d3d5c] text-white font-medium rounded-lg transition-colors text-sm">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold rounded-lg transition-all shadow-lg shadow-red-500/20 text-sm disabled:opacity-50">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmar Eliminación */}
      <ConfirmModal
        isOpen={showDeleteModal}
        title="Eliminar Administrador"
        message={`¿Estás seguro de eliminar a "${deletingItem?.nombre}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => { setShowDeleteModal(false); setDeletingItem(null); }}
      />
    </div>
  );
}
