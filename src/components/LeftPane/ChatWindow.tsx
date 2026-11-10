/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Khung Cửa Sổ Chatbot Lâm Sàng Tích Hợp AI & Action Cards (<=200 LOC)
 */

import React, { useRef, useEffect, useState } from 'react';
import { Bot, User, X, ShieldCheck, RotateCcw, Maximize2, Minimize2, BookOpen, ExternalLink, ChevronDown, ChevronRight, FileText, History, Plus, PanelLeftOpen, PanelLeftClose } from 'lucide-react';
import { ChatMessage, QuickSuggestionChip, UserRole, DashboardTab } from '../../types/clinical';
import { ChatSession } from '../../types/chatSession';
import { ChatSessionsDrawer } from './ChatSessionsDrawer';
import { ChatSessionsSidebar } from './ChatSessionsSidebar';
import { RagCitationItem } from '../../types/chat';
import { clinicalAudio } from '../../utils/audio';
import { renderFormattedText } from './ChatMarkdown';
import { CdssAlertBanner } from './Cards/CdssAlertBanner';
import { ChatInputBar } from './ChatInputBar';
import { ChatSettingsModal } from './ChatSettingsModal';
import { isCloudAIAvailable } from '../../services/geminiService';
import { removeLegacySourceText, formatCitationLabel } from '../../utils/chatAnswerPresentation';

