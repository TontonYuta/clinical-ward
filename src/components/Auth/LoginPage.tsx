import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, LoaderCircle } from 'lucide-react';
import { loginWithCredentials, type AuthSession } from '../../services/authApi';

export function LoginPage({ onSuccess }: { onSuccess: (session: AuthSession) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setError('');
    setSubmitting(true);
    try {
      onSuccess(await loginWithCredentials(username, password));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Đăng nhập thất bại. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-[#edf5fc] bg-cover bg-[center_left] px-5 py-8 flex items-center justify-center sm:px-8 lg:justify-end lg:bg-center lg:px-[7vw] xl:px-[10vw]" style={{ backgroundImage: "url('/images/login-locai-background.webp')" }}>
      <section className="relative z-10 w-full max-w-[360px] rounded-xl bg-white/75 px-6 py-7 shadow-[0_16px_48px_rgba(15,45,80,0.10)] backdrop-blur-[2px] sm:bg-transparent sm:px-0 sm:py-0 sm:shadow-none sm:backdrop-blur-0">
          <header className="mb-7">
            <p className="mb-2 text-xs font-semibold tracking-[0.16em] text-blue-800">CLINICAL WARD</p>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Đăng nhập</h1>
          </header>
          <form onSubmit={submit} className="space-y-5">
            <label className="block text-sm font-medium text-slate-700">Tên đăng nhập<div className="mt-2"><input value={username} onChange={e => setUsername(e.target.value)} name="username" autoComplete="username" required maxLength={100} className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-700 focus:ring-4 focus:ring-blue-700/10" placeholder="Tên đăng nhập" /></div></label>
            <label className="block text-sm font-medium text-slate-700">Mật khẩu<div className="relative mt-2"><input value={password} onChange={e => setPassword(e.target.value)} name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required maxLength={256} className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 pr-11 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-700 focus:ring-4 focus:ring-blue-700/10" placeholder="Mật khẩu" /><button type="button" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></label>
            {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
            <button disabled={submitting} className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 font-semibold text-white transition hover:bg-blue-800 disabled:cursor-wait disabled:opacity-70">{submitting && <LoaderCircle className="h-4 w-4 animate-spin" />}{submitting ? 'Đang xác thực…' : 'Đăng nhập'}</button>
          </form>
          <p className="mt-6 text-center text-xs text-slate-500">Chưa có tài khoản? Liên hệ quản trị viên.</p>
      </section>
    </main>
  );
}
