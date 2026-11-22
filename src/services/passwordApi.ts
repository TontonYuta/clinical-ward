/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * API Service: Quản lý đổi mật khẩu nhân viên y tế tự phục vụ (Self-Service)
 */

import { API_BASE_URL } from '../config/apiConfig';

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ChangePasswordResponse {
  status: string;
  message: string;
  must_change_password: boolean;
  token?: string;
  username?: string;
  name?: string;
}

export async function changeStaffPassword(payload: ChangePasswordPayload): Promise<ChangePasswordResponse> {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('clinical_auth_token') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify({
      current_password: payload.currentPassword,
      new_password: payload.newPassword,
      confirm_password: payload.confirmPassword,
    }),
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorDetail = typeof body?.detail === 'string'
      ? body.detail
      : 'Không thể đổi mật khẩu. Vui lòng kiểm tra lại thông tin.';
    throw new Error(errorDetail);
  }

  // Update saved token if refreshed
  if (body.token && typeof localStorage !== 'undefined') {
    localStorage.setItem('clinical_auth_token', body.token);
  }

  return body as ChangePasswordResponse;
}
