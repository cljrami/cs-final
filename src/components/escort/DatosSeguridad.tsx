// src/components/escort/DatosSeguridad.tsx
import { useState, useEffect } from 'react';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

const API_BASE = '/api/escort';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('escort_token') || '';
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

interface EscortData {
  id: number;
  usuario: string;
  email: string;
  telefono: string;
  whatsapp: string;
  nombre: string;
  slug: string;
  edad: number;
  ciudad: string;
  nacionalidad: string;
  estado: string;
  activa: number;
  verificado: number;
  vip: number;
  created_at: string;
  updated_at: string;
  rating: string;
  visitas_perfil: number;
  total_valoraciones: number;
}

export default function DatosSeguridad() {
  const [escort, setEscort] = useState<EscortData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPass, setSavingPass] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleEliminarCuenta = async () => {
    if (deleting) return;
    if (!confirm('¿Estas segura de eliminar tu cuenta? Esta accion es irreversible.')) return;

    const password = prompt('Confirma tu contrasena para eliminar la cuenta:') || '';
    if (!password) return;

    setDeleting(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/datos/eliminar-cuenta.php`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (data.success) {
        localStorage.removeItem('escort_token');
        localStorage.removeItem('escort_data');
        window.location.href = '/micuenta/login';
      } else {
        setError(data.error || 'No se pudo eliminar la cuenta');
      }
    } catch {
      setError('Error de conexion al eliminar la cuenta');
    } finally {
      setDeleting(false);
    }
  };

  // Form datos personales
  const [formDatos, setFormDatos] = useState({
    email: '',
    telefono: '',
    whatsapp: ''
  });

  // Form contraseña
  const [formPass, setFormPass] = useState({
    actual: '',
    nueva: '',
    confirmar: ''
  });

  const [showPass, setShowPass] = useState({
    actual: false,
    nueva: false,
    confirmar: false
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchEscort();
  }, []);

  const fetchEscort = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/perfil.php`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      setEscort(data.escort);
      setFormDatos({
        email: data.escort.email || '',
        telefono: data.escort.telefono || '',
        whatsapp: data.escort.whatsapp || ''
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleSaveDatos = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setSaving(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE}/datos/actualizar.php`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(formDatos)
      });
      const data = await res.json();

      if (!data.success) {
        if (data.fieldErrors) {
          setFieldErrors(data.fieldErrors);
          setSaving(false);
          return;
        }
        throw new Error(data.error || 'Error al guardar');
      }

      showNotification('Datos actualizados correctamente');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePass = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setSavingPass(true);
    setError('');

    const errors: Record<string, string> = {};
    if (!formPass.actual) errors.passActual = 'Ingresa tu contraseña actual';
    if (formPass.nueva.length < 8) errors.passNueva = 'Mínimo 8 caracteres';
    if (formPass.nueva !== formPass.confirmar) errors.passConfirmar = 'Las contraseñas no coinciden';

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setSavingPass(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/datos/cambiar-password.php`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          actual: formPass.actual,
          nueva: formPass.nueva
        })
      });
      const data = await res.json();

      if (!data.success) {
        if (data.fieldErrors) {
          setFieldErrors(data.fieldErrors);
          setSavingPass(false);
          return;
        }
        throw new Error(data.error || 'Error al cambiar contraseña');
      }

      setFormPass({ actual: '', nueva: '', confirmar: '' });
      showNotification('Contraseña cambiada correctamente');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingPass(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton width={180} height={32} className="mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-[#13131a] border border-gray-800 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <Skeleton width={40} height={40} circle />
              <div>
                <Skeleton width={160} height={20} className="mb-1" />
                <Skeleton width={200} height={14} />
              </div>
            </div>
            <div className="space-y-5">
              <Skeleton width="100%" height={48} />
              <Skeleton width="100%" height={48} />
              <Skeleton width="100%" height={48} />
              <Skeleton width="100%" height={44} />
            </div>
          </div>
          <div className="bg-[#13131a] border border-gray-800 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <Skeleton width={40} height={40} circle />
              <div>
                <Skeleton width={120} height={20} className="mb-1" />
                <Skeleton width={160} height={14} />
              </div>
            </div>
            <div className="space-y-5">
              <Skeleton width="100%" height={48} />
              <Skeleton width="100%" height={48} />
              <Skeleton width="100%" height={48} />
              <Skeleton width="100%" height={44} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const InputField = ({
    label,
    value,
    onChange,
    type = 'text',
    placeholder,
    icon,
    error
  }: {
    label: string;
    value: string;
    onChange: (val: string) => void;
    type?: string;
    placeholder?: string;
    icon: string;
    error?: string;
  }) => (
    <div>
      <label className="block text-gray-400 text-xs uppercase tracking-wider mb-2">{label}</label>
      <div className="relative">
        <i className={`fas ${icon} absolute left-4 top-1/2 -translate-y-1/2 text-gray-500`}></i>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full bg-[#1a1a24] border ${error ? 'border-red-500' : 'border-gray-700'} rounded-xl py-3 pl-11 pr-4 text-white placeholder-gray-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/30 transition-all`}
        />
      </div>
      {error && <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1"><i className="fas fa-exclamation-circle"></i>{error}</p>}
    </div>
  );

  const PassField = ({
    label,
    value,
    onChange,
    show,
    onToggle,
    placeholder,
    error
  }: {
    label: string;
    value: string;
    onChange: (val: string) => void;
    show: boolean;
    onToggle: () => void;
    placeholder: string;
    error?: string;
  }) => (
    <div>
      <label className="block text-gray-400 text-xs uppercase tracking-wider mb-2">{label}</label>
      <div className="relative">
        <i className="fas fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"></i>
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full bg-[#1a1a24] border ${error ? 'border-red-500' : 'border-gray-700'} rounded-xl py-3 pl-11 pr-12 text-white placeholder-gray-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/30 transition-all`}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
        >
          <i className={`fas ${show ? 'fa-eye-slash' : 'fa-eye'}`}></i>
        </button>
      </div>
      {error && <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1"><i className="fas fa-exclamation-circle"></i>{error}</p>}
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <i className="fas fa-id-card text-red-500"></i>
          Mis Datos
        </h1>
        <p className="text-gray-500 mt-1">Gestiona tu informacion de contacto y seguridad</p>
      </div>

      {/* Alerts */}
      {successMsg && (
        <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-xl flex items-center gap-2 animate-pulse">
          <i className="fas fa-check-circle"></i>
          {successMsg}
        </div>
      )}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl flex items-center gap-2">
          <i className="fas fa-exclamation-triangle"></i>
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card: Datos de contacto */}
        <div className="bg-[#13131a] border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
              <i className="fas fa-address-card text-blue-400"></i>
            </div>
            <div>
              <h2 className="text-white font-bold">Datos de Contacto</h2>
              <p className="text-gray-500 text-xs">Informacion visible para clientes</p>
            </div>
          </div>

          <form onSubmit={handleSaveDatos} className="space-y-5">
            <InputField
              label="Email"
              value={formDatos.email}
              onChange={(v) => setFormDatos({ ...formDatos, email: v })}
              type="email"
              placeholder="tu@email.com"
              icon="fa-envelope"
              error={fieldErrors.email}
            />

            <InputField
              label="Telefono / WhatsApp"
              value={formDatos.telefono}
              onChange={(v) => setFormDatos({ ...formDatos, telefono: v })}
              placeholder="+56 9 1234 5678"
              icon="fa-phone"
              error={fieldErrors.telefono}
            />

            <InputField
              label="WhatsApp (si es diferente)"
              value={formDatos.whatsapp}
              onChange={(v) => setFormDatos({ ...formDatos, whatsapp: v })}
              placeholder="+56 9 1234 5678"
              icon="fa-brands fa-whatsapp"
              error={fieldErrors.whatsapp}
            />

            <div className="pt-2">
              <button
                type="submit"
                disabled={saving}
                className="w-full bg-blue-500 hover:bg-blue-400 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving && <i className="fas fa-circle-notch fa-spin"></i>}
                {saving ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </form>
        </div>

        {/* Card: Seguridad */}
        <div className="bg-[#13131a] border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center">
              <i className="fas fa-shield-alt text-red-400"></i>
            </div>
            <div>
              <h2 className="text-white font-bold">Seguridad</h2>
              <p className="text-gray-500 text-xs">Cambia tu contrasena</p>
            </div>
          </div>

          <form onSubmit={handleChangePass} className="space-y-5">
            <PassField
              label="Contrasena Actual"
              value={formPass.actual}
              onChange={(v) => setFormPass({ ...formPass, actual: v })}
              show={showPass.actual}
              onToggle={() => setShowPass({ ...showPass, actual: !showPass.actual })}
              placeholder="********"
              error={fieldErrors.passActual}
            />

            <PassField
              label="Nueva Contrasena"
              value={formPass.nueva}
              onChange={(v) => setFormPass({ ...formPass, nueva: v })}
              show={showPass.nueva}
              onToggle={() => setShowPass({ ...showPass, nueva: !showPass.nueva })}
              placeholder="Minimo 8 caracteres"
              error={fieldErrors.passNueva}
            />

            <PassField
              label="Confirmar Nueva Contrasena"
              value={formPass.confirmar}
              onChange={(v) => setFormPass({ ...formPass, confirmar: v })}
              show={showPass.confirmar}
              onToggle={() => setShowPass({ ...showPass, confirmar: !showPass.confirmar })}
              placeholder="Repite la nueva contrasena"
              error={fieldErrors.passConfirmar}
            />

            <div className="pt-2">
              <button
                type="submit"
                disabled={savingPass}
                className="w-full bg-red-500 hover:bg-red-400 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-red-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {savingPass && <i className="fas fa-circle-notch fa-spin"></i>}
                {savingPass ? 'Cambiando...' : 'Cambiar Contrasena'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Card: Info de cuenta */}
      <div className="bg-[#13131a] border border-gray-800 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gray-700/50 rounded-xl flex items-center justify-center">
            <i className="fas fa-info-circle text-gray-400"></i>
          </div>
          <div>
            <h2 className="text-white font-bold">Informacion de Cuenta</h2>
            <p className="text-gray-500 text-xs">Datos que no puedes modificar</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <div className="bg-[#1a1a24] rounded-xl p-4">
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Usuario</p>
            <p className="text-white font-mono text-sm">@{escort?.usuario}</p>
          </div>
          <div className="bg-[#1a1a24] rounded-xl p-4">
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">ID</p>
            <p className="text-white font-mono text-sm">#{escort?.id}</p>
          </div>
          <div className="bg-[#1a1a24] rounded-xl p-4">
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Nombre</p>
            <p className="text-white font-medium text-sm">{escort?.nombre || '-'}</p>
          </div>
          <div className="bg-[#1a1a24] rounded-xl p-4">
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Ciudad</p>
            <p className="text-white text-sm">{escort?.ciudad || '-'}</p>
          </div>
          <div className="bg-[#1a1a24] rounded-xl p-4">
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Edad</p>
            <p className="text-white text-sm">{escort?.edad || '-'}</p>
          </div>
          <div className="bg-[#1a1a24] rounded-xl p-4">
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Rating</p>
            <p className="text-white text-sm">{escort?.rating ? `${escort.rating} / 5.0` : '-'}</p>
          </div>
          <div className="bg-[#1a1a24] rounded-xl p-4">
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Verificada</p>
            <p className={`text-sm font-medium ${escort?.verificado ? 'text-green-400' : 'text-gray-400'}`}>
              {escort?.verificado ? 'Si' : 'No'}
            </p>
          </div>
          <div className="bg-[#1a1a24] rounded-xl p-4">
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">VIP</p>
            <p className={`text-sm font-medium ${escort?.vip ? 'text-yellow-400' : 'text-gray-400'}`}>
              {escort?.vip ? 'Si' : 'No'}
            </p>
          </div>
          <div className="bg-[#1a1a24] rounded-xl p-4">
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Registro</p>
            <p className="text-white text-sm">{escort?.created_at ? new Date(escort.created_at).toLocaleDateString('es-CL') : '-'}</p>
          </div>
          <div className="bg-[#1a1a24] rounded-xl p-4">
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Slug</p>
            <p className="text-white font-mono text-xs truncate">{escort?.slug || '-'}</p>
          </div>
        </div>
      </div>

      {/* Danger zone */}
      <div className="bg-[#13131a] border border-red-900/30 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center">
            <i className="fas fa-exclamation-triangle text-red-400"></i>
          </div>
          <div>
            <h2 className="text-white font-bold">Zona de Peligro</h2>
            <p className="text-gray-500 text-xs">Acciones irreversibles</p>
          </div>
        </div>

        <div className="flex items-center justify-between bg-[#1a1a24] rounded-xl p-4">
          <div>
            <p className="text-white font-medium">Eliminar mi cuenta</p>
            <p className="text-gray-500 text-xs mt-0.5">Esta accion no se puede deshacer. Se eliminaran todos tus datos.</p>
          </div>
          <button
            onClick={handleEliminarCuenta}
            disabled={deleting}
            className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg transition-colors text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {deleting ? 'Eliminando...' : 'Eliminar Cuenta'}
          </button>
        </div>
      </div>
    </div>
  );
}