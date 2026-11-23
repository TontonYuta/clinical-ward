import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, LoaderCircle } from 'lucide-react';
import { loginWithCredentials, type AuthSession } from '../../services/authApi';

interface LoginPageProps {
  authRequired?: boolean;
  onSuccess: (session: AuthSession) => void;
}

export function LoginPage({ onSuccess }: LoginPageProps) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setError('');
    setSubmitting(true);
    try {
      const session = await loginWithCredentials(username, password);
      sessionStorage.setItem('clinical_active_role', session.role || 'director');
      sessionStorage.setItem('clinical_active_username', session.username || username);
      onSuccess(session);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Tên đăng nhập hoặc mật khẩu không chính xác.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main
      className="relative isolate min-h-screen overflow-hidden bg-[#edf5fc] bg-cover bg-[center_left] px-5 py-8 flex items-center justify-center sm:px-8 lg:justify-end lg:bg-center lg:px-[7vw] xl:px-[10vw]"
      style={{ backgroundImage: "url('/images/login-locai-background.webp')" }}
    >
      {/* Vùng đăng nhập sát bên phải, thiết kế phẳng, gọn gàng, thuần túy */}
      <section className="relative z-10 w-full max-w-[320px] text-left">
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Đăng nhập
          </h1>
        </header>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Tên đăng nhập
            </label>
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              required
              maxLength={100}
              className="w-full h-11 rounded-xl bg-white/95 border border-slate-300 px-3 text-sm text-slate-900 outline-none transition focus:border-blue-700 focus:ring-4 focus:ring-blue-700/10 shadow-sm"
              placeholder="Tên đăng nhập"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Mật khẩu
            </label>
            <div className="relative">
              <input
                value={password}
                onChange={e => setPassword(e.target.value)}
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                maxLength={256}
                className="w-full h-11 rounded-xl bg-white/95 border border-slate-300 px-3 pr-10 text-sm text-slate-900 outline-none transition focus:border-blue-700 focus:ring-4 focus:ring-blue-700/10 shadow-sm"
                placeholder="Mật khẩu"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p role="alert" className="text-xs text-rose-700 font-medium bg-rose-50 border border-rose-200 p-2 rounded-lg">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-11 mt-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-semibold text-sm transition shadow-sm hover:shadow flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
          >
            {submitting && <LoaderCircle className="h-4 w-4 animate-spin" />}
            {submitting ? 'Đang xác thực…' : 'Đăng nhập'}
          </button>

          <p className="text-2xs text-slate-500 text-center mt-3">
            Hội đồng chấm thi / Ban Giám Đốc: Tài khoản <code className="font-semibold text-slate-700">admin</code>
          </p>
        </form>
      </section>
    </main>
  );
}
