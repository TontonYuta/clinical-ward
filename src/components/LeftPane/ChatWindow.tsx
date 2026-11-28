/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Khung Cửa Sổ Chatbot Lâm Sàng Tích Hợp AI & Action Cards (<=200 LOC)
 */

import React, { useRef, useEffect, useState } from 'react';
import { Bot, User, X, Maximize2, Minimize2, FileText, History, SquarePen, PanelLeftOpen, PanelRightOpen, PanelRightClose, ZoomIn, Settings, BookOpen, Globe, ArrowRight, ArrowDown, Sparkles, Copy, Check, RotateCcw } from 'lucide-react';
import { ChatMessage, QuickSuggestionChip, UserRole, DashboardTab } from '../../types/clinical';
import { ChatSession } from '../../types/chatSession';
import { ChatSessionsDrawer } from './ChatSessionsDrawer';
import { ChatSessionsSidebar } from './ChatSessionsSidebar';
import { NotebookSourceInspector, ActiveSourceDocument } from './NotebookSourceInspector';
import { RagCitationItem } from '../../types/chat';
import { clinicalAudio } from '../../utils/audio';
import { renderFormattedText } from './ChatMarkdown';
import { CdssAlertBanner } from './Cards/CdssAlertBanner';
import { ChatInputBar } from './ChatInputBar';
import { ChatSettingsModal } from './ChatSettingsModal';
import { ImageLightboxModal } from '../Modals/ImageLightboxModal';
import { PdfViewerModal } from '../Modals/PdfViewerModal';
import { resolvePdfDocumentTarget } from '../../utils/pdfDocumentResolver';
import { buildTextFragmentUrl } from '../../utils/webTextFragment';
import { citationToActiveSourceDoc, resolveAutoSyncedInspectorState } from '../../utils/inspectorAutoSync';
import { extractShortSourceLabel } from '../../utils/citationLabel';
import { CitationSourceList } from './CitationSourceList';
import { ClinicalThinkingIndicator } from './ClinicalThinkingIndicator';
import { ServiceStatusBadge } from './ServiceStatusBadge';
import { removeLegacySourceText, stripWebReferenceTail } from '../../utils/chatAnswerPresentation';
import type { ChatbotAvailability } from '../../services/api';
import type { KnowledgeDocument } from '../../types/documents';

