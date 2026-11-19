import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, LoaderCircle, Sparkles } from 'lucide-react';
import { loginWithCredentials, type AuthSession } from '../../services/authApi';

const DEMO_PERSONAS = [
  { label: '🩺 Bác sĩ', username: 'bac_si_test', password: 'Doctor@2026!' },
  { label: '💊 Dược sĩ', username: 'duoc_si_test', password: 'Pharm@2026!' },
  { label: '🏥 Điều dưỡng', username: 'dieu_duong_test', password: 'Nurse@2026!' },
  { label: '🏛️ Giám đốc', username: 'director', password: 'Director@2026!' },
];

export function LoginPage({ onSuccess }: { onSuccess: (session: AuthSession) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event?: FormEvent<HTMLFormElement>, customUser?: string, customPass?: string) {
    if (event) event.preventDefault();
    if (submitting) return;
    const targetUser = customUser !== undefined ? customUser : username;
    const targetPass = customPass !== undefined ? customPass : password;
    setError('');
    setSubmitting(true);
    try {
      onSuccess(await loginWithCredentials(targetUser, targetPass));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Đăng nhập thất bại. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  }

  function selectDemoPersona(p: typeof DEMO_PERSONAS[0]) {
    setUsername(p.username);
    setPassword(p.password);
    void submit(undefined, p.username, p.password);
  }

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-[#edf5fc] bg-cover bg-[center_left] px-5 py-8 flex items-center justify-center sm:px-8 lg:justify-end lg:bg-center lg:px-[7vw] xl:px-[10vw]" style={{ backgroundImage: "url('/images/login-locai-background.webp')" }}>
      <section className="relative z-10 w-full max-w-[380px] rounded-2xl bg-white/90 p-7 shadow-2xl backdrop-blur-md border border-slate-200/80">
          <header className="mb-6">
            <p className="mb-1 text-xs font-bold tracking-[0.16em] text-blue-700 uppercase">HỆ THỐNG LÂM SÀNG NỘI VIỆN</p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Đăng nhập tài khoản</h1>
            <p className="mt-1 text-xs text-slate-500">Nhập thông tin xác thực để bắt đầu ca làm việc</p>
          </header>

          <form onSubmit={submit} className="space-y-4">
            <label className="block text-sm font-medium text-slate-700">Tên đăng nhập
              <div className="mt-1.5">
                <input value={username} onChange={e => setUsername(e.target.value)} name="username" autoComplete="username" required maxLength={100} className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-700 focus:ring-4 focus:ring-blue-700/10" placeholder="Tên đăng nhập" />
              </div>
            </label>
            <label className="block text-sm font-medium text-slate-700">Mật khẩu
              <div className="relative mt-1.5">
                <input value={password} onChange={e => setPassword(e.target.value)} name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required maxLength={256} className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 pr-10 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-700 focus:ring-4 focus:ring-blue-700/10" placeholder="Mật khẩu" />
                <button type="button" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>
            {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-800">{error}</p>}
            <button disabled={submitting} className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-wait disabled:opacity-70 shadow-sm shadow-blue-700/20">
              {submitting && <LoaderCircle className="h-4 w-4 animate-spin" />}
              {submitting ? 'Đang xác thực…' : 'Đăng nhập'}
            </button>
          </form>

          {/* Cụm chọn nhanh tài khoản mẫu thử nghiệm */}
          <div className="mt-6 pt-5 border-t border-slate-200">
            <div className="flex items-center gap-1.5 mb-2.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">Chọn nhanh tài khoản mẫu (1-Click Demo)</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_PERSONAS.map(p => (
                <button
                  key={p.username}
                  type="button"
                  disabled={submitting}
                  onClick={() => selectDemoPersona(p)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50/80 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 text-xs text-left font-medium text-slate-700 transition flex items-center justify-between"
                >
                  <span>{p.label}</span>
                  <span className="text-[10px] text-slate-400 font-mono">demo</span>
                </button>
              ))}
            </div>
          </div>

          <p className="mt-5 text-center text-xs text-slate-400">Hệ thống tuân thủ tiêu chuẩn an toàn an ninh y tế</p>
      </section>
    </main>
  );
}