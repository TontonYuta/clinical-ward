/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Ngăn Kéo Quản Lý Đa Phiên Hội Thoại Lâm Sàng (Chat Sessions Drawer) (<=160 LOC)
 */

import React, { useState } from 'react';
import { MessageSquare, Plus, Trash2, Edit3, Check, X, Search, Clock } from 'lucide-react';
import { ChatSession } from '../../types/chatSession';

interface ChatSessionsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: ChatSession[];
  activeSessionId: string;
  onSelectSession: (sessionId: string) => void;
  onNewSession: () => void;
  onDeleteSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, newTitle: string) => void;
}

export const ChatSessionsDrawer: React.FC<ChatSessionsDrawerProps> = ({
  isOpen,
  onClose,
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  onRenameSession
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  if (!isOpen) return null;

  const filteredSessions = sessions.filter(s =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  const startEditing = (e: React.MouseEvent, s: ChatSession) => {
    e.stopPropagation();
    setEditingId(s.id);
    setEditTitle(s.title);
  };

  const saveEditing = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (editTitle.trim()) onRenameSession(id, editTitle.trim());
    setEditingId(null);
  };

  const formatSessionTime = (timestamp: number) => {
    const diffMin = Math.round((Date.now() - timestamp) / 60000);
    if (diffMin < 2) return 'Vừa xong';
    if (diffMin < 60) return `${diffMin} phút trước`;
    const diffHours = Math.round(diffMin / 60);
    if (diffHours < 24) return `${diffHours} giờ trước`;
    return new Date(timestamp).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  };

  return (
    <div className="absolute inset-0 z-30 flex bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-150">
      <div className="w-full sm:w-80 h-full bg-white shadow-2xl flex flex-col border-r border-slate-200">
        {/* 1. Header & Nút Tạo mới */}
        <div className="p-3.5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-sm text-slate-800">
            <Clock className="w-4 h-4 text-teal-700" />
            <span>Lịch sử hội thoại</span>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 border-b border-slate-100 space-y-2">
          <button
            type="button"
            onClick={() => { onNewSession(); onClose(); }}
            className="w-full py-2 px-3 bg-teal-800 hover:bg-teal-900 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition cursor-pointer active:scale-98"
          >
            <Plus className="w-4 h-4" />
            <span>+ Cuộc trò chuyện mới</span>
          </button>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm phiên chat..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-600 focus:bg-white"
            />
          </div>
        </div>

        {/* 2. Danh sách các phiên */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 thin-scrollbar">
          {filteredSessions.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400">Không tìm thấy cuộc trò chuyện nào</div>
          ) : (
            filteredSessions.map((s) => {
              const isActive = s.id === activeSessionId;
              const isEditing = editingId === s.id;
              const userMsgCount = s.messages.filter(m => m.sender === 'user').length;

              return (
                <div
                  key={s.id}
                  onClick={() => { onSelectSession(s.id); onClose(); }}
                  className={`group relative p-2.5 rounded-xl border text-xs cursor-pointer transition flex items-center justify-between gap-2 ${
                    isActive ? 'bg-teal-50/80 border-teal-300 text-teal-950 font-medium' : 'border-transparent hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-teal-700' : 'text-slate-400'}`} />
                    {isEditing ? (
                      <input
                        type="text"
                        value={editTitle}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && saveEditing(e as any, s.id)}
                        className="w-full px-1.5 py-0.5 text-xs bg-white border border-teal-400 rounded focus:outline-none"
                      />
                    ) : (
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold">{s.title}</div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <span>{formatSessionTime(s.updatedAt)}</span>
                          <span>•</span>
                          <span>{userMsgCount} câu hỏi</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {isEditing ? (
                      <button type="button" onClick={(e) => saveEditing(e, s.id)} className="p-1 text-teal-700 hover:bg-teal-100 rounded">
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={(e) => startEditing(e, s)}
                          className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded opacity-0 group-hover:opacity-100 transition"
                          title="Đổi tên"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onDeleteSession(s.id); }}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded opacity-0 group-hover:opacity-100 transition"
                          title="Xóa phiên"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      <div className="flex-1" onClick={onClose} />
    </div>
  );
};
