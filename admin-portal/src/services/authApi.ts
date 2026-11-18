export type AdminAuthSession = {
  enabled: boolean;
  authenticated: boolean;
  username: string | null;
  role: string | null;
};

async function parse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data?.detail === 'string' ? data.detail : 'Không thể xác thực tài khoản.');
  return data as T;
}

export async function readAdminSession(): Promise<AdminAuthSession> {
  return parse(await fetch('/api/v1/auth/me', { credentials: 'include', cache: 'no-store' }));
}

export async function loginAdmin(username: string, password: string): Promise<AdminAuthSession> {
  const response = await fetch('/api/v1/auth/login', {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: username.trim(), password }),
  });
  const data = await parse<{ username: string; role: string }>(response);
  return { enabled: true, authenticated: true, username: data.username, role: data.role };
}

export async function logoutAdmin(): Promise<void> {
  const response = await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' });
  if (!response.ok) throw new Error('Không thể kết thúc phiên đăng nhập.');
}
