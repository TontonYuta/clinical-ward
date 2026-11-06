import React, { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import type { UserRole } from '../types/auth';
import { API_BASE_URL as API } from '../config/apiConfig';

type AuthState = { enabled: boolean; username: string; role: UserRole };
type AuthView = 'checking' | 'login' | 'ready' | 'unavailable';
const ROLES: UserRole[] = ['nurse', 'doctor', 'pharmacist', 'biomedical_engineer', 'director'];

function accountFromResponse(data: unknown): Pick<AuthState, 'username' | 'role'> | null {
  if (!data || typeof data !== 'object') return null;
  const account = data as Record<string, unknown>;
  return typeof account.username === 'string' && account.username.trim() && ROLES.includes(account.role as UserRole)
    ? { username: account.username, role: account.role as UserRole }
    : null;
}

function clearClinicalCache() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('clinical_cached_') || ['clinical_patients_cache_v1', 'clinical_chat_messages', 'clinical_ward_chat_messages', 'clinical_saved_advices_v1', 'clinical_patient_email_logs_v1'].includes(key)) localStorage.removeItem(key);
    }
  } catch { /* Cache availability must not determine authentication. */ }
}

async function authFetch(path: string, options: RequestInit = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try { return await fetch(API + path, { ...options, credentials: 'include', signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

export function AuthGate({ children }: { children: (auth: AuthState, logout: () => Promise<void>) => React.ReactNode }) {
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [view, setView] = useState<AuthView>('checking');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const revision = useRef(0);

  const checkSession = useCallback(async () => {
    const requestRevision = ++revision.current;
    setAuth(null);
    setView('checking');
    setError('');
    try {
      const response = await authFetch('/auth/me');
      if (requestRevision !== revision.current) return;
      if (response.status === 401 || response.status === 403) { setView('login'); return; }
      if (!response.ok) throw new Error(`Máy chủ xác thực chưa khả dụng (HTTP ${response.status}).`);
      const data = await response.json();
      if (requestRevision !== revision.current) return;
      const account = accountFromResponse(data);
      if (data?.enabled === true && data.authenticated === false) { setView('login'); return; }
      if (!account || data?.authenticated !== true || typeof data.enabled !== 'boolean') throw new Error('Máy chủ trả về trạng thái xác thực không hợp lệ.');
      if (data.enabled) clearClinicalCache();
      setAuth({ ...account, enabled: data.enabled });
      setView('ready');
    } catch (failure) {
      if (requestRevision !== revision.current) return;
      setError(failure instanceof Error && failure.name !== 'AbortError' ? failure.message : 'Hết thời gian kết nối máy chủ xác thực.');
      setView('unavailable');
    }
  }, []);

  useEffect(() => {
    void checkSession();
    return () => { revision.current++; };
  }, [checkSession]);

  async function logout() {
    const requestRevision = ++revision.current;
    setAuth(null);
    setView('checking');
    setError('');
    clearClinicalCache();
    try {
      const response = await authFetch('/auth/logout', { method: 'POST' });
      if (requestRevision !== revision.current) return;
      if (!response.ok) throw new Error('Chưa xác nhận được đăng xuất trên máy chủ.');
      setView('login');
    } catch (failure) {
      if (requestRevision !== revision.current) return;
      setError(failure instanceof Error && failure.name !== 'AbortError' ? failure.message : 'Chưa xác nhận được đăng xuất do mất kết nối.');
      setView('unavailable');
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const requestRevision = ++revision.current;
    const form = new FormData(event.currentTarget);
    setError('');
    setSubmitting(true);
    try {
      const response = await authFetch('/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: form.get('username'), password: form.get('password') }),
      });
      const data = await response.json().catch(() => null);
      if (requestRevision !== revision.current) return;
      if (!response.ok) throw new Error(typeof data?.detail === 'string' ? data.detail : 'Đăng nhập thất bại.');
      const account = accountFromResponse(data);
      if (!account) throw new Error('Máy chủ trả về tài khoản hoặc vai trò không hợp lệ.');
      clearClinicalCache();
      setAuth({ ...account, enabled: true });
      setView('ready');
    } catch (failure) {
      if (requestRevision === revision.current) setError(failure instanceof Error && failure.name !== 'AbortError' ? failure.message : 'Không kết nối được máy chủ đăng nhập.');
    } finally { if (requestRevision === revision.current) setSubmitting(false); }
  }

  if (view === 'checking') return <div role="status" aria-live="polite" className="min-h-screen grid place-items-center bg-slate-50 text-slate-700">Đang kiểm tra phiên đăng nhập…</div>;
  if (view === 'ready' && auth) return <>{children(auth, logout)}</>;
  if (view === 'unavailable') return <main className="min-h-screen grid place-items-center bg-slate-50 p-4"><section className="w-full max-w-md border border-slate-300 bg-white p-6 shadow-lg"><h1 className="text-xl font-semibold text-slate-950">Chưa kiểm tra được phiên làm việc</h1><p role="alert" className="mt-3 text-sm text-amber-950">{error}</p><p className="mt-3 text-sm text-slate-600">Dữ liệu lâm sàng chưa được mở khi chưa xác định được trạng thái đăng nhập.</p><button type="button" onClick={() => void checkSession()} className="mt-5 rounded-lg bg-slate-900 px-4 py-2.5 font-semibold text-white">Thử lại kiểm tra phiên</button></section></main>;
  return <main className="min-h-screen grid place-items-center bg-slate-50 p-4"><form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"><h1 className="text-xl font-bold text-slate-900">Clinical Ward</h1><p className="mt-1 text-sm text-slate-600">Đăng nhập bằng tài khoản nội bộ đã được cấp.</p>{error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}<label className="mt-5 block text-sm font-medium">Tên đăng nhập<input name="username" autoComplete="username" required disabled={submitting} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label><label className="mt-4 block text-sm font-medium">Mật khẩu<input name="password" type="password" autoComplete="current-password" required disabled={submitting} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label><button disabled={submitting} className="mt-6 w-full rounded-lg bg-slate-900 px-4 py-2.5 font-semibold text-white disabled:opacity-60">{submitting ? 'Đang đăng nhập…' : 'Đăng nhập'}</button></form></main>;
}
