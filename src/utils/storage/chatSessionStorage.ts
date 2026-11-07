/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Quản lý Bộ Nhớ Đa Phiên Hội Thoại Lâm Sàng (Multi-Session Storage) (<=160 LOC)
 */

import { ChatSession } from '../../types/chatSession';
import { ChatMessage } from '../../types/clinical';
import { INITIAL_CHAT_MESSAGES } from '../../data/initialData';

const SESSIONS_KEY = 'clinical_chat_sessions_v1';
const ACTIVE_ID_KEY = 'clinical_active_chat_session_id_v1';
const MAX_SESSIONS = 30;

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

export function loadChatSessions(): ChatSession[] {
  if (typeof window === 'undefined') return [createNewSession()];
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    // Migration: nếu có tin nhắn cũ từ clinical_chat_messages
    const legacyRaw = localStorage.getItem('clinical_chat_messages');
    if (legacyRaw) {
      const legacyMsgs = JSON.parse(legacyRaw);
      if (Array.isArray(legacyMsgs) && legacyMsgs.length > 0) {
        const migrated: ChatSession = {
          id: generateSessionId(),
          title: 'Hội thoại trước đó',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messages: legacyMsgs
        };
        saveChatSessions([migrated]);
        return [migrated];
      }
    }
  } catch (err) {
    console.warn('[SessionStorage] Lỗi đọc session:', err);
  }
  const defaultSession = createNewSession();
  saveChatSessions([defaultSession]);
  return [defaultSession];
}

export function saveChatSessions(sessions: ChatSession[]): void {
  if (typeof window === 'undefined') return;
  try {
    const sanitized = sessions.slice(0, MAX_SESSIONS);
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sanitized));
  } catch (err) {
    console.warn('[SessionStorage] Lỗi lưu sessions:', err);
  }
}

export function getActiveSessionId(availableSessions: ChatSession[]): string {
  if (typeof window === 'undefined') return availableSessions[0]?.id || generateSessionId();
  try {
    const saved = localStorage.getItem(ACTIVE_ID_KEY);
    if (saved && availableSessions.some(s => s.id === saved)) return saved;
  } catch (err) {
    console.warn('[SessionStorage] Lỗi đọc activeId:', err);
  }
  const fallback = availableSessions[0]?.id || generateSessionId();
  saveActiveSessionId(fallback);
  return fallback;
}

export function saveActiveSessionId(sessionId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ACTIVE_ID_KEY, sessionId);
  } catch (err) {
    console.warn('[SessionStorage] Lỗi lưu activeId:', err);
  }
}

export function deleteChatSession(
  sessionId: string,
  sessions: ChatSession[]
): { sessions: ChatSession[]; nextActiveId: string } {
  const filtered = sessions.filter(s => s.id !== sessionId);
  if (filtered.length === 0) {
    const fresh = createNewSession();
    saveChatSessions([fresh]);
    saveActiveSessionId(fresh.id);
    return { sessions: [fresh], nextActiveId: fresh.id };
  }
  saveChatSessions(filtered);
  const nextActiveId = filtered[0].id;
  saveActiveSessionId(nextActiveId);
  return { sessions: filtered, nextActiveId };
}

export function renameChatSession(
  sessionId: string,
  newTitle: string,
  sessions: ChatSession[]
): ChatSession[] {
  const updated = sessions.map(s => (s.id === sessionId ? { ...s, title: newTitle.trim() || s.title, updatedAt: Date.now() } : s));
  saveChatSessions(updated);
  return updated;
}
