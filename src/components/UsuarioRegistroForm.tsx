import { useState } from 'react';
import { API_BASE, setUsuarioToken, setUsuarioData } from '../lib/usuarioAuth';

export default function UsuarioRegistroForm() {
  const [form, setForm] = useState({ nombre: '', email: '', password: '', password_confirm: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: '' });
    setGeneralError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError('');

    const errs: Record<string, string> = {};
    if (form.nombre.trim().length < 2) errs.nombre = 'Mínimo 2 caracteres';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Email inválido';
    if (form.password.length < 8) errs.password = 'Mínimo 8 caracteres';
    if (form.password !== form.password_confirm) errs.password_confirm = 'No coinciden';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/registro.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        setUsuarioToken(data.token);
        setUsuarioData(data.usuario);
        window.location.href = '/';
      } else {
        setErrors(data.fieldErrors || {});
        setGeneralError(data.error || 'Error al registrarse');
      }
    } catch {
      setGeneralError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {generalError && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
          {generalError}
        </div>
      )}

      <div>
        <label className="block text-gray-400 text-sm mb-1.5">Nombre</label>
        <input name="nombre" value={form.nombre} onChange={handleChange} placeholder="Tu nombre"
          className="w-full bg-[#1a1a2e] rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:bg-[#2a2a3e] transition-colors" />
        {errors.nombre && <p className="text-red-400 text-xs mt-1">{errors.nombre}</p>}
      </div>

      <div>
        <label className="block text-gray-400 text-sm mb-1.5">Email</label>
        <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="tu@email.com"
          className="w-full bg-[#1a1a2e] rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:bg-[#2a2a3e] transition-colors" />
        {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
      </div>

      <div>
        <label className="block text-gray-400 text-sm mb-1.5">Contraseña</label>
        <input name="password" type="password" value={form.password} onChange={handleChange} placeholder="Mínimo 8 caracteres"
          className="w-full bg-[#1a1a2e] rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:bg-[#2a2a3e] transition-colors" />
        {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password}</p>}
      </div>

      <div>
        <label className="block text-gray-400 text-sm mb-1.5">Confirmar contraseña</label>
        <input name="password_confirm" type="password" value={form.password_confirm} onChange={handleChange} placeholder="Repite la contraseña"
          className="w-full bg-[#1a1a2e] rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:bg-[#2a2a3e] transition-colors" />
        {errors.password_confirm && <p className="text-red-400 text-xs mt-1">{errors.password_confirm}</p>}
      </div>

      <button type="submit" disabled={loading}
        className="w-full bg-gradient-to-r from-red-500 to-red-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50">
        {loading ? <i className="fas fa-circle-notch fa-spin" /> : <i className="fas fa-user-plus" />}
        {loading ? 'Creando cuenta...' : 'Crear cuenta'}
      </button>

      <p className="text-gray-500 text-sm text-center">
        ¿Ya tienes cuenta?{' '}
        <a href="/ingresar" className="text-red-400 hover:text-red-300">Inicia sesión</a>
      </p>
    </form>
  );
}
