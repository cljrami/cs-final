import { useState, useEffect } from 'react';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('admin_token') || '';
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
}

interface AdminData {
  id: number;
  nombre: string;
  email: string;
  rol: string;
  activo: boolean;
  ultimo_login: string | null;
  created_at: string;
}

export default function MiPerfilData() {
  const [perfil, setPerfil] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);

  // Form datos
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [savingPerfil, setSavingPerfil] = useState(false);
  const [perfilSuccess, setPerfilSuccess] = useState('');
  const [perfilError, setPerfilError] = useState('');
  const [perfilFieldErrors, setPerfilFieldErrors] = useState<Record<string, string>>({});

  // Form password
  const [passActual, setPassActual] = useState('');
  const [passNueva, setPassNueva] = useState('');
  const [passNueva2, setPassNueva2] = useState('');
  const [savingPass, setSavingPass] = useState(false);
  const [passSuccess, setPassSuccess] = useState('');
  const [passError, setPassError] = useState('');
  const [passFieldErrors, setPassFieldErrors] = useState<Record<string, string>>({});

  // Cargar datos del perfil
  useEffect(() => {
    fetch('/api/admin/datos/perfil.php', { headers: getAuthHeaders() })
      .then(r => r.json())
      .then(data => {
        if (data.success && data.data) {
          setPerfil(data.data);
          setNombre(data.data.nombre);
          setEmail(data.data.email);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSavePerfil = async () => {
    setSavingPerfil(true);
    setPerfilError('');
    setPerfilSuccess('');
    setPerfilFieldErrors({});
    try {
      const res = await fetch('/api/admin/datos/perfil.php', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ nombre, email }),
      });
      const data = await res.json();
      if (!data.success) {
        if (data.fieldErrors) { setPerfilFieldErrors(data.fieldErrors); return; }
        throw new Error(data.error || 'Error');
      }
      // Actualizar localStorage
      const stored = JSON.parse(localStorage.getItem('admin_user') || '{}');
      stored.nombre = nombre;
      stored.email = email;
      localStorage.setItem('admin_user', JSON.stringify(stored));
      setPerfilSuccess('Datos actualizados correctamente');
      setTimeout(() => setPerfilSuccess(''), 3000);
    } catch (err: any) {
      setPerfilError(err.message);
    } finally {
      setSavingPerfil(false);
    }
  };

  const handleSavePassword = async () => {
    setSavingPass(true);
    setPassError('');
    setPassSuccess('');
    setPassFieldErrors({});

    if (passNueva !== passNueva2) {
      setPassFieldErrors({ passNueva2: 'Las contraseñas no coinciden' });
      setSavingPass(false);
      return;
    }

    try {
      const res = await fetch('/api/admin/datos/cambiar-password.php', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ actual: passActual, nueva: passNueva }),
      });
      const data = await res.json();
      if (!data.success) {
        if (data.fieldErrors) { setPassFieldErrors(data.fieldErrors); return; }
        throw new Error(data.error || 'Error');
      }
      setPassSuccess('Contraseña cambiada correctamente');
      setPassActual('');
      setPassNueva('');
      setPassNueva2('');
      setTimeout(() => setPassSuccess(''), 3000);
    } catch (err: any) {
      setPassError(err.message);
    } finally {
      setSavingPass(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <i className="fas fa-user-circle text-red-400"></i> Mi Perfil
        </h1>
        <p className="text-gray-400 mt-1">Gestiona tu información personal y contraseña</p>
      </div>

      {/* Información de la cuenta */}
      {perfil && (
        <div className="bg-[#1a1a2e] border border-admin-border rounded-xl p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
              {perfil.nombre?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div>
              <div className="text-lg font-bold text-white">{perfil.nombre}</div>
              <div className="text-gray-400 text-sm">{perfil.email}</div>
              <div className="mt-1">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                  perfil.rol === 'superadmin' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                  perfil.rol === 'admin' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                  'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                }`}>
                  <i className={`fas ${perfil.rol === 'superadmin' ? 'fa-crown' : perfil.rol === 'admin' ? 'fa-shield-alt' : 'fa-user-shield'}`}></i>
                  {perfil.rol === 'superadmin' ? 'Superadmin' : perfil.rol === 'admin' ? 'Admin' : 'Moderador'}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Último acceso:</span>
              <span className="text-gray-300 ml-2">{perfil.ultimo_login ? new Date(perfil.ultimo_login).toLocaleString('es-CL') : '—'}</span>
            </div>
            <div>
              <span className="text-gray-500">Miembro desde:</span>
              <span className="text-gray-300 ml-2">{new Date(perfil.created_at).toLocaleDateString('es-CL')}</span>
            </div>
          </div>
        </div>
      )}

      {/* Formulario Datos Personales */}
      <div className="bg-[#1a1a2e] border border-admin-border rounded-xl p-6">
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <i className="fas fa-id-card text-red-400"></i> Datos Personales
        </h2>

        {perfilSuccess && (
          <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-lg flex items-center gap-2 mb-4">
            <i className="fas fa-check-circle"></i> {perfilSuccess}
          </div>
        )}
        {perfilError && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2 mb-4">
            <i className="fas fa-exclamation-triangle"></i> {perfilError}
            <button onClick={() => setPerfilError('')} className="ml-auto"><i className="fas fa-times"></i></button>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Nombre</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className={`w-full bg-[#252538] border ${perfilFieldErrors.nombre ? 'border-red-500' : 'border-[#2a2a3e]'} rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:border-red-500/50 transition-colors`}
            />
            {perfilFieldErrors.nombre && <p className="text-red-400 text-xs mt-1">{perfilFieldErrors.nombre}</p>}
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`w-full bg-[#252538] border ${perfilFieldErrors.email ? 'border-red-500' : 'border-[#2a2a3e]'} rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:border-red-500/50 transition-colors`}
            />
            {perfilFieldErrors.email && <p className="text-red-400 text-xs mt-1">{perfilFieldErrors.email}</p>}
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleSavePerfil}
              disabled={savingPerfil}
              className="px-6 py-2.5 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold rounded-lg transition-all shadow-lg shadow-red-500/20 text-sm disabled:opacity-50"
            >
              {savingPerfil ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </div>
      </div>

      {/* Formulario Cambiar Contraseña */}
      <div className="bg-[#1a1a2e] border border-admin-border rounded-xl p-6">
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <i className="fas fa-lock text-red-400"></i> Cambiar Contraseña
        </h2>

        {passSuccess && (
          <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-lg flex items-center gap-2 mb-4">
            <i className="fas fa-check-circle"></i> {passSuccess}
          </div>
        )}
        {passError && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2 mb-4">
            <i className="fas fa-exclamation-triangle"></i> {passError}
            <button onClick={() => setPassError('')} className="ml-auto"><i className="fas fa-times"></i></button>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Contraseña Actual</label>
            <input
              type="password"
              value={passActual}
              onChange={(e) => setPassActual(e.target.value)}
              className={`w-full bg-[#252538] border ${passFieldErrors.passActual ? 'border-red-500' : 'border-[#2a2a3e]'} rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:border-red-500/50 transition-colors`}
              placeholder="Tu contraseña actual"
            />
            {passFieldErrors.passActual && <p className="text-red-400 text-xs mt-1">{passFieldErrors.passActual}</p>}
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Nueva Contraseña</label>
            <input
              type="password"
              value={passNueva}
              onChange={(e) => setPassNueva(e.target.value)}
              className={`w-full bg-[#252538] border ${passFieldErrors.passNueva ? 'border-red-500' : 'border-[#2a2a3e]'} rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:border-red-500/50 transition-colors`}
              placeholder="Mínimo 8 caracteres"
            />
            {passFieldErrors.passNueva && <p className="text-red-400 text-xs mt-1">{passFieldErrors.passNueva}</p>}
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Confirmar Nueva Contraseña</label>
            <input
              type="password"
              value={passNueva2}
              onChange={(e) => setPassNueva2(e.target.value)}
              className={`w-full bg-[#252538] border ${passFieldErrors.passNueva2 ? 'border-red-500' : 'border-[#2a2a3e]'} rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:border-red-500/50 transition-colors`}
              placeholder="Repite la nueva contraseña"
            />
            {passFieldErrors.passNueva2 && <p className="text-red-400 text-xs mt-1">{passFieldErrors.passNueva2}</p>}
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleSavePassword}
              disabled={savingPass}
              className="px-6 py-2.5 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold rounded-lg transition-all shadow-lg shadow-red-500/20 text-sm disabled:opacity-50"
            >
              {savingPass ? 'Cambiando...' : 'Cambiar Contraseña'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
