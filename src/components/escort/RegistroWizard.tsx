import { useState } from 'react';
import { API_BASE } from '../../lib/escortAuth';

export default function RegistroWizard() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!email.trim()) errs.email = 'Email requerido';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Email inválido';
    if (!password) errs.password = 'Contraseña requerida';
    else if (password.length < 8) errs.password = 'Mínimo 8 caracteres';
    if (password !== confirmPassword) errs.confirmPassword = 'Las contraseñas no coinciden';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/registro.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, password_confirm: confirmPassword }),
      });
      const data = await res.json();

      if (data.success) {
        localStorage.setItem('escort_token', data.token);
        localStorage.setItem('escort_data', JSON.stringify(data.escort || {}));
        window.location.href = '/micuenta/onboarding'; '/micuenta/resumen';
      } else if (data.fieldErrors) {
        setErrors(data.fieldErrors);
        if (data.fieldErrors.general) setErrorMsg(data.fieldErrors.general);
      } else {
        setErrorMsg(data.error || data.message || 'Error al registrarse');
      }
    } catch {
      setErrorMsg('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-[#13131a] border border-gray-800 rounded-2xl p-8">
      {(errors.general || errorMsg) && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm mb-6 flex items-center gap-2">
          <i className="fas fa-exclamation-circle"></i>
          {errorMsg || errors.general}
        </div>
      )}

      <div className="space-y-5">
        {/* Email */}
        <div>
          <label className="block text-gray-400 text-xs uppercase tracking-wider mb-2">
            <i className="fas fa-envelope mr-2"></i>Email
          </label>
          <div className="relative">
            <i className="fas fa-envelope absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"></i>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`w-full bg-[#1a1a24] border ${errors.email ? 'border-red-500' : 'border-gray-700'} rounded-xl py-3 pl-11 pr-4 text-white placeholder-gray-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/30 transition-all`}
              placeholder="tu@email.com"
            />
          </div>
          {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
        </div>

        {/* Password */}
        <div>
          <label className="block text-gray-400 text-xs uppercase tracking-wider mb-2">
            <i className="fas fa-lock mr-2"></i>Contraseña
          </label>
          <div className="relative">
            <i className="fas fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"></i>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full bg-[#1a1a24] border ${errors.password ? 'border-red-500' : 'border-gray-700'} rounded-xl py-3 pl-11 pr-12 text-white placeholder-gray-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/30 transition-all`}
              placeholder="Mínimo 8 caracteres"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors cursor-pointer"
              tabIndex={-1}
            >
              <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
            </button>
          </div>
          {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password}</p>}
        </div>

        {/* Confirm Password */}
        <div>
          <label className="block text-gray-400 text-xs uppercase tracking-wider mb-2">
            <i className="fas fa-lock mr-2"></i>Confirmar Contraseña
          </label>
          <div className="relative">
            <i className="fas fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"></i>
            <input
              type={showConfirm ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={`w-full bg-[#1a1a24] border ${errors.confirmPassword ? 'border-red-500' : 'border-gray-700'} rounded-xl py-3 pl-11 pr-12 text-white placeholder-gray-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/30 transition-all`}
              placeholder="Repite tu contraseña"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors cursor-pointer"
              tabIndex={-1}
            >
              <i className={`fas ${showConfirm ? 'fa-eye-slash' : 'fa-eye'}`}></i>
            </button>
          </div>
          {errors.confirmPassword && <p className="text-red-400 text-xs mt-1">{errors.confirmPassword}</p>}
        </div>

        <div className="pt-4">
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white font-semibold py-3.5 rounded-xl transition-all duration-300 shadow-lg shadow-red-500/20 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <>
                <i className="fas fa-circle-notch fa-spin"></i>
                Creando cuenta...
              </>
            ) : (
              <>
                <i className="fas fa-user-plus"></i>
                Crear Cuenta
              </>
            )}
          </button>
        </div>
      </div>

      <p className="text-center text-gray-600 text-xs mt-6">
        Al registrarte aceptas nuestros <a href="#" className="text-red-400 hover:underline">Términos</a> y <a href="#" className="text-red-400 hover:underline">Privacidad</a>
      </p>
    </form>
  );
}
