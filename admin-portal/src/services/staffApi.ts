import { StaffItem, StaffCreatePayload, StaffUpdatePayload, StaffListResponse } from '../types/staff';
import { getAdminToken } from './authApi';

const BASE_URL = '/api/v1/admin/staff';

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = 8000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  const headers = new Headers(options.headers || {});
  const token = getAdminToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  try {
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: options.credentials ?? 'include',
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(id);
  }
}

export async function fetchStaffList(params?: {
  search?: string;
  role?: string;
  department?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<StaffListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.set('search', params.search);
  if (params?.role && params.role !== 'all') searchParams.set('role', params.role);
  if (params?.department && params.department !== 'all') searchParams.set('department', params.department);
  if (params?.status && params.status !== 'all') searchParams.set('status', params.status);
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));

  const qs = searchParams.toString();
  const url = qs ? `${BASE_URL}?${qs}` : BASE_URL;

  const res = await fetchWithTimeout(url, {}, 8000);
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.detail || `Lỗi tải danh sách nhân viên: HTTP ${res.status}`);
  }
  return res.json();
}

export async function createStaff(payload: StaffCreatePayload): Promise<StaffItem> {
  const res = await fetchWithTimeout(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }, 8000);

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.detail || `Lỗi thêm nhân viên: HTTP ${res.status}`);
  }
  return res.json();
}

export async function updateStaff(id: string, payload: StaffUpdatePayload): Promise<StaffItem> {
  const res = await fetchWithTimeout(`${BASE_URL}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }, 8000);

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.detail || `Lỗi cập nhật nhân viên: HTTP ${res.status}`);
  }
  return res.json();
}

export async function toggleStaffStatus(id: string, isActive: boolean): Promise<{ status: string; is_active: boolean; message: string }> {
  const res = await fetchWithTimeout(`${BASE_URL}/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_active: isActive }),
  }, 8000);

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.detail || `Lỗi cập nhật trạng thái: HTTP ${res.status}`);
  }
  return res.json();
}

export async function resetStaffPin(id: string, newPin: string): Promise<{ status: string; message: string }> {
  const res = await fetchWithTimeout(`${BASE_URL}/${encodeURIComponent(id)}/reset-pin`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ new_pin: newPin }),
  }, 8000);

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.detail || `Lỗi đổi mã PIN: HTTP ${res.status}`);
  }
  return res.json();
}

export async function resetStaffPassword(
  id: string,
  newPassword: string,
  mustChangePassword: boolean = true
): Promise<{ status: string; user_id: string; username?: string; message: string }> {
  const res = await fetchWithTimeout(`${BASE_URL}/${encodeURIComponent(id)}/reset-password`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      new_password: newPassword,
      must_change_password: mustChangePassword,
    }),
  }, 8000);

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.detail || `Lỗi cấp lại mật khẩu: HTTP ${res.status}`);
  }
  return res.json();
}

export async function softDeleteStaff(id: string): Promise<{ status: string; id: string; message: string }> {
  const res = await fetchWithTimeout(`${BASE_URL}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  }, 8000);

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.detail || `Lỗi tạm ngưng nhân viên: HTTP ${res.status}`);
  }
  return res.json();
}
