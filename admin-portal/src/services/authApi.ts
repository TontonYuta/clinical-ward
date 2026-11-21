export type AdminAuthSession = {
  enabled: boolean;
  authenticated: boolean;
  username: string | null;
  role: string | null;
};

const ADMIN_TOKEN_KEY = 'clinical_admin_token';

export function getAdminToken(): string | null {
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY) || localStorage.getItem('clinical_auth_token');
  } catch {
    return null;
  }
}

export function setAdminToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(ADMIN_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(ADMIN_TOKEN_KEY);
    }
  } catch {
    // localStorage may be unavailable in some iframe sandboxes
  }
}

async function parse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data?.detail === 'string' ? data.detail : 'Không thể xác thực tài khoản.');
  return data as T;
}

export async function readAdminSession(): Promise<AdminAuthSession> {
  const token = getAdminToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return parse(await fetch('/api/v1/auth/me', { credentials: 'include', cache: 'no-store', headers }));
}

export async function loginAdmin(username: string, password: string): Promise<AdminAuthSession> {
  const response = await fetch('/api/v1/auth/login', {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: username.trim(), password }),
  });
  const data = await parse<{ username: string; role: string; token?: string }>(response);
  if (data.token) {
    setAdminToken(data.token);
  }
  return { enabled: true, authenticated: true, username: data.username, role: data.role };
}

export async function logoutAdmin(): Promise<void> {
  const token = getAdminToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  setAdminToken(null);
  const response = await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include', headers });
  if (!response.ok) throw new Error('Không thể kết thúc phiên đăng nhập.');
}
