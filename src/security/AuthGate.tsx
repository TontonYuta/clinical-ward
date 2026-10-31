import React, { FormEvent, useEffect, useState } from 'react';
import type { UserRole } from '../types/auth';
type AuthState = { enabled: boolean; username: string; role: UserRole };
const API = (import.meta.env.VITE_API_BASE_URL as string | undefined) || '/api/v1';

export function AuthGate({ children }: { children: (auth: AuthState, logout: () => Promise<void>) => React.ReactNode }) {
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');
  async function logout() {
    try { await fetch(API + '/auth/logout', { method: 'POST', credentials: 'include' }); } catch { /* clear local view even if network is unavailable */ }
    setAuth(null);
    setChecking(true);
    try {
      const response = await fetch(API + '/auth/me', { credentials: 'include' });
      const data = await response.json();
      if (data?.authenticated && data.enabled === false) setAuth({ enabled: false, username: data.username, role: data.role });
    } catch { setError('Không kiểm tra được trạng thái đăng nhập.'); }
    finally { setChecking(false); }
  }
  useEffect(() => {
    fetch(API + '/auth/me', { credentials: 'include' })
      .then(async (response) => response.ok ? response.json() : null)
      .then((data) => { if (data?.authenticated) setAuth({ enabled: data.enabled, username: data.username, role: data.role }); })
      .catch(() => setError('Không kết nối được máy chủ xác thực.'))
      .finally(() => setChecking(false));
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(API + '/auth/login', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: form.get('username'), password: form.get('password') }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Đăng nhập thất bại.');
      setAuth({ enabled: true, username: data.username, role: data.role });
    } catch (e) { setError(e instanceof Error ? e.message : 'Đăng nhập thất bại.'); }
  }
  if (checking) return <div className="min-h-screen grid place-items-center bg-slate-50 text-slate-600">Đang kiểm tra phiên đăng nhập…</div>;
  if (auth) return <>{children(auth, logout)}</>;
  return <main className="min-h-screen grid place-items-center bg-slate-50 p-4"><form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"><h1 className="text-xl font-bold text-slate-900">Clinical Ward</h1><p className="mt-1 text-sm text-slate-600">Đăng nhập bằng tài khoản nội bộ đã được cấp.</p>{error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}<label className="mt-5 block text-sm font-medium">Tên đăng nhập<input name="username" autoComplete="username" required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label><label className="mt-4 block text-sm font-medium">Mật khẩu<input name="password" type="password" autoComplete="current-password" required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label><button className="mt-6 w-full rounded-lg bg-slate-900 px-4 py-2.5 font-semibold text-white">Đăng nhập</button></form></main>;
}