interface ChatWindowProps {
  messages: ChatMessage[]; suggestionChips: QuickSuggestionChip[];
  availabilityMode?: ChatbotAvailability['mode'];
  availabilityInfo?: ChatbotAvailability | null;
  onRefreshAvailability?: () => Promise<void> | void;
  onSendMessage: (text: string, attachment?: any, enableWebSearch?: boolean) => void;
  onStopGenerating?: () => void;
  isProcessing: boolean; isAudioMuted: boolean; onSelectTab?: (tab: DashboardTab) => void;
  currentUserRole?: UserRole; onClose?: () => void; pendingDebtsCount?: number;
  pendingAmpoulesCount?: number; urgentTicketsCount?: number; lowStockCount?: number;
  onExecuteCardAction?: (messageId: string, actionType: string, cardData: any) => void;
  onClearMessages?: () => void; onClearAllHistory?: () => void; onOpenAuditTrail?: () => void; onOpenLegalDocs?: () => void;
  onOpenUserGuide?: () => void; isFullScreen?: boolean; onToggleFullScreen?: () => void;
  sessions?: ChatSession[]; activeSessionId?: string; activeSessionTitle?: string;
  onSelectSession?: (sessionId: string) => void; onNewSession?: () => void;
  onDeleteSession?: (sessionId: string) => void; onRenameSession?: (sessionId: string, newTitle: string) => void;
  isSyncing?: boolean; onManualSync?: () => void;
  isMobileOnly?: boolean; currentUserName?: string; onLogout?: () => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  messages, suggestionChips, availabilityMode = 'checking', availabilityInfo = null, onRefreshAvailability, onSendMessage, onStopGenerating, isProcessing, isAudioMuted, onSelectTab,
  currentUserRole = 'nurse', onClose, pendingDebtsCount = 0, urgentTicketsCount = 0,
  lowStockCount = 0, onExecuteCardAction, onClearMessages, onClearAllHistory, onOpenLegalDocs, onOpenUserGuide,
  isFullScreen = false, onToggleFullScreen,
  sessions, activeSessionId, activeSessionTitle, onSelectSession, onNewSession, onDeleteSession, onRenameSession,
  isSyncing = false, onManualSync,
  isMobileOnly = false, currentUserName, onLogout
}) => {
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const outerContainerRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isUserScrolledUpRef = useRef(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const copyResetTimerRef = useRef<number | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMobileWebSearch, setIsMobileWebSearch] = useState<boolean>(() => {
    try {
      return typeof window !== 'undefined' && localStorage.getItem('copilot_enable_web_search') === 'true';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    const syncWeb = (e: Event) => {
      const detail = (e as CustomEvent<boolean>).detail;
      if (typeof detail === 'boolean') setIsMobileWebSearch(detail);
    };
    window.addEventListener('copilot-web-search-changed', syncWeb);
    return () => window.removeEventListener('copilot-web-search-changed', syncWeb);
  }, []);
  const [isSessionsDrawerOpen, setIsSessionsDrawerOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('clinical_chat_sidebar_open') !== 'false';
    }
    return true;
  });
  const [viewingImage, setViewingImage] = useState<{ url: string; title: string } | null>(null);
  const [activePdfViewer, setActivePdfViewer] = useState<{ url: string; title: string; page?: number; excerpt?: string; section?: string } | null>(null);
  const isNotebookMode = Boolean(isFullScreen && !isMobileOnly);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [inspectedMessageId, setInspectedMessageId] = useState<string | null>(null);
  const [activeInspectorDoc, setActiveInspectorDoc] = useState<ActiveSourceDocument | null>(null);
  const lastAutoSyncedMsgIdRef = useRef<string | null>(null);
  const lastAutoSyncedSessionRef = useRef<string | undefined>(activeSessionId);

  useEffect(() => {
    const decision = resolveAutoSyncedInspectorState({
      messages,
      activeSessionId,
      isInspectorOpen,
      isNotebookMode,
      lastSyncedMsgId: lastAutoSyncedMsgIdRef.current,
      lastSessionId: lastAutoSyncedSessionRef.current,
    });
    lastAutoSyncedMsgIdRef.current = decision.nextSyncedMsgId;
    lastAutoSyncedSessionRef.current = decision.nextSessionId;
    if (decision.shouldUpdate) {
      setInspectedMessageId(decision.inspectedMessageId ?? null);
      setActiveInspectorDoc(decision.activeDocument ?? null);
    }
  }, [messages, activeSessionId, isInspectorOpen, isNotebookMode]);

  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('clinical_chat_sidebar_open', next ? 'true' : 'false');
      }
      return next;
    });
  };

  // Xác định tin nhắn đang được đối chiếu ở Ngăn Phải (ưu tiên tin đã chọn, mặc định tin AI mới nhất có citations)
  const latestCitedMessage = [...messages]
    .reverse()
    .find((m) => m.sender === 'agent' && (m.citations?.length || 0) > 0);
  const inspectedMessage =
    messages.find((m) => m.id === inspectedMessageId && (m.citations?.length || 0) > 0) ||
    latestCitedMessage;
  const inspectorCitations: RagCitationItem[] = inspectedMessage?.citations || [];

  const handleOpenInspectorForMessage = (msgId: string, doc: ActiveSourceDocument | null = null) => {
    setInspectedMessageId(msgId);
    if (latestCitedMessage && !latestCitedMessage.isStreaming) {
      lastAutoSyncedMsgIdRef.current = latestCitedMessage.id;
    }
    if (doc) {
      setActiveInspectorDoc(doc);
    } else {
      const targetMsg = messages.find((m) => m.id === msgId);
      const firstCit = targetMsg?.citations?.[0];
      setActiveInspectorDoc(firstCit ? citationToActiveSourceDoc(firstCit) : null);
    }
    setIsInspectorOpen(true);
    // Tự động thu gọn sidebar trái để chia 50% Chat - 50% PDF đọc rõ ràng
    if (!isMobileOnly) {
      setIsSidebarOpen(false);
    }
  };

  const handleSelectSidebarDocument = (doc: KnowledgeDocument) => {
    setActiveInspectorDoc({
      title: doc.title,
      url: doc.public_url || `/api/v1/pdf/${encodeURIComponent(doc.filename)}`,
      legal_basis: doc.legal_basis,
      document_id: doc.id,
      page: 1,
    });
    setIsInspectorOpen(true);
    if (!isMobileOnly) {
      setIsSidebarOpen(false);
    }
  };

  const handleInlineCitationClick = (msgId: string, citationRef: any) => {
    const msg = messages.find((m) => m.id === msgId);
    const activeCits = msg?.citations || [];
    const matchedCit =
      activeCits.find(
        (c) =>
          (citationRef.index && c.index === citationRef.index) ||
          (citationRef.title && c.title === citationRef.title)
      ) || (activeCits.length > 0 ? activeCits[0] : undefined);

    const rawUrl = citationRef.url || matchedCit?.url;
    const finalPage = citationRef.page || matchedCit?.page || undefined;
    const excerptText = citationRef.excerpt || citationRef.snippet || matchedCit?.excerpt || matchedCit?.snippet;

    // Nguồn Web ngoài (http/https, không phải PDF nội bộ):
    // - Ở chế độ Fullscreen (isNotebookMode): mở tab ở sidebar phải kèm Reader View in đậm 2 tầng
    // - Ở chế độ thu nhỏ (popup) / mobile: mở thẳng tab mới kèm #:~:text= để không làm chật popup
    const isExternalWeb = Boolean(
      rawUrl && (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) && !matchedCit?.document_id
    );
    if (isExternalWeb && !isNotebookMode) {
      window.open(buildTextFragmentUrl(rawUrl, excerptText), '_blank', 'noopener,noreferrer');
      return;
    }

    // Trên desktop: mở ngăn phải NotebookLM (Fullscreen cho cả PDF & Web; Popup cho PDF nội bộ)
    if (!isMobileOnly && (isNotebookMode || onToggleFullScreen)) {
      handleOpenInspectorForMessage(msgId, {
        title: citationRef.title || matchedCit?.source || matchedCit?.title || citationRef.legal_basis || 'Tài liệu y văn',
        url: rawUrl,
        page: finalPage,
        excerpt: excerptText,
        legal_basis: citationRef.legal_basis || matchedCit?.legal_basis,
        section: citationRef.section || matchedCit?.section,
        document_id: matchedCit?.document_id,
        domain: matchedCit?.domain,
        credibility_tier: matchedCit?.credibility_tier,
      });
      if (!isNotebookMode && onToggleFullScreen) {
        onToggleFullScreen();
      }
      return;
    }

    const rawTarget = rawUrl || citationRef.legal_basis || citationRef.title || '/pdf/Duoc_Thu_Quoc_Gia_Viet_Nam.pdf';
    const target = resolvePdfDocumentTarget(rawTarget, finalPage);

    setActivePdfViewer({
      url: target.pdfUrl,
      title: citationRef.title || citationRef.legal_basis || target.documentTitle,
      page: target.pageNumber
    });
  };

  const isStreamingAny = messages.some(m => m.isStreaming);

  useEffect(() => {
    let animId: number;
    if (outerContainerRef.current) {
      outerContainerRef.current.scrollTop = 0;
    }
    if (isStreamingAny) {
      // Khi đang stream token: gom việc cuộn vào requestAnimationFrame để tránh Layout Thrashing 60fps
      if (!isUserScrolledUpRef.current) {
        animId = requestAnimationFrame(() => {
          const container = messagesContainerRef.current;
          if (container) {
            container.scrollTop = container.scrollHeight;
          }
        });
      }
    } else {
      // Khi stream xong hoặc có tin nhắn mới hoàn tất: cuộn mượt dịu dàng trên container tin nhắn
      isUserScrolledUpRef.current = false;
      animId = requestAnimationFrame(() => {
        const container = messagesContainerRef.current;
        if (container) {
          container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
        }
      });
    }
    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [messages, isProcessing, isStreamingAny]);

  const handleContainerScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isUserScrolledUpRef.current = distanceFromBottom > 80;
    setShowScrollToBottom(distanceFromBottom > 180);
  };

  const scrollToBottomSmooth = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    isUserScrolledUpRef.current = false;
    setShowScrollToBottom(false);
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
  };

  useEffect(() => {
    return () => {
      if (copyResetTimerRef.current) window.clearTimeout(copyResetTimerRef.current);
    };
  }, []);

  const handleCopyMessage = async (msgId: string, textToCopy: string) => {
    let copied = false;
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(textToCopy);
        copied = true;
      } catch {
        copied = false;
      }
    }
    if (!copied) {
      try {
        const ta = document.createElement('textarea');
        ta.value = textToCopy;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        copied = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {
        copied = false;
      }
    }
    if (copied) {
      setCopiedMessageId(msgId);
      if (copyResetTimerRef.current) window.clearTimeout(copyResetTimerRef.current);
      copyResetTimerRef.current = window.setTimeout(() => {
        setCopiedMessageId((prev) => (prev === msgId ? null : prev));
      }, 2000);
    }
  };

  const handleChipClick = (chipOrText: string | QuickSuggestionChip) => {
    if (!isAudioMuted) clinicalAudio.playTelegramChime();
    onSendMessage(typeof chipOrText === 'string' ? chipOrText : chipOrText.fullPrompt);
  };

  const handleSend = (text: string, attachment?: any, enableWebSearch?: boolean) => {
    if (!isAudioMuted) clinicalAudio.playTelegramChime();
    onSendMessage(text, attachment, enableWebSearch);
  };

  return (
    <div className={`flex h-full w-full overflow-hidden relative ${isNotebookMode ? 'bg-white' : 'bg-slate-50/70'}`}>
      {/* 0. NotebookLM Left Rail (Sources + Sessions) when Fullscreen */}
      {isFullScreen && (
        <ChatSessionsSidebar
          isOpen={isSidebarOpen}
          onToggle={toggleSidebar}
          sessions={sessions || []}
          activeSessionId={activeSessionId || ''}
          onSelectSession={(id) => onSelectSession?.(id)}
          onNewSession={() => onNewSession?.()}
          onDeleteSession={(id) => onDeleteSession?.(id)}
          onRenameSession={(id, title) => onRenameSession?.(id, title)}
          isSyncing={isSyncing}
          onManualSync={onManualSync}
          availabilityMode={availabilityMode}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onSelectSourceDocument={isNotebookMode ? handleSelectSidebarDocument : undefined}
        />
      )}

      {/* Main Chat Viewport */}
      <div ref={outerContainerRef} className="flex-1 flex flex-col h-full min-h-0 min-w-0 relative overflow-hidden bg-white">
        {/* 1. Header: Popup thu nhỏ & Fullscreen đồng bộ thiết kế tinh gọn */}
        {!isFullScreen ? (
          <div className="h-12 px-3 bg-white border-b border-slate-100 flex items-center justify-between gap-2 shrink-0">
            <div data-testid="chat-window-drag-handle" className="flex items-center gap-2 min-w-0 cursor-grab select-none">
              <div className="w-7 h-7 rounded-lg bg-teal-800 flex items-center justify-center text-white shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <h3 className="clinical-prose text-[14px] font-semibold text-slate-900 truncate">
                {activeSessionTitle && activeSessionTitle !== 'Cuộc trò chuyện mới'
                  ? activeSessionTitle
                  : 'Trợ Lý Lâm Sàng'}
              </h3>
            </div>

            <div className="flex items-center gap-0.5 shrink-0">
              <ServiceStatusBadge
                availabilityMode={availabilityMode}
                availabilityInfo={availabilityInfo}
                onRefresh={onRefreshAvailability}
                align="right"
              />
              {onNewSession && (
                <button
                  type="button"
                  onClick={onNewSession}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer active:scale-95 shrink-0"
                  title="Cuộc trò chuyện mới"
                  aria-label="Cuộc trò chuyện mới"
                >
                  <SquarePen className="w-4 h-4" />
                </button>
              )}
              {sessions && sessions.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsSessionsDrawerOpen(true)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer active:scale-95 shrink-0"
                  title={`Lịch sử (${sessions.length} phiên)`}
                  aria-label="Lịch sử các phiên hội thoại"
                >
                  <History className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer active:scale-95 shrink-0"
                title="Cài đặt"
                aria-label="Cài đặt"
              >
                <Settings className="w-4 h-4" />
              </button>
              {!isMobileOnly && onToggleFullScreen && (
                <button type="button" onClick={onToggleFullScreen} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer active:scale-95 shrink-0" title="Toàn màn hình" aria-label="Toàn màn hình">
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              )}
              {!isMobileOnly && onClose && (
                <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer active:scale-95 shrink-0" title="Đóng Trợ lý AI" aria-label="Đóng Trợ lý AI">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Top Bar mảnh thống nhất kiểu NotebookLM cho chế độ Fullscreen */
          <header className="h-12 px-3 sm:px-4 bg-white/95 backdrop-blur-xs border-b border-slate-200/80 flex items-center justify-between gap-3 shrink-0 z-10">
            <div className="flex items-center gap-2 min-w-0">
              {!isSidebarOpen && (
                <button
                  type="button"
                  onClick={toggleSidebar}
                  className="p-1.5 rounded-lg text-slate-600 hover:text-teal-800 hover:bg-slate-100 transition cursor-pointer shrink-0"
                  title="Mở ngăn nguồn & phiên"
                  aria-label="Mở thanh bên"
                >
                  <PanelLeftOpen className="w-4 h-4" />
                </button>
              )}
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-semibold text-slate-900 truncate max-w-[220px] sm:max-w-[380px]">
                  {activeSessionTitle || 'Không gian Tra cứu Y văn'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <ServiceStatusBadge
                availabilityMode={availabilityMode}
                availabilityInfo={availabilityInfo}
                onRefresh={onRefreshAvailability}
                align="right"
              />
              {!isSidebarOpen && (
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(true)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
                  title="Cài đặt"
                  aria-label="Cài đặt"
                >
                  <Settings className="w-4 h-4" />
                </button>
              )}
              {onToggleFullScreen && (
                <button
                  type="button"
                  onClick={onToggleFullScreen}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-teal-700 hover:bg-slate-100 transition cursor-pointer"
                  title="Thu nhỏ cửa sổ"
                  aria-label="Thu nhỏ cửa sổ"
                >
                  <Minimize2 className="w-4 h-4" />
                </button>
              )}
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                  title="Đóng Trợ lý AI"
                  aria-label="Đóng Trợ lý AI"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </header>
        )}

      {/* 2. Messages Stream */}
      <div
        ref={messagesContainerRef}
        onScroll={handleContainerScroll}
        className={`flex-1 min-h-0 overflow-y-auto ${
          isNotebookMode
            ? isInspectorOpen
              ? 'px-4 sm:px-6 pt-5 pb-12'
              : 'px-5 sm:px-8 lg:px-10 pt-5 pb-12'
            : 'p-3.5 sm:p-5 pb-8'
        } ${isFullScreen && !isNotebookMode ? 'pt-14 sm:pt-16' : ''}`}
      >
        <div className={`${
          isNotebookMode
            ? isInspectorOpen
              ? 'w-full max-w-4xl mx-auto space-y-6'
              : 'w-full max-w-5xl mx-auto space-y-6'
            : isFullScreen
            ? 'w-full max-w-5xl mx-auto px-2 sm:px-6 space-y-4'
            : 'w-full space-y-4'
        }`}>
          {/* Empty Workspace Header cho cả Fullscreen và Popup thu nhỏ */}
          {!messages.some((m) => m.sender === 'user') && (
            isNotebookMode ? (
              <div className="rounded-2xl bg-white border border-slate-200/80 p-5 sm:p-6 shadow-2xs space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-teal-800 text-white flex items-center justify-center shrink-0">
                    <Sparkles className="w-4.5 h-4.5" />
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-base sm:text-lg font-bold text-slate-900">
                      Không gian Nghiên cứu & Tra cứu Dược Lâm Sàng
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                      Mọi câu trả lời đều đối soát trực tiếp từ Dược thư Quốc gia 2022, Danh mục QĐ 5948 và các Thông tư Bộ Y Tế. Chọn một tình huống mẫu hoặc đặt câu hỏi bên dưới:
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(suggestionChips.length > 0
                    ? suggestionChips.slice(0, 4).map((c) => ({ label: c.label, prompt: c.fullPrompt }))
                    : [
                        { label: 'Chống chỉ định & chỉnh liều Paracetamol ở người suy gan', prompt: 'Paracetamol dùng cho người suy gan cần lưu ý và chỉnh liều như thế nào theo Dược thư Quốc gia?' },
                        { label: 'Kiểm tra tương tác Warfarin và Ciprofloxacin', prompt: 'Phối hợp Warfarin và Ciprofloxacin có tương tác gì nghiêm trọng không?' },
                        { label: 'Phác đồ xử trí phản vệ theo Thông tư 51/2017/TT-BYT', prompt: 'Phác đồ cấp cứu phản vệ bằng Adrenalin theo Thông tư 51/2017/TT-BYT' },
                        { label: 'Quy định tủ trực cấp cứu theo Thông tư 22/TT-BYT', prompt: 'Quy định về tủ trực cấp cứu tại khoa lâm sàng theo Thông tư 22/TT-BYT' },
                      ]
                  ).map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleChipClick(item.prompt)}
                      className="text-left p-3 rounded-xl bg-slate-50/70 hover:bg-teal-50/70 border border-slate-200/80 hover:border-teal-300 transition cursor-pointer group flex items-center justify-between gap-2"
                    >
                      <span className="text-xs font-medium text-slate-700 group-hover:text-teal-900 line-clamp-2">
                        {item.label}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-teal-700 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="clinical-prose pt-6 pb-2 space-y-5">
                <div className="space-y-1.5">
                  <h2 className="text-[16px] font-semibold text-slate-950">
                    Tra cứu nhanh dược lâm sàng
                  </h2>
                  <p className="text-[13.5px] text-slate-500 leading-relaxed">
                    Đối soát Dược thư Quốc gia, QĐ 5948 và các Thông tư Bộ Y tế.
                  </p>
                </div>
                <div className="space-y-1.5">
                  {[
                    { label: 'Chống chỉ định Paracetamol ở người suy gan', prompt: 'Paracetamol dùng cho người suy gan cần lưu ý và chỉnh liều như thế nào theo Dược thư Quốc gia?' },
                    { label: 'Tương tác Warfarin và Ciprofloxacin', prompt: 'Phối hợp Warfarin và Ciprofloxacin có tương tác gì nghiêm trọng không?' },
                    { label: 'Phác đồ cấp cứu phản vệ TT 51/2017', prompt: 'Phác đồ cấp cứu phản vệ bằng Adrenalin theo Thông tư 51/2017/TT-BYT' },
                  ].map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleChipClick(item.prompt)}
                      className="w-full text-left px-3 py-2.5 rounded-xl bg-slate-50/80 hover:bg-slate-100/90 border border-slate-200/75 hover:border-slate-300 transition cursor-pointer group flex items-center justify-between gap-2"
                    >
                      <span className="text-[13px] font-medium text-slate-700 group-hover:text-slate-950">
                        {item.label}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )
          )}

          {messages.map((msg, msgIndex) => {
          const isAgent = msg.sender === 'agent';
          const isSystem = msg.sender === 'system';
          const isUser = msg.sender === 'user';
          const isRightAligned = isUser || isSystem;
          const precedingUserMsg = isAgent
            ? [...messages.slice(0, msgIndex)].reverse().find((m) => m.sender === 'user')
            : undefined;
          const activeCitations: RagCitationItem[] = msg.citations || [];
          const isWebSearch =
            msg.answerType === 'grounded_web_reference' ||
            msg.intent === 'GROUNDED_WEB_SEARCH' ||
            (activeCitations.length > 0 && activeCitations.every(c => Boolean(c.url?.startsWith('http')) && !c.document_id));
          const rawDisplayText = isAgent ? removeLegacySourceText(msg.text, true) : msg.text;
          const displayText = isAgent && isWebSearch && activeCitations.length > 0
            ? stripWebReferenceTail(rawDisplayText)
            : rawDisplayText;
          // Ẩn tin nhắn chào mặc định rời rạc khi đang ở Empty State
          if (!messages.some((m) => m.sender === 'user') && isAgent && activeCitations.length === 0) {
            return null;
          }

          return (
            <div
              key={msg.id}
              data-testid={`chat-message-${msg.sender}`}
              className={`flex gap-3 w-full ${
                isRightAligned
                  ? 'justify-end'
                  : 'max-w-full'
              } animate-in fade-in slide-in-from-bottom-2 duration-200`}
            >
              <div className={`space-y-2 min-w-0 ${isRightAligned ? 'w-fit max-w-[86%] sm:max-w-[78%]' : 'flex-1 max-w-full'}`}>
                {msg.cdssAlert && (
                  <div>
                    <CdssAlertBanner
                      alert={msg.cdssAlert}
                      onSubstitute={(drug) =>
                        handleChipClick(`Thay thế bằng ${drug} và kiểm tra lại an toàn đơn thuốc`)
                      }
                    />
                  </div>
                )}
                <div className={`${
                  isUser
                    ? isNotebookMode
                      ? 'px-4 py-2.5 rounded-2xl rounded-tr-sm bg-slate-100/95 text-slate-900 text-sm sm:text-[15px] leading-relaxed'
                      : 'px-3.5 py-2 rounded-2xl rounded-tr-sm bg-slate-100/95 text-slate-900 text-[14px] leading-relaxed'
                    : isSystem
                    ? 'p-3 rounded-xl bg-slate-100 border border-slate-200 text-slate-800 text-sm'
                    : isNotebookMode
                    ? 'py-0.5 text-slate-800 text-[15px] sm:text-[15.5px] leading-[1.7] clinical-prose'
                    : 'py-0.5 text-slate-800 text-[14.5px] leading-[1.68] clinical-prose'
                } break-words space-y-2`}>
                      {/* Hiển thị ảnh đính kèm nếu có trong tin nhắn */}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2">
                          {msg.attachments.map((att, attIdx) => {
                            if (att.type === 'image' && (att.url || att.imageBase64)) {
                              const imgSrc = att.url || att.imageBase64;
                              return (
                                <div
                                  key={`att-${msg.id}-${attIdx}`}
                                  className="rounded-lg overflow-hidden border border-teal-300 bg-white/80 max-w-[220px] shadow-2xs group/att"
                                >
                                  <div
                                    onClick={() => {
                                      if (isNotebookMode) {
                                        handleOpenInspectorForMessage(msg.id, { title: att.title || 'Ảnh đơn thuốc', imageUrl: imgSrc });
                                      } else {
                                        setViewingImage({ url: imgSrc, title: att.title || 'Ảnh đơn thuốc / tài liệu' });
                                      }
                                    }}
                                    className="block cursor-zoom-in relative overflow-hidden bg-slate-900/5"
                                    title="Nhấp vào để phóng to kiểm tra ảnh chi tiết"
                                  >
                                    <img
                                      src={imgSrc}
                                      alt={att.title || 'Ảnh đính kèm'}
                                      className="max-h-36 w-auto object-contain rounded-t group-hover/att:scale-102 transition duration-150"
                                    />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/att:opacity-100 transition flex items-center justify-center gap-1 text-white text-xs font-bold drop-shadow">
                                      <ZoomIn className="w-4 h-4" />
                                      <span>Phóng to</span>
                                    </div>
                                  </div>
                                  <div 
                                    onClick={() => setViewingImage({ url: imgSrc, title: att.title || 'Ảnh đơn thuốc / tài liệu' })}
                                    className="px-2 py-1 text-3xs font-semibold text-slate-700 bg-teal-50/50 border-t border-teal-200 truncate flex items-center justify-between cursor-pointer hover:bg-teal-100/60 transition"
                                    title="Nhấp để xem ảnh đầy đủ"
                                  >
                                    <div className="truncate flex items-center gap-1">
                                      <span>📷</span>
                                      <span className="truncate">{att.title || 'Ảnh đơn thuốc'}</span>
                                    </div>
                                    <span className="text-teal-700 text-3xs shrink-0 font-bold ml-1">Xem</span>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          })}
                        </div>
                      )}

                      {msg.isStreaming && !msg.text ? (
                        <ClinicalThinkingIndicator
                          isWebSearch={isMobileWebSearch}
                          query={precedingUserMsg?.text}
                        />
                      ) : (
                        <>
                          {renderFormattedText(displayText, {
                            isDark: false,
                            hideInlineSources: false,
                            citations: activeCitations,
                            onCitationClick: (ref) => handleInlineCitationClick(msg.id, ref),
                          })}
                          {msg.isStreaming && <span className="inline-block w-2 h-4 ml-1 bg-teal-600 animate-pulse align-middle" />}
                        </>
                      )}
                      {isAgent && !msg.isStreaming && activeCitations.length > 0 && (() => {
                        const hasOnlyWebCitations = activeCitations.every(
                          (c) => Boolean(c.url && (c.url.startsWith('http://') || c.url.startsWith('https://')) && !c.document_id)
                        );
                        if (isNotebookMode) {
                          const isWebFooter = isWebSearch || hasOnlyWebCitations;
                          const uniqueLabels = Array.from(
                            new Set(activeCitations.map((c, idx) => extractShortSourceLabel(c, idx + 1)))
                          );
                          const previewLabels = uniqueLabels.slice(0, 3).join(', ');
                          const extraLabels = uniqueLabels.length > 3 ? ` +${uniqueLabels.length - 3}` : '';
                          return (
                            <div className="pt-1.5">
                              <button
                                type="button"
                                data-testid={isWebFooter ? 'web-citation-summary-btn' : 'pdf-citation-summary-btn'}
                                onClick={() => handleOpenInspectorForMessage(msg.id, null)}
                                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition cursor-pointer ${
                                  isInspectorOpen && inspectedMessage?.id === msg.id
                                    ? 'bg-teal-50/90 text-teal-900 border-teal-300'
                                    : 'bg-slate-50/90 text-slate-600 border-slate-200/90 hover:bg-slate-100/80 hover:text-slate-900 hover:border-slate-300'
                                }`}
                              >
                                {isWebFooter ? (
                                  <Globe className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                ) : (
                                  <BookOpen className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                                )}
                                <span className="truncate max-w-[280px] sm:max-w-[420px]">
                                  <strong className="font-semibold text-slate-800">{activeCitations.length} nguồn</strong>
                                  {' · '}
                                  {previewLabels}
                                  {extraLabels}
                                </span>
                                <span className="text-teal-700 font-semibold shrink-0 whitespace-nowrap">Xem đối chiếu →</span>
                              </button>
                            </div>
                          );
                        }
                        return (
                          <CitationSourceList
                            citations={activeCitations}
                            isWebSearch={isWebSearch || hasOnlyWebCitations}
                            openWebInSidebar={isNotebookMode}
                            onCitationClick={(citation) => handleInlineCitationClick(msg.id, citation)}
                          />
                        );
                      })()}

                  {isAgent && msg.card && msg.card.primaryActionLabel && !['borrow_confirm', 'incident_confirm', 'debt_settle', 'equipment_ticket', 'medication_safety'].includes((msg.card as any).card_type || (msg.card as any).type || '') && (
                    <div className={isNotebookMode
                      ? 'mt-2 px-3.5 py-2.5 rounded-xl bg-white border border-slate-200/80 flex items-center justify-between gap-3'
                      : 'mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2'
                    }>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-800 truncate">{msg.card.title}</p>
                        {msg.card.summary && <p className="text-[11px] text-slate-500 truncate">{msg.card.summary}</p>}
                      </div>
                      {isMobileOnly ? (
                        <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 shrink-0">
                          Xem trên máy tính
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onExecuteCardAction?.(
                            msg.id,
                            msg.card?.primaryActionType || 'NAVIGATE',
                            { ...(msg.card?.data || {}), target_tab: msg.card?.targetTab || msg.card?.data?.targetTab }
                          )}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-teal-800 hover:bg-teal-900 text-white shadow-2xs hover:shadow transition flex items-center gap-1.5 cursor-pointer active:scale-95 shrink-0"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>{msg.card.primaryActionLabel}</span>
                        </button>
                      )}
                    </div>
                  )}
                  {isAgent && msg.suggestedChips && msg.suggestedChips.length > 0 && (
                    <div className="pt-1.5 flex flex-wrap items-center gap-1.5">
                      {Array.from(new Set(msg.suggestedChips.filter(c => c && c.trim().length >= 4))).map((chip, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleChipClick(chip)}
                          className="px-3 py-1 rounded-full text-xs font-medium bg-white text-slate-600 hover:text-slate-950 hover:bg-slate-50 border border-slate-200/90 hover:border-slate-300 transition cursor-pointer text-left"
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                  )}

                  {isAgent && msg.answerType === 'safe_abstention' && (
                    <div role="status" className="mt-2 border-l-2 border-amber-400 bg-amber-50/70 px-3.5 py-2 rounded-r-lg text-xs sm:text-[13.5px] text-amber-950 leading-relaxed">
                      Chưa đủ căn cứ trong nguồn đang tra cứu để kết luận. Hãy đối chiếu tài liệu gốc hoặc nhờ dược sĩ lâm sàng xác minh trước khi áp dụng.
                    </div>
                  )}

                  {isAgent && !msg.isStreaming && precedingUserMsg && displayText.trim().length > 0 && (
                    <div className="pt-1 flex items-center gap-0.5 text-slate-400">
                      <button
                        type="button"
                        data-testid="chat-copy-btn"
                        onClick={() => void handleCopyMessage(msg.id, displayText)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer active:scale-95"
                        title={copiedMessageId === msg.id ? 'Đã sao chép' : 'Sao chép câu trả lời'}
                        aria-label={copiedMessageId === msg.id ? 'Đã sao chép' : 'Sao chép câu trả lời'}
                      >
                        {copiedMessageId === msg.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <button
                        type="button"
                        data-testid="chat-regenerate-btn"
                        disabled={isProcessing}
                        onClick={() => handleSend(precedingUserMsg.text, undefined, isWebSearch)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-40 transition-colors cursor-pointer active:scale-95 disabled:cursor-not-allowed"
                        title="Tạo lại câu trả lời"
                        aria-label="Tạo lại câu trả lời"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        <div ref={chatBottomRef} />
        </div>
      </div>

      {/* 3. Input Area + Floating Scroll-to-Bottom Button */}
      <div className={`relative ${isNotebookMode ? 'bg-gradient-to-t from-white via-white to-transparent pt-2 pb-3 shrink-0' : 'bg-white border-t border-slate-200 shrink-0'}`}>
        {showScrollToBottom && (
          <button
            type="button"
            data-testid="chat-scroll-bottom-btn"
            onClick={scrollToBottomSmooth}
            className="absolute -top-11 left-1/2 -translate-x-1/2 z-20 w-8 h-8 rounded-full bg-white/95 border border-slate-200/90 text-slate-600 hover:text-slate-950 hover:border-slate-300 shadow-md flex items-center justify-center transition cursor-pointer active:scale-95"
            title="Cuộn xuống cuối"
            aria-label="Cuộn xuống cuối"
          >
            <ArrowDown className="w-4 h-4" />
          </button>
        )}
        <div className={
          isNotebookMode
            ? isInspectorOpen
              ? 'w-full max-w-4xl mx-auto px-4 sm:px-6'
              : 'w-full max-w-5xl mx-auto px-5 sm:px-8 lg:px-10'
            : isFullScreen
            ? 'w-full max-w-5xl mx-auto px-2 sm:px-6'
            : 'w-full'
        }>
          <ChatInputBar
            onSendMessage={handleSend}
            onStopGenerating={onStopGenerating}
            suggestionChips={suggestionChips}
            isProcessing={isProcessing}
            isAudioMuted={isAudioMuted}
            onChipClick={handleChipClick}
            compact={!isFullScreen}
          />
        </div>
      </div>

      {/* 4. Settings Modal */}
      <ChatSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        availabilityMode={availabilityMode}
        onClearMessages={onClearMessages}
        onClearAllHistory={onClearAllHistory}
        currentUserName={currentUserName}
        onLogout={onLogout}
      />

      {/* 5. Multi-Session History Drawer for compact popup mode */}
      {!isFullScreen && (
        <ChatSessionsDrawer
          isOpen={isSessionsDrawerOpen}
          onClose={() => setIsSessionsDrawerOpen(false)}
          sessions={sessions || []}
          activeSessionId={activeSessionId || ''}
          onSelectSession={(id) => onSelectSession?.(id)}
          onNewSession={() => onNewSession?.()}
          onDeleteSession={(id) => onDeleteSession?.(id)}
          onRenameSession={(id, title) => onRenameSession?.(id, title)}
          isSyncing={isSyncing}
          onManualSync={onManualSync}
        />
      )}

      {/* 6. Lightbox Modal xem chi tiết ảnh đính kèm */}
      {viewingImage && (
        <ImageLightboxModal
          isOpen={!!viewingImage}
          onClose={() => setViewingImage(null)}
          imageUrl={viewingImage.url}
          title={viewingImage.title}
          subtitle="Dùng chuột kéo để di chuyển khi phóng to • Bấm phím Esc hoặc click ra ngoài để đóng"
        />
      )}

      {/* 7. PDF Viewer Modal xem tài liệu y văn đối chứng chuẩn xác số trang */}
      {activePdfViewer && (
        <PdfViewerModal
          isOpen={!!activePdfViewer}
          onClose={() => setActivePdfViewer(null)}
          pdfUrl={activePdfViewer.url}
          title={activePdfViewer.title}
          pageNumber={activePdfViewer.page}
          highlightText={activePdfViewer.excerpt}
          citationTitle={activePdfViewer.title}
          citationSection={activePdfViewer.section}
        />
      )}
    </div>

    {/* 8. NotebookLM Right Pane: Source & Document Inspector */}
    {isNotebookMode && (
      <NotebookSourceInspector
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
        citations={inspectorCitations}
        activeDocument={activeInspectorDoc}
        onSelectDocument={setActiveInspectorDoc}
        messageQuery={
          inspectedMessage
            ? messages[Math.max(0, messages.findIndex((m) => m.id === inspectedMessage.id) - 1)]?.text
            : undefined
        }
        onOpenFullModal={(doc) => {
          setActivePdfViewer({
            url: doc.url || doc.legal_basis || doc.title,
            title: doc.title,
            page: doc.page || undefined,
            excerpt: doc.excerpt,
            section: doc.section,
          });
        }}
        onOpenImageModal={(url, title) => setViewingImage({ url, title })}
      />
    )}
  </div>
);
};
