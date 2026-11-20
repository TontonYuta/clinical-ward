import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, LoaderCircle, ShieldCheck, Sparkles, KeyRound } from 'lucide-react';
import { loginWithCredentials, type AuthSession } from '../../services/authApi';
import type { UserRole } from '../../types/auth';

interface DemoAccount {
  label: string;
  roleTitle: string;
  username: string;
  password: string;
  role: UserRole;
  isPrimary?: boolean;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  { label: 'Admin', roleTitle: 'Ban Giám Đốc · Toàn quyền quản trị', username: 'admin', password: 'admin', role: 'director', isPrimary: true },
  { label: 'Bác sĩ', roleTitle: 'Hồi Sức Cấp Cứu · Kê Đơn CPOE', username: 'bac_si_test', password: 'Doctor@2026!', role: 'doctor' },
  { label: 'Dược sĩ', roleTitle: 'Dược Lâm Sàng & Duyệt Toa', username: 'duoc_si_test', password: 'Pharm@2026!', role: 'pharmacist' },
  { label: 'Điều dưỡng', roleTitle: 'Tủ Trực Cấp Cứu & Buồng Bệnh', username: 'dieu_duong_test', password: 'Nurse@2026!', role: 'nurse' },
];

interface LoginPageProps {
  authRequired?: boolean;
  onSuccess: (session: AuthSession) => void;
}

export function LoginPage({ authRequired = true, onSuccess }: LoginPageProps) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Đăng nhập qua API xác thực
  async function performLogin(userVal: string, passVal: string) {
    if (submitting) return;
    setError('');
    setSubmitting(true);
    try {
      const session = await loginWithCredentials(userVal, passVal);
      sessionStorage.setItem('clinical_active_role', session.role || 'director');
      sessionStorage.setItem('clinical_active_username', session.username || userVal);
      onSuccess(session);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Tên đăng nhập hoặc mật khẩu không chính xác.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleFullLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void performLogin(username, password);
  }

  function handleSelectDemo(acc: DemoAccount, autoSubmit = false) {
    setUsername(acc.username);
    setPassword(acc.password);
    setError('');
    if (autoSubmit) {
      void performLogin(acc.username, acc.password);
    }
  }

  return (
    <main
      className="relative isolate min-h-screen overflow-hidden bg-[#edf5fc] bg-cover bg-[center_left] px-5 py-8 flex items-center justify-center sm:px-8 lg:justify-end lg:bg-center lg:px-[7vw] xl:px-[10vw]"
      style={{ backgroundImage: "url('/images/login-locai-background.webp')" }}
    >
      {/* Vùng đăng nhập sát bên phải, thiết kế phẳng, thanh thoát, tập trung */}
      <section className="relative z-10 w-full max-w-[340px] text-left">
        <header className="mb-4">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="p-1 rounded-md bg-blue-600 text-white shadow-xs">
              <ShieldCheck className="w-4 h-4" />
            </span>
            <span className="text-2xs font-bold uppercase tracking-wider text-blue-900">
              Hệ Thống Y Tế Lâm Sàng
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Đăng nhập
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Xác thực phiên làm việc y bác sĩ &amp; quản trị viên
          </p>
        </header>

        {/* Khối gợi ý tài khoản Demo nổi bật */}
        <div className="mb-4 p-3 rounded-xl bg-amber-50/95 border border-amber-200/90 shadow-xs text-xs space-y-2">
          <div className="flex items-center justify-between gap-1 flex-wrap">
            <span className="font-bold text-amber-950 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-amber-700" />
              <span>Tài khoản Demo:</span>
              <code className="px-1.5 py-0.5 bg-amber-200/60 rounded text-amber-950 font-mono font-bold text-2xs">
                admin / admin
              </code>
            </span>
            <button
              type="button"
              onClick={() => handleSelectDemo(DEMO_ACCOUNTS[0], false)}
              className="text-2xs font-bold text-blue-700 hover:text-blue-900 bg-white hover:bg-slate-50 px-2 py-0.5 rounded-md border border-amber-300 hover:border-blue-400 transition cursor-pointer shadow-2xs inline-flex items-center gap-1"
              title="Điền tự động admin / admin"
            >
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>Điền nhanh</span>
            </button>
          </div>
          <p className="text-2xs text-amber-900 leading-normal">
            Quyền Giám đốc &amp; Ban Quản trị: Toàn quyền Kho dược, CPOE, Phê duyệt cấp phát.
          </p>
        </div>

        {/* Form đăng nhập hoàn chỉnh */}
        <form onSubmit={handleFullLogin} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
              Tên đăng nhập
            </label>
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              required
              maxLength={100}
              className="w-full h-11 rounded-xl bg-white/95 border border-slate-300 px-3 text-sm text-slate-900 outline-none transition focus:border-blue-700 focus:ring-4 focus:ring-blue-700/10 shadow-sm"
              placeholder="Nhập tên đăng nhập (ví dụ: admin)"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
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
                placeholder="Nhập mật khẩu"
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
            className="w-full h-11 mt-1 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-semibold text-sm transition shadow-sm hover:shadow flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
          >
            {submitting && <LoaderCircle className="h-4 w-4 animate-spin" />}
            {submitting ? 'Đang xác thực…' : 'Đăng nhập'}
          </button>
        </form>

        {/* Danh sách vai trò demo mở rộng */}
        <div className="mt-5 pt-3.5 border-t border-slate-200/80">
          <p className="text-2xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
            Hoặc chọn vai trò demo 1-chạm:
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {DEMO_ACCOUNTS.map(acc => (
              <button
                key={acc.username}
                type="button"
                disabled={submitting}
                onClick={() => handleSelectDemo(acc, true)}
                className="p-2 rounded-lg bg-white/80 hover:bg-white text-left border border-slate-200/80 hover:border-blue-400 transition cursor-pointer shadow-2xs group"
                title={`Đăng nhập nhanh với vai trò ${acc.label} (${acc.username})`}
              >
                <div className="text-xs font-bold text-slate-800 group-hover:text-blue-700 truncate">
                  {acc.label}
                </div>
                <div className="text-3xs text-slate-600 font-mono truncate">
                  {acc.username}
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
