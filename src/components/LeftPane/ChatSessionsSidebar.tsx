/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Thanh Bên Quản Lý Đa Phiên Hội Thoại Kiểu ChatGPT (Chat Sessions Sidebar) (<=160 LOC)
 */

import React, { useEffect, useState } from 'react';
import { Bot, Plus, PanelLeftClose, Search, MessageSquare, Edit3, Trash2, Check, RefreshCw, Settings, BookOpen, FileText } from 'lucide-react';
import { ChatSession } from '../../types/chatSession';
import { getKnowledgeDocumentsApi, type ChatbotAvailability } from '../../services/api';
import type { KnowledgeDocument } from '../../types/documents';

interface ChatSessionsSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  sessions: ChatSession[];
  activeSessionId: string;
  onSelectSession: (sessionId: string) => void;
  onNewSession: () => void;
  onDeleteSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, newTitle: string) => void;
  isSyncing?: boolean;
  onManualSync?: () => void;
  availabilityMode?: ChatbotAvailability['mode'];
  onOpenSettings?: () => void;
  onSelectSourceDocument?: (doc: KnowledgeDocument) => void;
}

export const ChatSessionsSidebar: React.FC<ChatSessionsSidebarProps> = ({
  isOpen,
  onToggle,
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  onRenameSession,
  isSyncing = false,
  onManualSync,
  availabilityMode = 'checking',
  onOpenSettings,
  onSelectSourceDocument
}) => {
  const [activeTab, setActiveTab] = useState<'sources' | 'sessions'>('sessions');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [knowledgeDocs, setKnowledgeDocs] = useState<KnowledgeDocument[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);

  useEffect(() => {
    if (!isOpen || !onSelectSourceDocument || knowledgeDocs.length > 0) return;
    let mounted = true;
    setIsLoadingDocs(true);
    getKnowledgeDocumentsApi()
      .then((docs) => {
        if (mounted) setKnowledgeDocs(docs);
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setIsLoadingDocs(false);
      });
    return () => {
      mounted = false;
    };
  }, [isOpen, onSelectSourceDocument, knowledgeDocs.length]);

  if (!isOpen) return null;

  const filteredSessions = sessions.filter(s =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );
  const filteredDocs = knowledgeDocs.filter(d => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      d.title.toLowerCase().includes(q) ||
      (d.legal_basis || '').toLowerCase().includes(q) ||
      (d.category || '').toLowerCase().includes(q)
    );
  });

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

  return (
    <aside className="w-64 sm:w-72 h-full bg-slate-50 border-r border-slate-200 flex flex-col shrink-0 select-none transition-all duration-200 ease-in-out">
      {/* 1. Header: Trợ Lý AI & Nút Đóng Sidebar */}
      <div className="p-3 border-b border-slate-200/70 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-teal-800 flex items-center justify-center text-white shrink-0 shadow-2xs">
              <Bot className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-bold text-sm text-slate-950 truncate">Trợ Lý AI Lâm Sàng</span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {onManualSync && (
              <button
                type="button"
                onClick={onManualSync}
                className="p-1.5 rounded-lg text-slate-500 hover:text-teal-700 hover:bg-slate-200/70 transition cursor-pointer"
                title={isSyncing ? "Đang đồng bộ đám mây..." : "Đồng bộ đám mây"}
                aria-label="Đồng bộ đám mây"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-teal-600' : ''}`} />
              </button>
            )}
            <button
              type="button"
              onClick={onToggle}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 transition cursor-pointer"
              title="Đóng thanh bên"
              aria-label="Đóng thanh bên"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>
        </div>

        {onSelectSourceDocument && (
          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-200/70 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('sources')}
              className={`py-1.5 px-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                activeTab === 'sources'
                  ? 'bg-white text-teal-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Nguồn ({knowledgeDocs.length || '…'})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('sessions')}
              className={`py-1.5 px-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                activeTab === 'sessions'
                  ? 'bg-white text-teal-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Phiên ({sessions.length})</span>
            </button>
          </div>
        )}

        {activeTab === 'sessions' && (
          <button
            type="button"
            onClick={onNewSession}
            className="w-full py-2 px-3 bg-white hover:bg-slate-100/90 text-slate-800 border border-slate-200 rounded-xl text-xs font-semibold flex items-center justify-between shadow-2xs transition cursor-pointer active:scale-98 group"
          >
            <span className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-teal-700 group-hover:scale-110 transition" />
              <span>Cuộc trò chuyện mới</span>
            </span>
            <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">Ctrl+N</span>
          </button>
        )}

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={activeTab === 'sources' ? 'Tìm nguồn y văn, thông tư...' : 'Tìm kiếm cuộc trò chuyện...'}
            className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-600 focus:border-teal-600 transition"
          />
        </div>
      </div>

      {/* 2. Danh sách Nguồn hoặc Phiên cuộn độc lập */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 thin-scrollbar">
        {activeTab === 'sources' && onSelectSourceDocument ? (
          isLoadingDocs ? (
            <div className="text-center py-8 text-xs text-slate-400">Đang tải danh mục y văn...</div>
          ) : filteredDocs.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400">Không tìm thấy tài liệu phù hợp</div>
          ) : (
            filteredDocs.map((doc) => (
              <button
                key={doc.id}
                type="button"
                onClick={() => onSelectSourceDocument(doc)}
                className="w-full text-left p-2.5 rounded-xl border border-transparent hover:bg-white hover:border-slate-200 hover:shadow-2xs transition cursor-pointer flex items-start gap-2.5 group"
              >
                <div className="w-7 h-7 rounded-lg bg-teal-50 border border-teal-200/70 text-teal-700 flex items-center justify-center shrink-0 mt-0.5">
                  <FileText className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-slate-800 group-hover:text-teal-900 line-clamp-2 leading-snug">
                    {doc.title}
                  </div>
                  <div className="mt-0.5 text-[10px] text-slate-500 flex items-center gap-1.5 truncate">
                    {doc.legal_basis && <span className="font-medium text-teal-700">{doc.legal_basis}</span>}
                    {doc.edition_year ? <span>· {doc.edition_year}</span> : null}
                  </div>
                </div>
              </button>
            ))
          )
        ) : filteredSessions.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400">Không có phiên nào phù hợp</div>
        ) : (
          filteredSessions.map((s) => {
            const isActive = s.id === activeSessionId;
            const isEditing = editingId === s.id;
            const userMsgCount = s.messages.filter(m => m.sender === 'user').length;

            return (
              <div
                key={s.id}
                onClick={() => onSelectSession(s.id)}
                className={`group relative p-2 rounded-xl border text-xs cursor-pointer transition flex items-center justify-between gap-1.5 ${
                  isActive
                    ? 'bg-teal-50 border-teal-200 text-teal-950 font-semibold shadow-2xs'
                    : 'border-transparent hover:bg-slate-200/50 text-slate-700'
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
                      className="w-full px-1.5 py-0.5 text-xs bg-white border border-teal-500 rounded focus:outline-none"
                    />
                  ) : (
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{s.title}</div>
                      <div className="text-[10px] text-slate-400 font-normal flex items-center gap-1">
                        <span>{userMsgCount} tin</span>
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
                        className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-300/60 rounded opacity-0 group-hover:opacity-100 transition"
                        title="Đổi tên"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onDeleteSession(s.id); }}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-100/70 rounded opacity-0 group-hover:opacity-100 transition"
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

      {/* 3. Footer tinh gọn + Nút Cài đặt */}
      <div className="p-2.5 border-t border-slate-200/70 text-[11px] text-slate-500 flex items-center justify-between bg-slate-100/50 gap-2">
        <span className="truncate">Tổng cộng {sessions.length} phiên</span>
        {onOpenSettings ? (
          <button
            type="button"
            onClick={onOpenSettings}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-700 bg-white hover:bg-teal-50 hover:text-teal-800 border border-slate-200 hover:border-teal-300 shadow-2xs transition cursor-pointer active:scale-95 shrink-0"
            title="Cài đặt AI, Web Search & Quản lý lịch sử"
          >
            <Settings className="w-3.5 h-3.5 text-teal-700" />
            <span>Cài đặt</span>
          </button>
        ) : (
          <span className="font-mono text-[10px] text-teal-800 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">AMIE Isolate</span>
        )}
      </div>
    </aside>
  );
};
