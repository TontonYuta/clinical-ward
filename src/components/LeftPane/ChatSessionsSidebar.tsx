/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Thanh Bên Quản Lý Đa Phiên Hội Thoại & Kho Nguồn Y Văn (ChatGPT / NotebookLM Minimalism)
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Bot,
  SquarePen,
  PanelLeftClose,
  Search,
  Edit3,
  Trash2,
  Check,
  RefreshCw,
  Settings,
  BookOpen,
  FileText,
  X,
} from 'lucide-react';
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

type SessionBucket = 'Hôm nay' | 'Hôm qua' | '7 ngày trước' | '30 ngày trước' | 'Trước đó';

const BUCKET_ORDER: SessionBucket[] = [
  'Hôm nay',
  'Hôm qua',
  '7 ngày trước',
  '30 ngày trước',
  'Trước đó',
];

function getSessionBucket(timestampMs?: number): SessionBucket {
  if (!timestampMs || !Number.isFinite(timestampMs)) return 'Trước đó';
  const now = new Date();
  const target = new Date(timestampMs);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  const dayDiff = Math.round((startOfToday - startOfTarget) / 86400000);
  if (dayDiff <= 0) return 'Hôm nay';
  if (dayDiff === 1) return 'Hôm qua';
  if (dayDiff <= 7) return '7 ngày trước';
  if (dayDiff <= 30) return '30 ngày trước';
  return 'Trước đó';
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
  onOpenSettings,
  onSelectSourceDocument,
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

  const filteredSessions = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const list = q
      ? sessions.filter((s) => s.title.toLowerCase().includes(q))
      : sessions;
    return [...list].sort(
      (a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0)
    );
  }, [sessions, searchQuery]);

  const groupedSessions = useMemo(() => {
    const map = new Map<SessionBucket, ChatSession[]>();
    for (const s of filteredSessions) {
      const bucket = getSessionBucket(s.updatedAt || s.createdAt);
      const existing = map.get(bucket);
      if (existing) existing.push(s);
      else map.set(bucket, [s]);
    }
    return BUCKET_ORDER.filter((b) => (map.get(b)?.length || 0) > 0).map((label) => ({
      label,
      items: map.get(label)!,
    }));
  }, [filteredSessions]);

  const filteredDocs = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return knowledgeDocs;
    return knowledgeDocs.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        (d.legal_basis || '').toLowerCase().includes(q) ||
        (d.category || '').toLowerCase().includes(q)
    );
  }, [knowledgeDocs, searchQuery]);

  if (!isOpen) return null;

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
    <aside className="clinical-prose w-64 sm:w-[272px] h-full bg-[#f9fafb] border-r border-slate-200/80 flex flex-col shrink-0 select-none transition-all duration-200 ease-in-out">
      {/* 1. Header tối giản */}
      <div className="h-12 px-3 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-teal-800 flex items-center justify-center text-white shrink-0">
            <Bot className="w-4 h-4" />
          </div>
          <span className="font-semibold text-[14px] text-slate-900 truncate">
            Trợ Lý Lâm Sàng
          </span>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          {onManualSync && (
            <button
              type="button"
              onClick={onManualSync}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 transition cursor-pointer"
              title={isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ hội thoại'}
              aria-label="Đồng bộ hội thoại"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-teal-700' : ''}`} />
            </button>
          )}
          <button
            type="button"
            onClick={onToggle}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 transition cursor-pointer"
            title="Thu gọn thanh bên"
            aria-label="Thu gọn thanh bên"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Hành động chính & Tìm kiếm gọn gàng */}
      <div className="px-2.5 pb-2.5 space-y-2 shrink-0">
        <button
          type="button"
          onClick={() => {
            setActiveTab('sessions');
            onNewSession();
          }}
          className="w-full py-2 px-3 rounded-xl text-[13.5px] font-medium text-slate-900 bg-white hover:bg-slate-50 border border-slate-200/90 hover:border-slate-300 shadow-2xs transition cursor-pointer active:scale-[0.99] flex items-center gap-2.5"
        >
          <SquarePen className="w-4 h-4 text-teal-700 shrink-0" />
          <span>Cuộc trò chuyện mới</span>
        </button>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={activeTab === 'sources' ? 'Tìm tài liệu y văn...' : 'Tìm kiếm...'}
            className="w-full pl-8 pr-7 py-1.5 text-[13px] text-slate-800 placeholder:text-slate-400 bg-slate-200/55 hover:bg-slate-200/75 focus:bg-white border border-transparent focus:border-slate-300 rounded-lg focus:outline-none transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-700 cursor-pointer"
              aria-label="Xóa từ khóa tìm kiếm"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {onSelectSourceDocument && (
          <div className="grid grid-cols-2 gap-1 pt-0.5 border-b border-slate-200/70 pb-2 text-[12.5px]">
            <button
              type="button"
              onClick={() => setActiveTab('sessions')}
              className={`py-1.5 px-2.5 rounded-lg font-medium transition cursor-pointer text-center ${
                activeTab === 'sessions'
                  ? 'bg-slate-200/80 text-slate-950 font-semibold'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/40'
              }`}
            >
              Đoạn chat
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('sources')}
              className={`py-1.5 px-2.5 rounded-lg font-medium flex items-center justify-center gap-1.5 transition cursor-pointer ${
                activeTab === 'sources'
                  ? 'bg-slate-200/80 text-slate-950 font-semibold'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/40'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 shrink-0" />
              <span>Nguồn ({knowledgeDocs.length || 38})</span>
            </button>
          </div>
        )}
      </div>

      {/* 3. Danh sách Phiên (gom nhóm theo ngày) hoặc Nguồn Y văn */}
      <div className="flex-1 overflow-y-auto px-2 pb-3 thin-scrollbar">
        {activeTab === 'sources' && onSelectSourceDocument ? (
          isLoadingDocs ? (
            <div className="text-center py-8 text-[13px] text-slate-500">Đang tải danh mục y văn...</div>
          ) : filteredDocs.length === 0 ? (
            <div className="text-center py-8 text-[13px] text-slate-500">Không tìm thấy tài liệu phù hợp</div>
          ) : (
            <div className="space-y-1">
              {filteredDocs.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => onSelectSourceDocument(doc)}
                  className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-200/60 transition cursor-pointer flex items-start gap-2.5 group"
                >
                  <FileText className="w-4 h-4 text-slate-400 group-hover:text-teal-700 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-medium text-slate-800 group-hover:text-slate-950 line-clamp-2 leading-snug">
                      {doc.title}
                    </div>
                    {(doc.legal_basis || doc.edition_year) && (
                      <div className="mt-0.5 text-[11.5px] text-slate-500 truncate">
                        {[doc.legal_basis, doc.edition_year].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )
        ) : groupedSessions.length === 0 ? (
          <div className="text-center py-8 text-[13px] text-slate-500">Không có đoạn chat nào phù hợp</div>
        ) : (
          <div className="space-y-4">
            {groupedSessions.map((group) => (
              <div key={group.label}>
                <div className="px-2.5 pb-1.5 text-[11.5px] font-semibold text-slate-500">
                  {group.label}
                </div>
                <div className="space-y-0.5">
                  {group.items.map((s) => {
                    const isActive = s.id === activeSessionId;
                    const isEditing = editingId === s.id;

                    return (
                      <div
                        key={s.id}
                        onClick={() => onSelectSession(s.id)}
                        title={s.title}
                        className={`group relative px-2.5 py-2 rounded-lg text-[13.5px] leading-snug cursor-pointer transition-colors flex items-center ${
                          isActive
                            ? 'bg-slate-200/80 text-slate-950 font-medium'
                            : 'text-slate-700 hover:bg-slate-200/50 hover:text-slate-950'
                        }`}
                      >
                        {isEditing ? (
                          <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="text"
                              value={editTitle}
                              autoFocus
                              onChange={(e) => setEditTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveEditing(e as any, s.id);
                                if (e.key === 'Escape') setEditingId(null);
                              }}
                              className="w-full px-2 py-0.5 text-[13.5px] bg-white border border-slate-300 rounded focus:outline-none focus:border-teal-600"
                            />
                            <button
                              type="button"
                              onClick={(e) => saveEditing(e, s.id)}
                              className="p-1 text-teal-700 hover:bg-teal-50 rounded shrink-0 cursor-pointer"
                              aria-label="Lưu tên phiên"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <span className="truncate flex-1 pr-1">{s.title}</span>
                            <div
                              className={`flex items-center gap-0.5 shrink-0 pl-2 opacity-0 group-hover:opacity-100 transition-opacity ${
                                isActive
                                  ? 'bg-gradient-to-l from-[#e4e8ee] via-[#e4e8ee] to-transparent'
                                  : 'bg-gradient-to-l from-[#edf0f4] via-[#edf0f4] to-transparent'
                              } absolute right-1.5 top-1/2 -translate-y-1/2 rounded-r-lg`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={(e) => startEditing(e, s)}
                                className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-300/60 rounded cursor-pointer"
                                title="Đổi tên"
                                aria-label="Đổi tên"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteSession(s.id);
                                }}
                                className="p-1 text-slate-500 hover:text-rose-600 hover:bg-rose-100/70 rounded cursor-pointer"
                                title="Xóa"
                                aria-label="Xóa"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Footer tối giản */}
      {onOpenSettings && (
        <div className="px-2.5 py-2 border-t border-slate-200/70 shrink-0">
          <button
            type="button"
            data-testid="sidebar-settings-btn"
            onClick={onOpenSettings}
            className="w-full py-2 px-2.5 rounded-lg text-[13px] font-medium text-slate-600 hover:text-slate-950 hover:bg-slate-200/60 transition cursor-pointer flex items-center gap-2.5"
            title="Cài đặt"
          >
            <Settings className="w-4 h-4 text-slate-500 shrink-0" />
            <span>Cài đặt</span>
          </button>
        </div>
      )}
    </aside>
  );
};
