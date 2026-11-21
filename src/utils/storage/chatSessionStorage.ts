/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Quản lý Bộ Nhớ Đa Phiên Hội Thoại Lâm Sàng (Multi-Session Storage) (<=160 LOC)
 */

import { ChatSession } from '../../types/chatSession';
import { ChatMessage } from '../../types/clinical';
import { INITIAL_CHAT_MESSAGES } from '../../data/initialData';

const LEGACY_SESSIONS_KEY = 'clinical_chat_sessions_v1';
const LEGACY_ACTIVE_ID_KEY = 'clinical_active_chat_session_id_v1';
const MAX_SESSIONS = 30;

export function normalizeUserStorageKey(username?: string): string {
  if (!username || !username.trim()) return 'guest';
  return username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
}

export function getScopedSessionsKey(username?: string): string {
  return `clinical_chat_sessions_${normalizeUserStorageKey(username)}`;
}

export function getScopedActiveIdKey(username?: string): string {
  return `clinical_active_chat_session_id_${normalizeUserStorageKey(username)}`;
}

export function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

export function generateSessionTitle(query: string): string {
  if (!query || !query.trim()) return 'Cuộc trò chuyện mới';
  const clean = query.trim().replace(/\s+/g, ' ');

  // Nhận diện mẫu bệnh nhân
  const bnMatch = clean.match(/(?:bệnh nhân|bn)\s+([A-ZÀ-ỸĐa-zà-ỹđ\s]+?)(?:\s+cần|\s+tiêm|\s+dùng|\s+buồng|\s+khoa|$)/i);
  if (bnMatch && bnMatch[1].trim().length > 1) {
    const pName = bnMatch[1].trim().split(' ').slice(0, 3).join(' ');
    const drugMatch = clean.match(/(?:morphin|fentanyl|adrenalin|diazepam|ceftriaxone|kcl|aspirin|paracetamol)/i);
    return drugMatch ? `BN ${pName} - ${drugMatch[0].toUpperCase()}` : `Bệnh nhân ${pName}`;
  }

  // Nhận diện mẫu thao tác nhanh
  if (/tương tác/i.test(clean)) return clean.length > 35 ? `${clean.substring(0, 32)}...` : clean;
  if (/cận hạn|fefo/i.test(clean)) return 'Kiểm tra FEFO & Hạn dùng';
  if (/hỏng|sự cố/i.test(clean)) return 'Báo cáo sự cố thiết bị';
  if (/giao ban|đối soát/i.test(clean)) return 'Bàn giao ca trực';

  return clean.length > 32 ? `${clean.substring(0, 30)}...` : clean;
}

export function createNewSession(initialTitle?: string): ChatSession {
  return {
    id: generateSessionId(),
    title: initialTitle || 'Cuộc trò chuyện mới',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [...INITIAL_CHAT_MESSAGES]
  };
}

export function loadChatSessions(username?: string): ChatSession[] {
  if (typeof window === 'undefined') return [createNewSession()];
  const scopedKey = getScopedSessionsKey(username);
  try {
    const raw = localStorage.getItem(scopedKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    // Migration: nếu user này chưa có session nhưng có session cũ từ LEGACY_SESSIONS_KEY
    const legacyRaw = localStorage.getItem(LEGACY_SESSIONS_KEY);
    if (legacyRaw) {
      const legacyParsed = JSON.parse(legacyRaw);
      if (Array.isArray(legacyParsed) && legacyParsed.length > 0) {
        saveChatSessions(legacyParsed, username);
        try { localStorage.removeItem(LEGACY_SESSIONS_KEY); } catch {}
        return legacyParsed;
      }
    }
    // Migration: nếu có tin nhắn cũ từ clinical_chat_messages
    const legacyMsgRaw = localStorage.getItem('clinical_chat_messages');
    if (legacyMsgRaw) {
      const legacyMsgs = JSON.parse(legacyMsgRaw);
      if (Array.isArray(legacyMsgs) && legacyMsgs.length > 0) {
        const migrated: ChatSession = {
          id: generateSessionId(),
          title: 'Hội thoại trước đó',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messages: legacyMsgs
        };
        saveChatSessions([migrated], username);
        return [migrated];
      }
    }
  } catch (err) {
    console.warn('[SessionStorage] Lỗi đọc session:', err);
  }
  const defaultSession = createNewSession();
  saveChatSessions([defaultSession], username);
  return [defaultSession];
}

export function saveChatSessions(sessions: ChatSession[], username?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const sanitized = sessions.slice(0, MAX_SESSIONS);
    localStorage.setItem(getScopedSessionsKey(username), JSON.stringify(sanitized));
  } catch (err) {
    console.warn('[SessionStorage] Lỗi lưu sessions:', err);
  }
}

