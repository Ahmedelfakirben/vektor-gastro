import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Coffee, Eye, EyeOff } from 'lucide-react';

export function LoginForm() {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { signIn } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Basic input validation
    if (!email.trim()) {
      setError(t('El correo electrónico es obligatorio.'));
      setLoading(false);
      return;
    }

    if (!password.trim()) {
      setError(t('La contraseña es obligatoria.'));
      setLoading(false);
      return;
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError(t('Por favor ingresa un correo electrónico válido.'));
      setLoading(false);
      return;
    }

    // Password strength check (minimum 6 characters)
    if (password.length < 6) {
      setError(t('La contraseña debe tener al menos 6 caracteres.'));
      setLoading(false);
      return;
    }

    try {
      await signIn(email, password);
    } catch (err: any) {
      let message = t('Credenciales inválidas. Por favor intenta de nuevo.');

      // Handle specific Supabase errors
      if (err?.message?.includes('Invalid login credentials')) {
        message = t('Correo electrónico o contraseña incorrectos.');
      } else if (err?.message?.includes('Email not confirmed')) {
        message = t('Por favor confirma tu correo electrónico antes de iniciar sesión.');
      } else if (err?.message?.includes('Too many requests')) {
        message = t('Demasiados intentos. Por favor espera unos minutos.');
      } else if (err?.message) {
        message = err.message;
      }

      setError(message);
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-100 via-orange-50 to-amber-200 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated Background Circles */}
      <div className="absolute top-20 left-20 w-72 h-72 bg-amber-300/20 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-orange-300/20 rounded-full blur-3xl animate-pulse delay-1000"></div>

      <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-md p-10 border border-white/20 relative z-10 animate-fadeIn">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-28 h-28 rounded-2xl mb-5 shadow-2xl transform hover:scale-105 transition-transform duration-300 overflow-hidden border border-amber-500/30 bg-slate-950 p-1">
            <img src="/logo.png" alt="Vektor Gastro" className="w-full h-full object-cover rounded-xl" />
          </div>
          <h1 className="text-3xl font-black bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 bg-clip-text text-transparent mb-1 tracking-tight">
            Vektor Gastro
          </h1>
          <p className="text-gray-600 font-semibold text-sm tracking-wide uppercase">{t('TPV & Gestión Hostelería')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border-2 border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-medium shadow-sm animate-shake">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-bold text-gray-700 mb-2">
              {t('Correo Electrónico')}
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:ring-4 focus:ring-amber-100 transition-all duration-200 outline-none bg-white/50 backdrop-blur-sm hover:bg-white"
              placeholder={t('empleado@cafeteria.com')}
              required
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-bold text-gray-700 mb-2">
              {t('Contraseña')}
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 pr-12 border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:ring-4 focus:ring-amber-100 transition-all duration-200 outline-none bg-white/50 backdrop-blur-sm hover:bg-white"
                placeholder="••••••••"
                required
                autoComplete="current-password"
                minLength={6}
                maxLength={128}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-amber-600 transition-colors p-2 rounded-lg hover:bg-amber-50"
                aria-label={showPassword ? t("Ocultar contraseña") : t("Mostrar contraseña")}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold py-4 px-6 rounded-xl shadow-lg hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none focus:ring-4 focus:ring-amber-200"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-3">
                <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                {t('Iniciando sesión...')}
              </span>
            ) : (
              t('Iniciar Sesión')
            )}
          </button>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-gray-300"></div>
            <span className="flex-shrink mx-3 text-gray-400 text-xs uppercase font-bold tracking-wider">o acceso rápido</span>
            <div className="flex-grow border-t border-gray-300"></div>
          </div>

          <button
            type="button"
            onClick={() => {
              setEmail('mouad@coffe.com');
              setPassword('U8vBdR2zARcm');
              setTimeout(() => {
                const formEl = document.querySelector('form');
                if (formEl) formEl.requestSubmit();
              }, 50);
            }}
            className="w-full bg-slate-950 hover:bg-slate-900 text-amber-400 border border-amber-500/40 font-bold py-3 px-4 rounded-xl shadow-md transition-all duration-200 flex items-center justify-center gap-2 hover:scale-[1.01]"
          >
            <span>🚀 Probar Demo Interactiva (1 Clic)</span>
          </button>
        </form>

      </div>
    </div>
  );
}
