import { API_BASE_URL } from '../config/apiConfig';
import type { UserRole } from '../types/auth';

export type AuthSession = {
  enabled: boolean;
  authenticated: boolean;
  username: string | null;
  role: UserRole | null;
};

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof body?.detail === 'string' ? body.detail : 'Không thể xác thực tài khoản.';
    throw new Error(message);
  }
  return body as T;
}

export async function getAuthSession(): Promise<AuthSession> {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('clinical_auth_token') : null;
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    credentials: 'include', cache: 'no-store', headers,
  });
  return readJson<AuthSession>(response);
}

export async function loginWithCredentials(username: string, password: string): Promise<AuthSession> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: username.trim(), password }),
  });
  const result = await readJson<{ username: string; role: UserRole; token?: string }>(response);
  if (result.token && typeof localStorage !== 'undefined') {
    localStorage.setItem('clinical_auth_token', result.token);
  }
  return { enabled: true, authenticated: true, username: result.username, role: result.role };
}

export async function logoutSession(): Promise<void> {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('clinical_auth_token');
  }
  const response = await fetch(`${API_BASE_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
  if (!response.ok) throw new Error('Không thể kết thúc phiên đăng nhập.');
}
