import { useState, useEffect } from 'react';
import { authFetch, requireAuth } from '../lib/usuarioAuth';

export default function MiPerfil() {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  useEffect(() => {
    requireAuth();
    authFetch('/api/usuarios/perfil.php')
      .then(r => r.json())
      .then(data => {
        if (data.success && data.usuario) {
          setNombre(data.usuario.nombre);
          setEmail(data.usuario.email);
          setTelefono(data.usuario.telefono || '');
          setCiudad(data.usuario.ciudad || '');
        } else {
          setError(data.error || 'Error al cargar perfil');
        }
      })
      .catch(() => setError('Error de conexión'))
      .finally(() => setCargando(false));
  }, []);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    setError('');
    setExito('');

    const body: Record<string, string> = { nombre, email, telefono, ciudad };
    if (password) {
      body.password = password;
      body.password_confirm = passwordConfirm;
    }

    const res = await authFetch('/api/usuarios/perfil.php', {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (data.success) {
      if (data.usuario) {
        localStorage.setItem('usuario_data', JSON.stringify(data.usuario));
      }
      setPassword('');
      setPasswordConfirm('');
      setExito(password ? 'Perfil y contraseña actualizados correctamente' : 'Perfil actualizado correctamente');
    } else if (data.fieldErrors) {
      const msgs = Object.values(data.fieldErrors).join('. ');
      setError(msgs);
    } else {
      setError(data.error || 'Error al guardar');
    }
    setGuardando(false);
  };

  if (cargando) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="animate-spin w-10 h-10 border-4 border-red-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-white flex items-center gap-3 mb-8">
        <i className="fas fa-user-edit text-red-500"></i>
        Mi Perfil
      </h1>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          <i className="fas fa-exclamation-circle mr-2"></i>{error}
        </div>
      )}
      {exito && (
        <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm">
          <i className="fas fa-check-circle mr-2"></i>{exito}
        </div>
      )}

      <form onSubmit={guardar} className="space-y-5">
        <div className="bg-[#1a1a2e] border border-white/10 rounded-xl p-5 space-y-5">
          <h3 className="text-white text-sm font-semibold flex items-center gap-2">
            <i className="fas fa-info-circle text-gray-500"></i> Datos personales
          </h3>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Nombre</label>
            <input type="text" value={nombre} onChange={e => setNombre(e.target.value)}
              className="w-full px-4 py-2.5 bg-[#252538] border border-white/10 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-red-500/50 transition-colors"
              required minLength={2} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 bg-[#252538] border border-white/10 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-red-500/50 transition-colors"
              required />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Teléfono</label>
            <input type="text" value={telefono} onChange={e => setTelefono(e.target.value)}
              className="w-full px-4 py-2.5 bg-[#252538] border border-white/10 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-red-500/50 transition-colors"
              placeholder="+56 9 ..." />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Ciudad</label>
            <input type="text" value={ciudad} onChange={e => setCiudad(e.target.value)}
              className="w-full px-4 py-2.5 bg-[#252538] border border-white/10 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-red-500/50 transition-colors"
              placeholder="Santiago, Viña del Mar..." />
          </div>
        </div>

        <div className="bg-[#1a1a2e] border border-white/10 rounded-xl p-5 space-y-5">
          <h3 className="text-white text-sm font-semibold flex items-center gap-2">
            <i className="fas fa-lock text-gray-500"></i> Cambiar contraseña
            <span className="text-gray-600 text-xs font-normal">(dejar vacío para mantener)</span>
          </h3>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Nueva contraseña</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 bg-[#252538] border border-white/10 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-red-500/50 transition-colors"
              placeholder="Mínimo 8 caracteres" minLength={8} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Confirmar contraseña</label>
            <input type="password" value={passwordConfirm} onChange={e => setPasswordConfirm(e.target.value)}
              className="w-full px-4 py-2.5 bg-[#252538] border border-white/10 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-red-500/50 transition-colors"
              placeholder="Repite la nueva contraseña" />
          </div>
        </div>

        <button type="submit" disabled={guardando}
          className="w-full py-3 rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed">
          {guardando ? (
            <span className="flex items-center justify-center gap-2">
              <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
              Guardando...
            </span>
          ) : 'Guardar cambios'}
        </button>
      </form>
    </div>
  );
}
