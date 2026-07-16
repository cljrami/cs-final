import { useState } from 'react';
import { API_BASE, setUsuarioToken, setUsuarioData } from '../lib/usuarioAuth';

export default function UsuarioLoginForm() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.email.trim()) { setError('Ingresa tu email'); return; }
    if (!form.password) { setError('Ingresa tu contraseña'); return; }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/login.php`, {
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
        setError(data.error || 'Error al iniciar sesión');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
          <i className="fas fa-exclamation-circle mr-2"></i>
          {error}
        </div>
      )}

      <div>
        <label className="block text-gray-400 text-sm mb-1.5">Email</label>
        <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="tu@email.com"
          className="w-full bg-[#1a1a2e] rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:bg-[#2a2a3e] transition-colors" />
      </div>

      <div>
        <label className="block text-gray-400 text-sm mb-1.5">Contraseña</label>
        <div className="relative">
          <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Tu contraseña"
            className="w-full bg-[#1a1a2e] rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:bg-[#2a2a3e] transition-colors pr-10" />
          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
            <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
          </button>
        </div>
      </div>

      <button type="submit" disabled={loading}
        className="w-full bg-gradient-to-r from-red-500 to-red-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50">
        {loading ? <i className="fas fa-circle-notch fa-spin" /> : <i className="fas fa-sign-in-alt" />}
        {loading ? 'Ingresando...' : 'Ingresar'}
      </button>

      <p className="text-gray-500 text-sm text-center">
        ¿No tienes cuenta?{' '}
        <a href="/unirse" className="text-red-400 hover:text-red-300">Regístrate gratis</a>
      </p>
    </form>
  );
}
