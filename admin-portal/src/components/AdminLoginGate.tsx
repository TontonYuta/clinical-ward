import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Activity, Eye, EyeOff, LoaderCircle, ShieldCheck } from 'lucide-react';
import { loginAdmin, logoutAdmin, readAdminSession, type AdminAuthSession } from '../services/authApi';
import { clearMonitorPrivateCache, readAuthGatePreference, saveAuthGatePreference } from '../services/authGatePreference';

export type AdminGateContext = {
  username?: string;
  logout?: () => Promise<void>;
  authEnabled: boolean;
  canConfigureAuth: boolean;
  onToggleAuth: () => void;
};

export function AdminLoginGate({ children }: { children: (context: AdminGateContext) => ReactNode }) {
  const [session, setSession] = useState<AdminAuthSession | null>(null);
  const [authEnabled, setAuthEnabled] = useState(readAuthGatePreference);
  const [checking, setChecking] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    readAdminSession().then(value => {
      if (active) {
        setSession(value);
        if (value.enabled && !value.authenticated) clearMonitorPrivateCache();
      }
    })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Không kết nối được máy chủ xác thực.'); })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true); setError('');
    try {
      const value = await loginAdmin(username, password);
      if (value.role !== 'director') {
        await logoutAdmin();
        throw new Error('Tài khoản này không có quyền truy cập monitor quản trị.');
      }
      setSession(value); setPassword('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Đăng nhập thất bại.');
    } finally { setSubmitting(false); }
  }

  async function logout() {
    try { await logoutAdmin(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể kết thúc phiên đăng nhập.'); }
    clearMonitorPrivateCache();
    setSession({ enabled: true, authenticated: false, username: null, role: null });
  }

  function toggleAuth() {
    setAuthEnabled(current => {
      const next = !current;
      saveAuthGatePreference(next);
      if (!next && !session?.authenticated) clearMonitorPrivateCache();
      return next;
    });
  }

  if (checking) return <div className="min-h-screen grid place-items-center text-sm text-slate-500">Đang kiểm tra phiên quản trị…</div>;
  const canConfigureAuth = session?.enabled === true && (
    (!authEnabled && !session.authenticated) || (session.role === 'director' && session.authenticated)
  );
  const context: AdminGateContext = {
    username: session?.authenticated ? session.username ?? undefined : undefined,
    logout: session?.authenticated ? logout : undefined,
    authEnabled,
    canConfigureAuth,
    onToggleAuth: toggleAuth,
  };
  if (session?.enabled === false) return <>{children(context)}</>;
  if (!authEnabled || (session?.authenticated && session.role === 'director')) return <>{children(context)}</>;
  if (session?.authenticated) return <main className="min-h-screen grid place-items-center bg-slate-50 p-6 text-center"><div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-lg"><h1 className="text-lg font-bold text-slate-900">Không đủ quyền quản trị</h1><p className="mt-2 text-sm text-slate-600">Tài khoản đang đăng nhập không được cấp quyền vào Clinical AI Monitor.</p><button onClick={() => void logout()} className="mt-5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Đăng xuất</button></div></main>;

  return <main className="min-h-screen grid place-items-center bg-slate-950 p-4"><div className="grid w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl md:grid-cols-2"><section className="hidden flex-col justify-between bg-gradient-to-br from-slate-900 via-teal-950 to-teal-800 p-10 text-white md:flex"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-white/10"><Activity /></span><div className="font-bold">Clinical AI Monitor</div></div><div><p className="text-sm uppercase tracking-widest text-teal-200">Khu vực quản trị</p><h1 className="mt-3 text-3xl font-semibold leading-tight">Theo dõi hệ thống và quản lý cấu hình an toàn.</h1></div><p className="text-xs text-teal-100/70">Chỉ tài khoản có quyền quản trị mới được tiếp tục.</p></section><section className="p-7 sm:p-10"><div className="mb-7 grid h-12 w-12 place-items-center rounded-2xl bg-teal-50 text-teal-800"><ShieldCheck /></div><h2 className="text-2xl font-bold text-slate-900">Đăng nhập quản trị</h2><p className="mt-2 text-sm text-slate-500">Sử dụng tài khoản nhân viên được cấp.</p><form onSubmit={submit} className="mt-7 space-y-5"><label className="block text-sm font-semibold text-slate-700">Tên đăng nhập<input value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" required maxLength={100} className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 outline-none focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10" /></label><label className="block text-sm font-semibold text-slate-700">Mật khẩu<span className="relative mt-2 block"><input value={password} onChange={e => setPassword(e.target.value)} type={showPassword ? 'text' : 'password'} autoComplete="current-password" required maxLength={256} className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 pr-11 outline-none focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10" /><button type="button" aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></span></label>{error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}<button disabled={submitting} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-teal-800 font-semibold text-white hover:bg-teal-900 disabled:opacity-60">{submitting && <LoaderCircle className="animate-spin" size={17} />}{submitting ? 'Đang xác thực…' : 'Đăng nhập'}</button></form><p className="mt-6 text-center text-xs text-slate-400">Chưa có tài khoản? Liên hệ quản trị hệ thống.</p><button type="button" onClick={toggleAuth} className="mt-4 w-full text-center text-xs font-medium text-slate-500 underline underline-offset-2 hover:text-slate-800">Ẩn form trên thiết bị này (API backend vẫn bảo vệ)</button></section></div></main>;
}
