import { API_BASE_URL } from '../config/apiConfig';
import type { UserRole } from '../types/auth';

export type AuthSession = {
  enabled: boolean;
  authenticated: boolean;
  username: string | null;
  role: UserRole | null;
  name?: string | null;
  roleName?: string | null;
  department?: string | null;
  practiceCertificate?: string | null;
  pinCode?: string | null;
  rfidCardId?: string | null;
  academicTitle?: string | null;
  avatarUrl?: string | null;
  email?: string | null;
  phone?: string | null;
  dob?: string | null;
  responsibilities?: string | null;
  mustChangePassword?: boolean;
};

type RawAuthResponse = {
  enabled?: boolean;
  authenticated?: boolean;
  username?: string;
  role?: UserRole;
  name?: string;
  role_name?: string;
  department?: string;
  practice_certificate?: string;
  pin_code?: string;
  rfid_card_id?: string;
  academic_title?: string;
  avatar_url?: string;
  email?: string;
  phone?: string;
  dob?: string;
  responsibilities?: string;
  must_change_password?: boolean;
  token?: string;
};

function mapAuthResponse(raw: RawAuthResponse): AuthSession {
  return {
    enabled: raw.enabled ?? true,
    authenticated: raw.authenticated ?? true,
    username: raw.username || null,
    role: raw.role || null,
    name: raw.name || null,
    roleName: raw.role_name || null,
    department: raw.department || null,
    practiceCertificate: raw.practice_certificate || null,
    pinCode: raw.pin_code || null,
    rfidCardId: raw.rfid_card_id || null,
    academicTitle: raw.academic_title || null,
    avatarUrl: raw.avatar_url || null,
    email: raw.email || null,
    phone: raw.phone || null,
    dob: raw.dob || null,
    responsibilities: raw.responsibilities || null,
    mustChangePassword: raw.must_change_password ?? false,
  };
}

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
  const raw = await readJson<RawAuthResponse>(response);
  return mapAuthResponse(raw);
}

export async function loginWithCredentials(username: string, password: string): Promise<AuthSession> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: username.trim(), password }),
  });
  const raw = await readJson<RawAuthResponse>(response);
  if (raw.token && typeof localStorage !== 'undefined') {
    localStorage.setItem('clinical_auth_token', raw.token);
  }
  return mapAuthResponse(raw);
}

export async function logoutSession(): Promise<void> {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('clinical_auth_token');
  }
  const response = await fetch(`${API_BASE_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
  if (!response.ok) throw new Error('Không thể kết thúc phiên đăng nhập.');
}
