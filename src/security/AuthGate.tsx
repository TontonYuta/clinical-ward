import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { UserProfile, UserRole } from '../types/auth';
import { LoginPage } from '../components/Auth/LoginPage';
import { getAuthSession, logoutSession, type AuthSession } from '../services/authApi';
import { USER_PROFILES } from '../data/initialData';

export type AuthState = { enabled: boolean; username: string; role: UserRole; userProfile: UserProfile };
type AuthGateProps = {
  children: (auth: AuthState, logout: () => Promise<void>) => ReactNode;
  allowedRoles?: UserRole[];
};

function buildUserProfileFromSession(session: AuthSession): UserProfile {
  const role = (session.role as UserRole) || 'doctor';
  const fallback = USER_PROFILES[role] || USER_PROFILES.doctor;
  return {
    role,
    name: session.name || session.username || fallback.name,
    roleName: session.roleName || fallback.roleName,
    department: session.department || fallback.department,
    practiceCertificate: session.practiceCertificate || fallback.practiceCertificate,
    pinCode: session.pinCode || fallback.pinCode,
    rfidCardId: session.rfidCardId || fallback.rfidCardId,
    email: session.email || undefined,
    phone: session.phone || undefined,
    dob: session.dob || undefined,
    academicTitle: session.academicTitle || undefined,
    avatarUrl: session.avatarUrl || undefined,
    responsibilities: session.responsibilities || fallback.responsibilities,
    allowedActions: fallback.allowedActions,
    allowedTabs: fallback.allowedTabs,
    defaultTab: fallback.defaultTab,
    badgeColor: fallback.badgeColor,
    username: session.username || undefined,
    mustChangePassword: session.mustChangePassword,
  };
}

export function AuthGate({ children, allowedRoles }: AuthGateProps) {
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [checking, setChecking] = useState(true);
  const [serverAuthEnabled, setServerAuthEnabled] = useState(false);
  const [error, setError] = useState('');
  const sessionCheckInFlight = useRef(false);

  function acceptSession(session: AuthSession) {
    const profile = buildUserProfileFromSession(session);
    try {
      sessionStorage.setItem('clinical_active_profile', JSON.stringify(profile));
    } catch {
      // storage fallback
    }
    if (session.enabled === false && session.authenticated) {
      setAuth({ enabled: false, username: session.username || 'bac_si_test', role: (session.role as UserRole) || 'doctor', userProfile: profile });
      return;
    }
    if (!session.authenticated || !session.role || !session.username) {
      setAuth(null);
      return;
    }
    setAuth({ enabled: session.enabled, username: session.username, role: session.role, userProfile: profile });
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
          let savedProfile: UserProfile | undefined = undefined;
          try {
            const rawProfile = sessionStorage.getItem('clinical_active_profile');
            if (rawProfile) savedProfile = JSON.parse(rawProfile);
          } catch {
            // ignore
          }
          if (savedRole) {
            const roleProfile = savedProfile || USER_PROFILES[savedRole] || USER_PROFILES.nurse;
            setAuth({ enabled: false, username: savedUser, role: savedRole, userProfile: roleProfile });
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
            setAuth({ enabled: false, username: 'bac_si_test', role: savedRole, userProfile: USER_PROFILES[savedRole] || USER_PROFILES.nurse });
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
    sessionStorage.removeItem('clinical_active_profile');
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
