import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, LoaderCircle } from 'lucide-react';
import { loginWithCredentials, type AuthSession } from '../../services/authApi';

interface RoleOption {
  label: string;
  username: string;
  password: string;
  role: 'doctor' | 'pharmacist' | 'nurse' | 'director';
}

const ROLES: RoleOption[] = [
  { label: 'Bác sĩ', username: 'bac_si_test', password: 'Doctor@2026!', role: 'doctor' },
  { label: 'Dược sĩ', username: 'duoc_si_test', password: 'Pharm@2026!', role: 'pharmacist' },
  { label: 'Điều dưỡng', username: 'dieu_duong_test', password: 'Nurse@2026!', role: 'nurse' },
  { label: 'Giám đốc', username: 'director', password: 'Director@2026!', role: 'director' },
];

interface LoginPageProps {
  authRequired?: boolean;
  onSuccess: (session: AuthSession) => void;
}

export function LoginPage({ authRequired = false, onSuccess }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Cách 1: Đăng nhập 1 chạm trực tiếp theo vai trò (khi authRequired = false)
  async function handleRoleLogin(r: RoleOption) {
    if (submitting) return;
    setError('');
    setSubmitting(true);
    try {
      const session = await loginWithCredentials(r.username, r.password);
      sessionStorage.setItem('clinical_active_role', r.role);
      sessionStorage.setItem('clinical_active_username', r.username);
      onSuccess(session);
    } catch {
      // Fallback an toàn nếu backend đang chạy chế độ không auth
      const fallbackSession: AuthSession = {
        enabled: false,
        authenticated: true,
        username: r.username,
        role: r.role
      };
      sessionStorage.setItem('clinical_active_role', r.role);
      sessionStorage.setItem('clinical_active_username', r.username);
      onSuccess(fallbackSession);
    } finally {
      setSubmitting(false);
    }
  }

  // Đăng nhập hoàn chỉnh (khi authRequired = true)
  async function handleFullLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setError('');
    setSubmitting(true);
    try {
      const session = await loginWithCredentials(username, password);
      onSuccess(session);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Tên đăng nhập hoặc mật khẩu không chính xác.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main
      className="min-h-screen w-full flex items-center justify-center p-6 bg-cover bg-center"
      style={{ backgroundImage: "url('/images/login-locai-background.webp')" }}
    >
      <div className="w-full max-w-[340px] text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 mb-8">
          Đăng nhập
        </h1>

        {!authRequired ? (
          /* CÁCH 1: KHÔNG DÙNG KHUNG, CHỈ CÓ CÁC VAI TRÒ THUẦN CHỮ (KHÔNG ICON) */
          <div className="space-y-3">
            {ROLES.map(r => (
              <button
                key={r.username}
                type="button"
                disabled={submitting}
                onClick={() => void handleRoleLogin(r)}
                className="w-full h-12 rounded-xl bg-white/90 hover:bg-white text-slate-800 hover:text-blue-700 font-medium text-sm transition-all backdrop-blur-sm border border-slate-200/80 hover:border-blue-300 shadow-sm hover:shadow flex items-center justify-center disabled:opacity-60"
              >
                {submitting ? <LoaderCircle className="h-4 w-4 animate-spin text-slate-400" /> : r.label}
              </button>
            ))}
          </div>
        ) : (
          /* ĐĂNG NHẬP HOÀN CHỈNH KHI CỜ AUTH = TRUE */
          <form onSubmit={handleFullLogin} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
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
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {error && (
              <p role="alert" className="text-xs text-rose-700 font-medium">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="w-full h-11 mt-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-medium text-sm transition shadow-sm hover:shadow flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {submitting && <LoaderCircle className="h-4 w-4 animate-spin" />}
              {submitting ? 'Đang xác thực…' : 'Đăng nhập'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
