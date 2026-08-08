// src/components/escort/LoginForm.tsx
import { useState } from 'react';
import { API_BASE } from '../../lib/escortAuth';

export default function LoginForm() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.email.trim()) errs.email = 'Ingresa tu email';
    if (!form.password) errs.password = 'Ingresa tu contraseña';
    if (form.password && form.password.length < 6) errs.password = 'Mínimo 6 caracteres';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/login.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario: form.email, password: form.password }),
      });
      const data = await res.json();
      
      if (data.success) {
        localStorage.setItem('escort_token', data.token);
        localStorage.setItem('escort_data', JSON.stringify(data.escort));

        // El panel guía la selección de plan mientras la cuenta no esté aprobada
        window.location.replace('/micuenta/resumen');
      } else if (data.eliminada) {
        window.location.replace('/micuenta/cuenta-eliminada?email=' + encodeURIComponent(form.email));
      } else {
        setErrors({ general: data.error || 'Credenciales incorrectas' });
      }
    } catch {
      setErrors({ general: 'Error de conexión' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {errors.general && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
          <i className="fas fa-exclamation-circle"></i>
          {errors.general}
        </div>
      )}

      <div>
        <label className="block text-sm text-gray-400 mb-2">
          <i className="fas fa-envelope mr-2"></i>Email
        </label>
        <div className="flex items-center bg-[#0f0f1a] rounded-xl px-4 focus-within:bg-[#2a2a3e] transition-colors">
          <i className="fas fa-envelope text-gray-500"></i>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="flex-1 bg-transparent border-none text-white px-4 py-3 outline-none"
            placeholder="tu@email.com"
          />
        </div>
        {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-2">
          <i className="fas fa-lock mr-2"></i>Contraseña
        </label>
        <div className="flex items-center bg-[#0f0f1a] rounded-xl px-4 focus-within:bg-[#2a2a3e] transition-colors">
          <i className="fas fa-lock text-gray-500"></i>
          <input
            type={showPassword ? 'text' : 'password'}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="flex-1 bg-transparent border-none text-white px-4 py-3 outline-none"
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="text-gray-500 hover:text-gray-300 transition-colors"
          >
            <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
          </button>
        </div>
        {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password}</p>}
      </div>

      <div className="flex items-center justify-between text-sm">
        <label className="flex items-center gap-2 text-gray-400 cursor-pointer hover:text-white transition-colors">
          <input type="checkbox" className="w-4 h-4 rounded bg-[#0f0f1a] text-red-500 focus:ring-red-500/30" />
          Recordarme
        </label>
        <a href="/micuenta/recuperar" className="text-red-400 hover:text-red-300 transition-colors">¿Olvidaste tu contraseña?</a>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-gradient-to-r from-red-500 to-red-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <i className="fas fa-circle-notch fa-spin"></i>
            Entrando...
          </>
        ) : (
          <>
            <i className="fas fa-sign-in-alt"></i>
            Iniciar Sesión
          </>
        )}
      </button>
    </form>
  );
}