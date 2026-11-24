/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Dịch vụ Đồng bộ Phiên Trò chuyện Đám mây (Cross-Device Chat Sync API)
 * Đảm bảo dữ liệu hội thoại được đồng bộ xuyên thiết bị với bảo mật tuyệt đối.
 */

import { ChatSession } from '../types/chatSession';
import { API_BASE_URL, apiFetch } from './api';

export async function fetchUserCloudSessions(username?: string): Promise<ChatSession[]> {
  try {
    const url = username
      ? `${API_BASE_URL}/copilot/user-sessions?username=${encodeURIComponent(username)}&limit=20`
      : `${API_BASE_URL}/copilot/user-sessions?limit=20`;

    const res = await apiFetch(url, {
      method: 'GET',
      credentials: 'include'
    });

    if (!res.ok) {
      console.warn('[ChatSyncApi] Không thể tải phiên từ máy chủ, mã lỗi:', res.status);
      return [];
    }

    const data = await res.json();
    if (!Array.isArray(data)) return [];

    return data.map((item: any) => ({
      id: item.id,
      title: item.title || 'Cuộc trò chuyện mới',
      createdAt: item.createdAt || Date.now(),
      updatedAt: item.updatedAt || Date.now(),
      messages: Array.isArray(item.messages)
        ? item.messages.map((m: any) => ({
            id: m.id,
            sender: m.sender === 'user' ? 'user' : 'agent',
            text: m.text || '',
            timestamp: m.timestamp || ''
          }))
        : []
    }));
  } catch (err) {
    console.warn('[ChatSyncApi] Ngoại lệ khi đồng bộ phiên đám mây:', err);
    return [];
  }
}

export async function deleteUserCloudSession(sessionId: string, username?: string): Promise<boolean> {
  try {
    const url = username
      ? `${API_BASE_URL}/copilot/user-sessions/${encodeURIComponent(sessionId)}?username=${encodeURIComponent(username)}`
      : `${API_BASE_URL}/copilot/user-sessions/${encodeURIComponent(sessionId)}`;

    const res = await apiFetch(url, {
      method: 'DELETE',
      credentials: 'include'
    });

    return res.ok;
  } catch (err) {
    console.warn('[ChatSyncApi] Lỗi xóa phiên trên máy chủ:', err);
    return false;
  }
}

export async function deleteAllUserCloudSessions(username?: string): Promise<boolean> {
  try {
    const url = username
      ? `${API_BASE_URL}/copilot/user-sessions?username=${encodeURIComponent(username)}`
      : `${API_BASE_URL}/copilot/user-sessions`;
    const res = await apiFetch(url, {
      method: 'DELETE',
      credentials: 'include',
    });
    return res.ok;
  } catch (err) {
    console.warn('[ChatSyncApi] Lỗi xóa toàn bộ lịch sử phiên trên máy chủ:', err);
    return false;
  }
}

export async function resetUserSessionWebCache(sessionId: string, username?: string): Promise<boolean> {
  if (!sessionId) return false;
  try {
    const url = username
      ? `${API_BASE_URL}/copilot/user-sessions/${encodeURIComponent(sessionId)}/reset-cache?username=${encodeURIComponent(username)}`
      : `${API_BASE_URL}/copilot/user-sessions/${encodeURIComponent(sessionId)}/reset-cache`;
    const res = await apiFetch(url, {
      method: 'POST',
      credentials: 'include',
    });
    return res.ok;
  } catch {
    return false;
  }
}