export function getActiveSessionId(availableSessions: ChatSession[], username?: string): string {
  if (typeof window === 'undefined') return availableSessions[0]?.id || generateSessionId();
  try {
    const activeKey = getScopedActiveIdKey(username);
    const saved = localStorage.getItem(activeKey) || localStorage.getItem(LEGACY_ACTIVE_ID_KEY);
    if (saved && availableSessions.some(s => s.id === saved)) return saved;
  } catch (err) {
    console.warn('[SessionStorage] Lỗi đọc activeId:', err);
  }
  const fallback = availableSessions[0]?.id || generateSessionId();
  saveActiveSessionId(fallback, username);
  return fallback;
}

export function saveActiveSessionId(sessionId: string, username?: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(getScopedActiveIdKey(username), sessionId);
  } catch (err) {
    console.warn('[SessionStorage] Lỗi lưu activeId:', err);
  }
}

export function deleteChatSession(
  sessionId: string,
  sessions: ChatSession[],
  username?: string
): { sessions: ChatSession[]; nextActiveId: string } {
  const filtered = sessions.filter(s => s.id !== sessionId);
  if (filtered.length === 0) {
    const fresh = createNewSession();
    saveChatSessions([fresh], username);
    saveActiveSessionId(fresh.id, username);
    return { sessions: [fresh], nextActiveId: fresh.id };
  }
  saveChatSessions(filtered, username);
  const nextActiveId = filtered[0].id;
  saveActiveSessionId(nextActiveId, username);
  return { sessions: filtered, nextActiveId };
}

export function renameChatSession(
  sessionId: string,
  newTitle: string,
  sessions: ChatSession[],
  username?: string
): ChatSession[] {
  const updated = sessions.map(s => (s.id === sessionId ? { ...s, title: newTitle.trim() || s.title, updatedAt: Date.now() } : s));
  saveChatSessions(updated, username);
  return updated;
}

export function clearUserChatStorage(username?: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(getScopedSessionsKey(username));
    localStorage.removeItem(getScopedActiveIdKey(username));
  } catch (err) {
    console.warn('[SessionStorage] Lỗi dọn dẹp scoped storage:', err);
  }
}

/**
 * Ghép hợp thông minh giữa phiên cục bộ (Local) và phiên đám mây (Cloud)
 * Đảm bảo không xung đột, không trùng lặp, bảo toàn tối đa số tin nhắn.
 */
export function mergeSessions(local: ChatSession[], cloud: ChatSession[]): ChatSession[] {
  const map = new Map<string, ChatSession>();

  // 1. Nạp danh sách cloud sessions
  for (const c of cloud) {
    if (c && c.id) {
      map.set(c.id, c);
    }
  }

  // 2. Ghép local sessions vào (nếu local có nhiều tin nhắn hơn hoặc mới hơn, ưu tiên local)
  for (const l of local) {
    if (!l || !l.id) continue;
    const existing = map.get(l.id);
    if (!existing) {
      map.set(l.id, l);
    } else {
      const localMsgCount = Array.isArray(l.messages) ? l.messages.length : 0;
      const cloudMsgCount = Array.isArray(existing.messages) ? existing.messages.length : 0;
      if (localMsgCount >= cloudMsgCount || (l.updatedAt || 0) >= (existing.updatedAt || 0)) {
        map.set(l.id, {
          ...existing,
          ...l,
          messages: localMsgCount >= cloudMsgCount ? l.messages : existing.messages
        });
      }
    }
  }

  // 3. Sắp xếp phiên mới nhất lên đầu, giới hạn tối đa MAX_SESSIONS
  return Array.from(map.values())
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .slice(0, MAX_SESSIONS);
}
