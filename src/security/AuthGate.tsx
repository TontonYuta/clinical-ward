import { useEffect, useRef, useState, type ReactNode } from 'react';
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
  const [serverAuthEnabled, setServerAuthEnabled] = useState(false);
  const [error, setError] = useState('');
  const sessionCheckInFlight = useRef(false);

  function acceptSession(session: AuthSession) {
    if (session.enabled === false && session.authenticated) {
      setAuth({ enabled: false, username: session.username || 'bac_si_test', role: (session.role as UserRole) || 'doctor' });
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
      .then(session => {
        if (!mounted) return;
        setError('');
        const isStrict = Boolean(session.enabled);
        setServerAuthEnabled(isStrict);
        if (!isStrict) {
          // Khi cờ auth = false (chế độ chọn vai trò Cách 1)
          const savedRole = sessionStorage.getItem('clinical_active_role') as UserRole | null;
          const savedUser = sessionStorage.getItem('clinical_active_username') || 'bac_si_test';
          if (savedRole) {
            setAuth({ enabled: false, username: savedUser, role: savedRole });
          } else {
            setAuth(null);
          }
        } else {
          // Khi cờ auth = true (chế độ đăng nhập hoàn chỉnh)
          acceptSession(session);
        }
      })
      .catch(() => {
        if (mounted) {
          setServerAuthEnabled(false);
          const savedRole = sessionStorage.getItem('clinical_active_role') as UserRole | null;
          if (savedRole) {
            setAuth({ enabled: false, username: 'bac_si_test', role: savedRole });
          } else {
            setAuth(null);
          }
        }
      })
      .finally(() => { if (mounted) setChecking(false); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!auth?.enabled) return;
    let mounted = true;
    const refreshSession = async () => {
      if (sessionCheckInFlight.current) return;
      sessionCheckInFlight.current = true;
      try {
        const session = await getAuthSession();
        if (!mounted) return;
        setError('');
        acceptSession(session);
      } catch (reason) {
        if (!mounted) return;
        setAuth(null);
        setError(reason instanceof Error ? reason.message : 'Không thể xác minh phiên đăng nhập.');
      } finally {
        sessionCheckInFlight.current = false;
      }
    };
    const onVisibility = () => { if (document.visibilityState === 'visible') void refreshSession(); };
    window.addEventListener('focus', onVisibility);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      mounted = false;
      window.removeEventListener('focus', onVisibility);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [auth?.enabled]);

  async function logout() {
    try { await logoutSession(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể kết thúc phiên đăng nhập.'); }
    sessionStorage.removeItem('clinical_active_role');
    sessionStorage.removeItem('clinical_active_username');
    setAuth(null);
  }

  if (checking) return <div className="min-h-screen grid place-items-center bg-slate-50 text-sm text-slate-600">Đang kiểm tra phiên đăng nhập…</div>;

  if (auth && (!allowedRoles || allowedRoles.includes(auth.role))) {
    return <>{children(auth, logout)}</>;
  }

  if (auth && allowedRoles && !allowedRoles.includes(auth.role)) {
    return (
      <main className="min-h-screen grid place-items-center bg-slate-50 p-6 text-center">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
          <h1 className="text-lg font-bold text-slate-900">Không đủ quyền truy cập</h1>
          <p className="mt-2 text-sm text-slate-600">Tài khoản này không được cấp quyền truy cập chức năng yêu cầu.</p>
          <button onClick={() => void logout()} className="mt-5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
            Đăng xuất
          </button>
        </div>
      </main>
    );
  }

  return (
    <LoginPage
      authRequired={serverAuthEnabled}
      onSuccess={session => {
        setError('');
        acceptSession(session);
      }}
    />
  );
}
