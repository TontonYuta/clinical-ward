import { useEffect, useState, type ReactNode } from 'react';
import type { UserRole } from '../types/auth';
import { LoginPage } from '../components/Auth/LoginPage';
import { getAuthSession, logoutSession, type AuthSession } from '../services/authApi';

type AuthState = { enabled: boolean; username: string; role: UserRole };
type AuthGateProps = {
  children: (auth: AuthState, logout: () => Promise<void>) => ReactNode;
  allowedRoles?: UserRole[];
};

export function AuthGate({ children, allowedRoles }: AuthGateProps) {
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');

  function acceptSession(session: AuthSession) {
    if (session.enabled === false && session.authenticated) {
      setAuth({ enabled: false, username: session.username || 'local', role: session.role || 'nurse' });
      return;
    }
    if (!session.authenticated || !session.role || !session.username) {
      setAuth(null);
      return;
    }
    setAuth({ enabled: session.enabled, username: session.username, role: session.role });
  }

  useEffect(() => {
    let mounted = true;
    getAuthSession()
      .then(session => { if (mounted) acceptSession(session); })
      .catch(reason => { if (mounted) setError(reason instanceof Error ? reason.message : 'Không kết nối được máy chủ xác thực.'); })
      .finally(() => { if (mounted) setChecking(false); });
    return () => { mounted = false; };
  }, []);

  async function logout() {
    try { await logoutSession(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể kết thúc phiên đăng nhập.'); }
    setAuth(null);
  }

  if (checking) return <div className="min-h-screen grid place-items-center bg-slate-50 text-sm text-slate-600">Đang kiểm tra phiên đăng nhập…</div>;
  if (auth?.enabled === false) return <>{children(auth, logout)}</>;
  if (auth && (!allowedRoles || allowedRoles.includes(auth.role))) return <>{children(auth, logout)}</>;
  if (auth && allowedRoles && !allowedRoles.includes(auth.role)) {
    return <main className="min-h-screen grid place-items-center bg-slate-50 p-6 text-center"><div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-lg"><h1 className="text-lg font-bold text-slate-900">Không đủ quyền truy cập</h1><p className="mt-2 text-sm text-slate-600">Tài khoản này không được cấp quyền quản trị hệ thống.</p><button onClick={() => void logout()} className="mt-5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Đăng xuất</button></div></main>;
  }
  if (error) return <main className="min-h-screen grid place-items-center bg-slate-50 p-6"><div role="alert" className="max-w-md rounded-2xl border border-rose-200 bg-white p-6 text-sm text-rose-800 shadow-lg">{error}</div></main>;
  return <LoginPage onSuccess={acceptSession} />;
}
