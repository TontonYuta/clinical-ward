/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Khung Cửa Sổ Chatbot Lâm Sàng Tích Hợp AI & Action Cards (<=200 LOC)
 */

import React, { useRef, useEffect, useState } from 'react';
import { Bot, User, X, ShieldCheck, RotateCcw, Settings2, Maximize2, Minimize2, BookOpen, ExternalLink, ChevronDown, ChevronRight, FileText } from 'lucide-react';
import { ChatMessage, QuickSuggestionChip, UserRole, DashboardTab } from '../../types/clinical';
import { RagCitationItem } from '../../types/chat';
import { clinicalAudio } from '../../utils/audio';
import { renderFormattedText } from './ChatMarkdown';
import { CdssAlertBanner } from './Cards/CdssAlertBanner';
import { ChatInputBar } from './ChatInputBar';
import { ChatSettingsModal } from './ChatSettingsModal';
import { PdfViewerDrawer, PdfViewerTarget } from '../Modals/PdfViewerDrawer';
import { isCloudAIAvailable } from '../../services/geminiService';
import { removeLegacySourceText } from '../../utils/chatAnswerPresentation';

interface ChatWindowProps {
  messages: ChatMessage[]; suggestionChips: QuickSuggestionChip[];
  onSendMessage: (text: string, attachment?: any) => void;
  isProcessing: boolean; isAudioMuted: boolean; onSelectTab?: (tab: DashboardTab) => void;
  currentUserRole?: UserRole; onClose?: () => void; pendingDebtsCount?: number;
  pendingAmpoulesCount?: number; urgentTicketsCount?: number; lowStockCount?: number;
  onExecuteCardAction?: (messageId: string, actionType: string, cardData: any) => void;
  onClearMessages?: () => void; onOpenAuditTrail?: () => void; onOpenLegalDocs?: () => void;
  onOpenUserGuide?: () => void; isFullScreen?: boolean; onToggleFullScreen?: () => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  messages, suggestionChips, onSendMessage, isProcessing, isAudioMuted, onSelectTab,
  currentUserRole = 'nurse', onClose, pendingDebtsCount = 0, urgentTicketsCount = 0,
  lowStockCount = 0, onExecuteCardAction, onClearMessages, onOpenLegalDocs, onOpenUserGuide,
  isFullScreen = false, onToggleFullScreen,
}) => {
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const outerContainerRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isUserScrolledUpRef = useRef(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [cloudActive, setCloudActive] = useState(isCloudAIAvailable());
  const [pdfTarget, setPdfTarget] = useState<PdfViewerTarget | null>(null);

  const handleInlineCitationClick = (_msgId: string, citationRef: any) => {
    setPdfTarget({
      title: citationRef.title || citationRef.legal_basis || 'Dược Thư Quốc Gia Việt Nam',
      url: citationRef.url || '/pdf/Duoc_Thu_Quoc_Gia_Viet_Nam.pdf',
      page: citationRef.page,
      excerpt: citationRef.excerpt,
      legal_basis: citationRef.legal_basis || citationRef.title,
      section: citationRef.section,
      inn: citationRef.section || 'paracetamol',
    });
  };

  const isStreamingAny = messages.some(m => m.isStreaming);

  useEffect(() => {
    if (outerContainerRef.current) {
      outerContainerRef.current.scrollTop = 0;
    }
    if (isStreamingAny) {
      // Khi đang stream token: nếu bác sĩ không cuộn ngược lên đọc tài liệu cũ,
      // tự động bám đáy bằng scrollTop trực tiếp trên messagesContainerRef
      if (!isUserScrolledUpRef.current) {
        const container = messagesContainerRef.current;
        if (container) {
          container.scrollTop = container.scrollHeight;
        }
      }
    } else {
      // Khi stream xong hoặc có tin nhắn mới hoàn tất: cuộn mượt dịu dàng trên container tin nhắn
      isUserScrolledUpRef.current = false;
      const container = messagesContainerRef.current;
      if (container) {
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
      }
    }
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
    <div ref={outerContainerRef} className="flex flex-col h-full min-h-0 bg-slate-50/70 relative overflow-hidden">
      {/* 1. Header */}
      <div className="h-14 sm:h-12 px-3.5 sm:px-4 bg-white border-b border-slate-200 flex items-center justify-between gap-3 shrink-0 shadow-2xs">
        <div data-testid="chat-window-drag-handle" className="flex items-center gap-2.5 min-w-0 cursor-grab select-none">
          <div className="w-8 h-8 rounded-lg bg-teal-800 flex items-center justify-center text-white shrink-0 shadow-2xs">
            <Bot className="w-4.5 h-4.5" />
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="text-sm font-bold text-slate-950 whitespace-nowrap">
              Trợ Lý AI Lâm Sàng
            </h3>
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${cloudActive ? 'bg-teal-500 ring-2 ring-teal-200' : 'bg-emerald-500'}`}
              title={cloudActive ? 'Mô hình: Gemini Flash-Lite' : 'Mô hình: Nội bộ Offline'}
            />
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => setIsSettingsOpen(true)} className="p-1.5 rounded-md text-slate-500 hover:text-teal-700 hover:bg-slate-100 transition cursor-pointer active:scale-95 shrink-0" title="Cấu hình mô hình AI">
            <Settings2 className="w-4 h-4" />
          </button>
          {onToggleFullScreen && (
            <button type="button" onClick={onToggleFullScreen} className="p-1.5 rounded-md text-slate-500 hover:text-teal-700 hover:bg-slate-100 transition cursor-pointer active:scale-95 shrink-0" title={isFullScreen ? 'Thu nhỏ' : 'Toàn màn hình'} aria-label={isFullScreen ? 'Thu nhỏ' : 'Toàn màn hình'}>
              {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
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

      {/* 2. Messages Stream */}
      <div
        ref={messagesContainerRef}
        onScroll={handleContainerScroll}
        className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-4"
      >
        <div className={`space-y-3.5 ${isFullScreen ? 'max-w-4xl mx-auto w-full' : 'w-full'}`}>
          {messages.map((msg) => {
          const isAgent = msg.sender === 'agent';
          const isSystem = msg.sender === 'system';
          const isUser = msg.sender === 'user';
          const isRightAligned = isUser || isSystem;

          return (
            <div key={msg.id} data-testid={`chat-message-${msg.sender}`} className={`flex gap-2.5 w-full ${isRightAligned ? 'ml-auto flex-row-reverse max-w-[96%] sm:max-w-[88%]' : 'max-w-full'} animate-in fade-in slide-in-from-bottom-2 duration-200`}>
              <div className={`w-7.5 h-7.5 rounded-lg flex items-center justify-center shrink-0 shadow-2xs text-xs font-bold ${isAgent ? 'bg-teal-800 text-white' : isSystem ? 'bg-slate-200 text-slate-700' : 'bg-teal-600 text-white'}`}>
                {isAgent ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
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
                <div className={`p-3.5 sm:p-4 rounded-xl text-xs sm:text-sm shadow-2xs leading-relaxed break-words space-y-1 ${
                  isUser
                    ? 'bg-teal-50/90 border border-teal-200 text-slate-900 rounded-tr-xs'
                    : isSystem
                    ? 'bg-slate-100 border border-slate-200 text-slate-800 rounded-xl'
                    : 'bg-white border border-slate-200 text-slate-900 rounded-tl-xs'
                }`}>
                  {msg.isStreaming && !msg.text ? (
                    <div className="flex items-center gap-1.5 py-1 text-slate-500">
                      <span className="w-2 h-2 rounded-full bg-teal-600 animate-pulse" />
                      <span className="w-2 h-2 rounded-full bg-teal-600 animate-pulse [animation-delay:150ms]" />
                      <span className="w-2 h-2 rounded-full bg-teal-600 animate-pulse [animation-delay:300ms]" />
                      <span className="text-2xs text-slate-500 font-mono ml-1.5">Trợ lý AI đang tra cứu y văn...</span>
                    </div>
                  ) : (
                    <>
                      {renderFormattedText(removeLegacySourceText(msg.text), {
                        isDark: false,
                        citations: msg.citations,
                        onCitationClick: (ref) => handleInlineCitationClick(msg.id, ref),
                      })}
                      {msg.isStreaming && <span className="inline-block w-1.5 h-3.5 ml-1 bg-teal-600 animate-pulse align-middle" />}
                    </>
                  )}

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
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap gap-1.5">
                      <span className="w-full text-2xs font-semibold text-slate-500">Gợi ý hỏi tiếp:</span>
                      {Array.from(new Set(msg.suggestedChips.filter(c => c && c.trim().length >= 4))).map((chip, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleChipClick(chip)}
                          className="px-2.5 py-1 rounded-md text-2xs font-semibold bg-teal-50 text-teal-800 hover:bg-teal-100 hover:text-teal-950 border border-teal-200 transition cursor-pointer active:scale-95 text-left shadow-2xs"
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                  )}

                  {isAgent && msg.answerType === 'safe_abstention' && (
                    <div role="status" className="mt-2 border border-amber-300 bg-amber-50 px-2.5 py-2 text-xs text-amber-950">
                      Chưa đủ căn cứ trong nguồn đang tra cứu để kết luận. Hãy đối chiếu tài liệu gốc hoặc nhờ dược sĩ lâm sàng xác minh trước khi áp dụng.
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {isProcessing && !messages.some(m => m.isStreaming && m.text) && (
          <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-500 pl-9 font-medium">
            <span className="w-2 h-2 rounded-full bg-teal-600 animate-pulse"></span>
            <span>Trợ lý đang phân tích ngữ cảnh lâm sàng...</span>
          </div>
        )}
        <div ref={chatBottomRef} />
        </div>
      </div>

      {/* 3. Input Area */}
      <div className="bg-white border-t border-slate-200 shrink-0">
        <div className={isFullScreen ? 'max-w-4xl mx-auto w-full' : 'w-full'}>
          <ChatInputBar onSendMessage={handleSend} suggestionChips={suggestionChips} isProcessing={isProcessing} isAudioMuted={isAudioMuted} onChipClick={handleChipClick} />
        </div>
      </div>

      {/* 4. Settings Modal */}
      <ChatSettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      {/* 5. In-App Dual-Mode Clinical Reader & PDF Drawer (Tier 3) */}
      <PdfViewerDrawer
        isOpen={Boolean(pdfTarget)}
        target={pdfTarget}
        onClose={() => setPdfTarget(null)}
      />
    </div>
  );
};
