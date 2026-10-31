/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Khung Cửa Sổ Chatbot Lâm Sàng Tích Hợp AI & Action Cards (<=200 LOC)
 */

import React, { useRef, useEffect, useState } from 'react';
import { Bot, User, X, ShieldCheck, RotateCcw, Settings2, Maximize2, Minimize2, HelpCircle, BookOpen, CheckCircle2 } from 'lucide-react';
import { ChatMessage, QuickSuggestionChip, UserRole, DashboardTab } from '../../types/clinical';
import { clinicalAudio } from '../../utils/audio';
import { renderFormattedText } from './ChatMarkdown';
import { ChatInputBar } from './ChatInputBar';
import { ChatSettingsModal } from './ChatSettingsModal';
import { isCloudAIAvailable } from '../../services/geminiService';

interface ChatWindowProps {
  messages: ChatMessage[];
  suggestionChips: QuickSuggestionChip[];
  onSendMessage: (text: string, attachment?: any) => void;
  isProcessing: boolean;
  isAudioMuted: boolean;
  onSelectTab?: (tab: DashboardTab) => void;
  currentUserRole?: UserRole;
  onClose?: () => void;
  pendingDebtsCount?: number;
  pendingAmpoulesCount?: number;
  urgentTicketsCount?: number;
  lowStockCount?: number;
  onExecuteCardAction?: (messageId: string, actionType: string, cardData: any) => void;
  onClearMessages?: () => void;
  onOpenAuditTrail?: () => void;
  onOpenLegalDocs?: () => void;
  onOpenUserGuide?: () => void;
  isFullScreen?: boolean;
  onToggleFullScreen?: () => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  messages, suggestionChips, onSendMessage, isProcessing, isAudioMuted, onSelectTab,
  currentUserRole = 'nurse', onClose, pendingDebtsCount = 0, urgentTicketsCount = 0,
  lowStockCount = 0, onExecuteCardAction, onClearMessages, onOpenLegalDocs, onOpenUserGuide,
  isFullScreen = false, onToggleFullScreen,
}) => {
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [cloudActive, setCloudActive] = useState(isCloudAIAvailable());

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  const handleChipClick = (chipOrText: string | QuickSuggestionChip) => {
    if (!isAudioMuted) clinicalAudio.playTelegramChime();
    onSendMessage(typeof chipOrText === 'string' ? chipOrText : chipOrText.fullPrompt);
  };

  const handleSend = (text: string, attachment?: any) => {
    if (!isAudioMuted) clinicalAudio.playTelegramChime();
    onSendMessage(text, attachment);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/70 relative overflow-hidden">
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
          {onOpenUserGuide && (
            <button
              type="button"
              data-testid="chat-hdsd-btn"
              onClick={onOpenUserGuide}
              className="px-2 py-1 rounded-md text-slate-700 hover:text-teal-800 hover:bg-teal-50 transition cursor-pointer active:scale-95 flex items-center gap-1 border border-slate-200 hover:border-teal-300 text-xs font-semibold shrink-0"
              title="Hướng dẫn sử dụng & Kịch bản trợ lý lâm sàng"
            >
              <HelpCircle className="w-3.5 h-3.5 text-teal-700 shrink-0" />
              <span>HDSD</span>
            </button>
          )}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-1.5 rounded-md text-slate-500 hover:text-teal-700 hover:bg-slate-100 transition cursor-pointer active:scale-95 shrink-0"
            title="Cấu hình mô hình AI"
          >
            <Settings2 className="w-4 h-4" />
          </button>
          {onToggleFullScreen && (
            <button
              type="button"
              onClick={onToggleFullScreen}
              className="p-1.5 rounded-md text-slate-500 hover:text-teal-700 hover:bg-slate-100 transition cursor-pointer active:scale-95 shrink-0"
              title={isFullScreen ? 'Thu nhỏ cửa sổ' : 'Mở rộng toàn màn hình'}
              aria-label={isFullScreen ? 'Thu nhỏ' : 'Toàn màn hình'}
            >
              {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          )}
          {onClearMessages && (
            <button
              onClick={onClearMessages}
              className="p-1.5 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer active:scale-95 shrink-0"
              title="Làm mới phiên hội thoại"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer active:scale-95 shrink-0"
              title="Đóng Trợ lý AI"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Messages Stream */}
      <div className="flex-1 overflow-y-auto p-3.5 sm:p-4">
        <div className={`space-y-3.5 ${isFullScreen ? 'max-w-4xl mx-auto w-full' : 'w-full'}`}>
          {messages.map((msg) => {
          const isAgent = msg.sender === 'agent';
          const isSystem = msg.sender === 'system';
          const isDarkBubble = msg.sender === 'user' || isSystem;

          return (
            <div key={msg.id} className={`flex gap-2.5 max-w-[96%] sm:max-w-[88%] ${isDarkBubble ? 'ml-auto flex-row-reverse' : ''} animate-in fade-in slide-in-from-bottom-2 duration-200`}>
              <div className={`w-7.5 h-7.5 rounded-lg flex items-center justify-center shrink-0 text-white shadow-2xs text-xs font-bold ${isAgent ? 'bg-teal-800' : isSystem ? 'bg-slate-700' : 'bg-slate-900'}`}>
                {isAgent ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
              </div>

              <div className="space-y-2 min-w-0 flex-1">
                <div className={`p-3.5 sm:p-4 rounded-xl text-xs sm:text-sm shadow-2xs leading-relaxed ${isDarkBubble ? 'bg-slate-900 text-white rounded-tr-xs' : 'bg-white border border-slate-200 text-slate-900 rounded-tl-xs'}`}>
                  {renderFormattedText(msg.text, isDarkBubble)}
                  {isAgent && (msg.sourceStatus || msg.answerType) && (
                    <div className="mt-2 text-2xs text-slate-500" data-testid="chat-source-status">
                      Nguồn: {msg.sourceStatus || msg.answerType}
                      {typeof msg.confidence === 'number' && ` • Độ tin cậy ${(msg.confidence * 100).toFixed(0)}%`}
                    </div>
                  )}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1.5 text-2xs text-slate-600">
                      <span className="inline-flex items-center gap-1 font-semibold text-teal-800 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
                        <CheckCircle2 className="w-3 h-3 text-teal-700" />
                        <span>RAG Xác thực ({msg.citations.length})</span>
                      </span>
                      {msg.citations.slice(0, 3).map((c, i) => (
                        <span key={i} title={`${c.source}: ${c.excerpt || c.section}`} className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200 cursor-help">
                          <BookOpen className="w-2.5 h-2.5 text-slate-500" />
                          <span className="font-medium truncate max-w-[140px]">{c.legal_basis}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {isProcessing && (
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
      <ChatSettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} onKeyUpdated={() => setCloudActive(isCloudAIAvailable())} />
    </div>
  );
};
