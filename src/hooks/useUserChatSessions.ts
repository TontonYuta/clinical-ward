/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Hook Quản lý Phiên Hội Thoại Phân Tách Theo Tài Khoản (User-Scoped Chat Sessions Hook)
 * Đảm bảo mỗi tài khoản (bác sĩ, điều dưỡng, admin) sở hữu không gian lịch sử trò chuyện độc lập.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ChatSession } from '../types/chatSession';
import { ChatMessage } from '../types/clinical';
import { INITIAL_CHAT_MESSAGES } from '../data/initialData';
import {
  loadChatSessions,
  saveChatSessions,
  getActiveSessionId,
  saveActiveSessionId,
  createNewSession,
  deleteChatSession,
  renameChatSession
} from '../utils/storage/chatSessionStorage';

export interface UseUserChatSessionsReturn {
  chatSessions: ChatSession[];
  setChatSessions: React.Dispatch<React.SetStateAction<ChatSession[]>>;
  activeChatSessionId: string;
  activeSession: ChatSession;
  chatMessages: ChatMessage[];
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  handleNewSession: () => void;
  handleSelectSession: (sessionId: string) => void;
  handleDeleteSession: (sessionId: string) => void;
  handleRenameSession: (sessionId: string, newTitle: string) => void;
  handleClearCurrentMessages: () => void;
}

export function useUserChatSessions(authenticatedUsername?: string): UseUserChatSessionsReturn {
  const [chatSessions, setChatSessions] = useState<ChatSession[]>(() =>
    loadChatSessions(authenticatedUsername)
  );
  const [activeChatSessionId, setActiveChatSessionId] = useState<string>(() =>
    getActiveSessionId(chatSessions, authenticatedUsername)
  );

  // 1. Đồng bộ khi chuyển đổi người dùng (login, logout, switch account)
  useEffect(() => {
    const nextSessions = loadChatSessions(authenticatedUsername);
    const nextActiveId = getActiveSessionId(nextSessions, authenticatedUsername);
    setChatSessions(nextSessions);
    setActiveChatSessionId(nextActiveId);
  }, [authenticatedUsername]);

  // 2. Tự động lưu bền vững theo tài khoản (chặn ghi I/O khi đang streaming)
  useEffect(() => {
    if (chatSessions.some(s => s.messages.some(m => m.isStreaming))) return;
    saveChatSessions(chatSessions, authenticatedUsername);
  }, [chatSessions, authenticatedUsername]);

  // 3. Lấy phiên hiện hành
  const activeSession = useMemo(() => {
    return (
      chatSessions.find(s => s.id === activeChatSessionId) ||
      chatSessions[0] ||
      createNewSession()
    );
  }, [chatSessions, activeChatSessionId]);

  const chatMessages = activeSession.messages;

  // 4. Cập nhật tin nhắn trong phiên hiện hành
  const setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>> = useCallback(
    (action) => {
      setChatSessions(prevSessions => {
        const targetId = activeChatSessionId;
        return prevSessions.map(sess => {
          if (sess.id !== targetId) return sess;
          const newMessages =
            typeof action === 'function' ? (action as any)(sess.messages) : action;
          return {
            ...sess,
            messages: newMessages,
            updatedAt: Date.now()
          };
        });
      });
    },
    [activeChatSessionId]
  );

  // 5. Thao tác phiên
  const handleNewSession = useCallback(() => {
    const fresh = createNewSession();
    setChatSessions(prev => {
      const next = [fresh, ...prev];
      saveChatSessions(next, authenticatedUsername);
      return next;
    });
    setActiveChatSessionId(fresh.id);
    saveActiveSessionId(fresh.id, authenticatedUsername);
  }, [authenticatedUsername]);

  const handleSelectSession = useCallback(
    (sessionId: string) => {
      setActiveChatSessionId(sessionId);
      saveActiveSessionId(sessionId, authenticatedUsername);
    },
    [authenticatedUsername]
  );

  const handleDeleteSession = useCallback(
    (sessionId: string) => {
      setChatSessions(prev => {
        const res = deleteChatSession(sessionId, prev, authenticatedUsername);
        setActiveChatSessionId(res.nextActiveId);
        return res.sessions;
      });
    },
    [authenticatedUsername]
  );

  const handleRenameSession = useCallback(
    (sessionId: string, newTitle: string) => {
      setChatSessions(prev => {
        const updated = renameChatSession(sessionId, newTitle, prev, authenticatedUsername);
        return updated;
      });
    },
    [authenticatedUsername]
  );

  const handleClearCurrentMessages = useCallback(() => {
    setChatMessages(INITIAL_CHAT_MESSAGES);
  }, [setChatMessages]);

  return {
    chatSessions,
    setChatSessions,
    activeChatSessionId,
    activeSession,
    chatMessages,
    setChatMessages,
    handleNewSession,
    handleSelectSession,
    handleDeleteSession,
    handleRenameSession,
    handleClearCurrentMessages
  };
}