interface ChatWindowProps {
  messages: ChatMessage[]; suggestionChips: QuickSuggestionChip[];
  onSendMessage: (text: string, attachment?: any) => void;
  isProcessing: boolean; isAudioMuted: boolean; onSelectTab?: (tab: DashboardTab) => void;
  currentUserRole?: UserRole; onClose?: () => void; pendingDebtsCount?: number;
  pendingAmpoulesCount?: number; urgentTicketsCount?: number; lowStockCount?: number;
  onExecuteCardAction?: (messageId: string, actionType: string, cardData: any) => void;
  onClearMessages?: () => void; onOpenAuditTrail?: () => void; onOpenLegalDocs?: () => void;
  onOpenUserGuide?: () => void; isFullScreen?: boolean; onToggleFullScreen?: () => void;
  sessions?: ChatSession[]; activeSessionId?: string; activeSessionTitle?: string;
  onSelectSession?: (sessionId: string) => void; onNewSession?: () => void;
  onDeleteSession?: (sessionId: string) => void; onRenameSession?: (sessionId: string, newTitle: string) => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  messages, suggestionChips, onSendMessage, isProcessing, isAudioMuted, onSelectTab,
  currentUserRole = 'nurse', onClose, pendingDebtsCount = 0, urgentTicketsCount = 0,
  lowStockCount = 0, onExecuteCardAction, onClearMessages, onOpenLegalDocs, onOpenUserGuide,
  isFullScreen = false, onToggleFullScreen,
  sessions, activeSessionId, activeSessionTitle, onSelectSession, onNewSession, onDeleteSession, onRenameSession
}) => {
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const outerContainerRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isUserScrolledUpRef = useRef(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSessionsDrawerOpen, setIsSessionsDrawerOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('clinical_chat_sidebar_open') !== 'false';
    }
    return true;
  });
  const [cloudActive, setCloudActive] = useState(isCloudAIAvailable());

  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('clinical_chat_sidebar_open', next ? 'true' : 'false');
      }
      return next;
    });
  };

  const handleInlineCitationClick = (msgId: string, citationRef: any) => {
    const msg = messages.find((m) => m.id === msgId);
    const activeCits = msg?.citations || [];
    const firstCit = activeCits.length > 0 ? activeCits[0] : undefined;

    const finalPage = citationRef.page || firstCit?.page || undefined;
    let targetUrl = citationRef.url || firstCit?.url || '/pdf/Duoc_Thu_Quoc_Gia_Viet_Nam.pdf';
    if (finalPage && !targetUrl.includes('#page=')) {
      targetUrl = `${targetUrl.split('#')[0]}#page=${finalPage}`;
    }

    if (typeof window !== 'undefined') {
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    }
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
  };

  const handleChipClick = (chipOrText: string | QuickSuggestionChip) => {
    if (!isAudioMuted) clinicalAudio.playTelegramChime();
    onSendMessage(typeof chipOrText === 'string' ? chipOrText : chipOrText.fullPrompt);
  };

  const handleSend = (text: string, attachment?: any) => {
    if (!isAudioMuted) clinicalAudio.playTelegramChime();
    onSendMessage(text, attachment);
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-slate-50/70 relative">
      {/* 0. ChatGPT-Style Left Sidebar when Fullscreen */}
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
        />
      )}

      {/* Main Chat Viewport */}
      <div ref={outerContainerRef} className="flex-1 flex flex-col h-full min-h-0 bg-slate-50/70 relative overflow-hidden">
        {/* 1. Header: Chỉ hiển thị thanh Header thanh lịch khi ở chế độ cửa sổ thu nhỏ / floating popup */}
        {!isFullScreen ? (
          <div className="h-14 sm:h-12 px-3.5 sm:px-4 bg-white border-b border-slate-200 flex items-center justify-between gap-3 shrink-0 shadow-2xs">
            <div data-testid="chat-window-drag-handle" className="flex items-center gap-2.5 min-w-0 cursor-grab select-none">
              <div className="w-8 h-8 rounded-lg bg-teal-800 flex items-center justify-center text-white shrink-0 shadow-2xs">
                <Bot className="w-4.5 h-4.5" />
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <h3 className="text-base font-bold text-slate-950 whitespace-nowrap">
                  Trợ Lý AI Lâm Sàng
                </h3>
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${cloudActive ? 'bg-teal-500 ring-2 ring-teal-200' : 'bg-emerald-500'}`}
                  title={cloudActive ? 'Mô hình: Gemini Flash-Lite' : 'Mô hình: Nội bộ Offline'}
                />
                {activeSessionTitle && (
                  <span className="hidden sm:inline-block max-w-[130px] truncate text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200" title={activeSessionTitle}>
                    {activeSessionTitle}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {onNewSession && (
                <button
                  type="button"
                  onClick={onNewSession}
                  className="p-1.5 rounded-md text-slate-500 hover:text-teal-700 hover:bg-slate-100 transition cursor-pointer active:scale-95 shrink-0"
                  title="Cuộc trò chuyện mới"
                  aria-label="Cuộc trò chuyện mới"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
              {sessions && sessions.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsSessionsDrawerOpen(true)}
                  className="p-1.5 rounded-md text-slate-500 hover:text-teal-700 hover:bg-slate-100 transition cursor-pointer active:scale-95 shrink-0 relative"
                  title="Lịch sử các phiên hội thoại"
                  aria-label="Lịch sử các phiên hội thoại"
                >
                  <History className="w-4 h-4" />
                  {sessions.length > 1 && (
                    <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-teal-700 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                      {sessions.length}
                    </span>
                  )}
                </button>
              )}
              {onToggleFullScreen && (
                <button type="button" onClick={onToggleFullScreen} className="p-1.5 rounded-md text-slate-500 hover:text-teal-700 hover:bg-slate-100 transition cursor-pointer active:scale-95 shrink-0" title="Toàn màn hình" aria-label="Toàn màn hình">
                  <Maximize2 className="w-4 h-4" />
                </button>
              )}
              {onClearMessages && (
                <button
                  type="button"
                  data-testid="chat-clear-btn"
                  onClick={onClearMessages}
                  className="p-1.5 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer active:scale-95 shrink-0"
                  title="Làm mới phiên hội thoại"
                  aria-label="Làm mới phiên hội thoại"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}
              {onClose && (
                <button onClick={onClose} className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer active:scale-95 shrink-0" title="Đóng Trợ lý AI">
                  <X className="w-4.5 h-4.5" />
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Khi Mở rộng toàn màn hình: BỎ HẲN thanh Header trong đoạn hội thoại để không gian hội thoại rộng tối đa! */
          <>
            {!isSidebarOpen && (
              <button
                type="button"
                onClick={toggleSidebar}
                className="absolute top-3 left-3 z-20 p-2 bg-white/90 hover:bg-white text-slate-600 hover:text-slate-900 rounded-xl border border-slate-200 shadow-xs backdrop-blur-xs transition cursor-pointer"
                title="Mở thanh bên"
                aria-label="Mở thanh bên"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            )}

            <div className="absolute top-3 right-3 z-20 flex items-center gap-1 bg-white/90 backdrop-blur-xs p-1 rounded-xl border border-slate-200/90 shadow-2xs">
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
              {onClearMessages && (
                <button
                  type="button"
                  data-testid="chat-clear-btn"
                  onClick={onClearMessages}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                  title="Làm mới cuộc trò chuyện"
                  aria-label="Làm mới cuộc trò chuyện"
                >
                  <RotateCcw className="w-4 h-4" />
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
          </>
        )}

      {/* 2. Messages Stream */}
      <div
        ref={messagesContainerRef}
        onScroll={handleContainerScroll}
        className={`flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-5 ${isFullScreen ? 'pt-14 sm:pt-16' : ''}`}
      >
        <div className={`space-y-4 ${isFullScreen ? 'w-full max-w-6xl mx-auto px-2 sm:px-6' : 'w-full'}`}>
          {messages.map((msg) => {
          const isAgent = msg.sender === 'agent';
          const isSystem = msg.sender === 'system';
          const isUser = msg.sender === 'user';
          const isRightAligned = isUser || isSystem;
          const activeCitations: RagCitationItem[] = (msg.citations && msg.citations.length > 0)
            ? msg.citations
            : (msg.legalReference ? [{
                source: msg.legalReference.title || msg.legalReference.lawCode,
                title: msg.legalReference.lawCode,
                legal_basis: msg.legalReference.title || msg.legalReference.lawCode,
                section: msg.legalReference.clause,
                url: msg.legalReference.lawCode.includes('26') ? '/pdf/Thong_Tu_26_2025_TT_BYT_Ke_Don_Thuoc.pdf'
                   : msg.legalReference.lawCode.includes('20') ? '/pdf/Thong_Tu_20_2017_TT_BYT_Thuoc_Kiem_Soat_Dac_Biet.pdf'
                   : msg.legalReference.lawCode.includes('22') ? '/pdf/Thong_Tu_22_2011_TT_BYT_Khoa_Duoc_Benh_Vien.pdf'
                   : msg.legalReference.lawCode.includes('51') ? '/pdf/Thong_Tu_51_2017_TT_BYT_Huong_Dan_Phong_Chan_Doan_Xu_Tri_Phan_Ve.pdf'
                   : msg.legalReference.lawCode.includes('5948') ? '/pdf/Quyet_Dinh_5948_QD_BYT_Danh_Muc_Tuong_Tac_Chong_Chi_Dinh.pdf'
                   : '/pdf/Duoc_Thu_Quoc_Gia_Viet_Nam.pdf'
              }] : []);

          return (
            <div key={msg.id} data-testid={`chat-message-${msg.sender}`} className={`flex gap-3 w-full ${isRightAligned ? 'ml-auto flex-row-reverse max-w-[96%] sm:max-w-[85%]' : 'max-w-full'} animate-in fade-in slide-in-from-bottom-2 duration-200`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-2xs text-xs font-bold ${isAgent ? 'bg-teal-800 text-white' : isSystem ? 'bg-slate-200 text-slate-700' : 'bg-teal-600 text-white'}`}>
                {isAgent ? <Bot className="w-4.5 h-4.5" /> : <User className="w-4.5 h-4.5" />}
              </div>

              <div className="space-y-2 min-w-0 flex-1 max-w-full">
                {msg.cdssAlert && (
                  <div className="mb-2">
                    <CdssAlertBanner
                      alert={msg.cdssAlert}
                      onSubstitute={(drug) =>
                        handleChipClick(`Thay thế bằng ${drug} và kiểm tra lại an toàn đơn thuốc`)
                      }
                    />
                  </div>
                )}
                <div className={`p-3.5 sm:p-4.5 rounded-xl text-sm sm:text-base shadow-2xs leading-relaxed break-words space-y-1.5 ${
                  isUser
                    ? 'bg-teal-50/90 border border-teal-200 text-slate-900 rounded-tr-xs'
                    : isSystem
                    ? 'bg-slate-100 border border-slate-200 text-slate-800 rounded-xl'
                    : 'bg-white border border-slate-200 text-slate-900 rounded-tl-xs'
                }`}>
                      {/* Hiển thị ảnh đính kèm nếu có trong tin nhắn */}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2">
                          {msg.attachments.map((att, attIdx) => {
                            if (att.type === 'image' && (att.url || att.imageBase64)) {
                              const imgSrc = att.url || att.imageBase64;
                              return (
                                <div
                                  key={`att-${msg.id}-${attIdx}`}
                                  className="rounded-lg overflow-hidden border border-teal-300 bg-white/80 max-w-[220px] shadow-2xs"
                                >
                                  <a
                                    href={imgSrc}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="Bấm để xem ảnh kích thước đầy đủ"
                                    className="block"
                                  >
                                    <img
                                      src={imgSrc}
                                      alt={att.title || 'Ảnh đính kèm'}
                                      className="max-h-36 w-auto object-contain rounded-t hover:opacity-95 transition"
                                    />
                                  </a>
                                  <div className="px-2 py-1 text-3xs font-semibold text-slate-700 bg-teal-50/50 border-t border-teal-200 truncate flex items-center gap-1">
                                    <span>📷</span>
                                    <span className="truncate">{att.title || 'Ảnh hiện trường'}</span>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          })}
                        </div>
                      )}

                      {msg.isStreaming && !msg.text ? (
                        <div className="flex items-center gap-2 py-1 text-slate-500">
                          <span className="w-2 h-2 rounded-full bg-teal-600 animate-pulse" />
                          <span className="w-2 h-2 rounded-full bg-teal-600 animate-pulse [animation-delay:150ms]" />
                          <span className="w-2 h-2 rounded-full bg-teal-600 animate-pulse [animation-delay:300ms]" />
                          <span className="text-xs sm:text-sm text-slate-500 font-medium ml-1.5">Trợ lý AI đang tra cứu y văn...</span>
                        </div>
                      ) : (
                        <>
                          {renderFormattedText(removeLegacySourceText(msg.text, activeCitations.length > 0), {
                            isDark: false,
                            citations: activeCitations,
                            onCitationClick: (ref) => handleInlineCitationClick(msg.id, ref),
                          })}
                          {msg.isStreaming && <span className="inline-block w-2 h-4 ml-1 bg-teal-600 animate-pulse align-middle" />}
                        </>
                      )}

                      {/* Khối Nguồn Đối Soát (Hiển thị tất cả các nguồn bảo chứng, highlight đối chứng nổi bật) */}
                      {isAgent && activeCitations.length > 0 && (() => {
                        // Khử trùng lặp theo url + page hoặc title
                        const uniqueCitations: RagCitationItem[] = [];
                        const seenKeys = new Set<string>();
                        for (const c of activeCitations) {
                          const key = `${c.url || ''}#p${c.page || 0}_${c.title || c.legal_basis || ''}`;
                          if (!seenKeys.has(key)) {
                            seenKeys.add(key);
                            uniqueCitations.push(c);
                          }
                        }
                        const displayList = uniqueCitations.slice(0, 4);

                        return (
                          <div className="mt-2.5 pt-2 border-t border-slate-100">
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <BookOpen className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                              <span className="text-2xs font-semibold text-slate-600 uppercase tracking-wider">
                                {displayList.length > 1 ? `Tài liệu đối chứng y văn (${displayList.length}):` : 'Tài liệu đối chứng:'}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              {displayList.map((citation, cIdx) => {
                                const { title, subtitle, pageTag } = formatCitationLabel(citation);
                                return (
                                  <button
                                    key={`cit_${msg.id}_${cIdx}`}
                                    type="button"
                                    onClick={() => handleInlineCitationClick(msg.id, citation)}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-50 text-amber-950 hover:bg-amber-100 border border-amber-300 shadow-2xs transition-all cursor-pointer active:scale-95 text-left group ring-1 ring-amber-400/40"
                                    title={citation.excerpt ? `Đoạn trích: "${citation.excerpt.slice(0, 150)}..."` : `Bấm để xem bản scan PDF: ${citation.legal_basis || citation.source}`}
                                  >
                                    <span className="font-bold text-slate-900 truncate max-w-[240px]">{title}</span>
                                    {pageTag && (
                                      <span className="px-1.5 py-0.5 rounded bg-amber-200 text-amber-950 font-extrabold text-2xs shadow-2xs border border-amber-300/80 shrink-0">
                                        {pageTag}
                                      </span>
                                    )}
                                    {subtitle && !pageTag && (
                                      <span className="text-amber-800/80 text-2xs font-normal truncate max-w-[140px]">
                                        ({subtitle})
                                      </span>
                                    )}
                                    <ExternalLink className="w-3 h-3 text-amber-600 group-hover:text-amber-900 shrink-0" />
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}

                  {/* Tạm thời comment thẻ thông tin Action Card có sẵn theo yêu cầu người dùng để tập trung test SOTA RAG
                  {isAgent && msg.card && msg.card.primaryActionLabel && !['borrow_confirm', 'incident_confirm', 'debt_settle', 'equipment_ticket', 'medication_safety'].includes((msg.card as any).card_type || (msg.card as any).type || '') && (
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-2xs font-semibold text-slate-800 truncate">{msg.card.title}</p>
                        {msg.card.summary && <p className="text-3xs text-slate-500 truncate">{msg.card.summary}</p>}
                      </div>
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
                    </div>
                  )}
                  */}
                  {isAgent && msg.suggestedChips && msg.suggestedChips.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap gap-2">
                      <span className="w-full text-xs font-semibold text-slate-500">Gợi ý hỏi tiếp:</span>
                      {Array.from(new Set(msg.suggestedChips.filter(c => c && c.trim().length >= 4))).map((chip, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleChipClick(chip)}
                          className="px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium bg-teal-50 text-teal-800 hover:bg-teal-100 hover:text-teal-950 border border-teal-200 transition cursor-pointer active:scale-95 text-left shadow-2xs"
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                  )}

                  {isAgent && msg.answerType === 'safe_abstention' && (
                    <div role="status" className="mt-2.5 border border-amber-300 bg-amber-50 px-3 py-2.5 rounded-lg text-xs sm:text-sm text-amber-950 leading-relaxed">
                      Chưa đủ căn cứ trong nguồn đang tra cứu để kết luận. Hãy đối chiếu tài liệu gốc hoặc nhờ dược sĩ lâm sàng xác minh trước khi áp dụng.
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

      {/* 3. Input Area */}
      <div className="bg-white border-t border-slate-200 shrink-0">
        <div className={isFullScreen ? 'w-full max-w-6xl mx-auto px-2 sm:px-6' : 'w-full'}>
          <ChatInputBar onSendMessage={handleSend} suggestionChips={suggestionChips} isProcessing={isProcessing} isAudioMuted={isAudioMuted} onChipClick={handleChipClick} />
        </div>
      </div>

      {/* 4. Settings Modal */}
      <ChatSettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

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
        />
      )}
    </div>
  </div>
);
};
