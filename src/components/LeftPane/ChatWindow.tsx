/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Khung Cửa Sổ Chatbot Lâm Sàng Tích Hợp AI & Action Cards (<=200 LOC)
 */

import React, { useRef, useEffect, useState } from 'react';
import { Bot, User, X, ShieldCheck, RotateCcw, Settings2, Maximize2, Minimize2 } from 'lucide-react';
import { ChatMessage, QuickSuggestionChip, UserRole, DashboardTab } from '../../types/clinical';
import { clinicalAudio } from '../../utils/audio';
import { renderFormattedText } from './ChatMarkdown';
import { ActionCardDispatcher } from './Cards/ActionCardDispatcher';
import { ShiftBriefingEmptyState } from './ShiftBriefingEmptyState';
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
  isFullScreen?: boolean;
  onToggleFullScreen?: () => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  messages, suggestionChips, onSendMessage, isProcessing, isAudioMuted, onSelectTab,
  currentUserRole = 'nurse', onClose, pendingDebtsCount = 0, urgentTicketsCount = 0,
  lowStockCount = 0, onExecuteCardAction, onClearMessages, onOpenLegalDocs,
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
      <div className="h-13 sm:h-11 px-3.5 sm:px-4 bg-white border-b border-slate-200/90 flex items-center justify-between shrink-0 shadow-2xs">
        <div className="flex items-center gap-2 sm:gap-2.5">
          <div className="w-7.5 h-7.5 sm:w-7 sm:h-7 rounded-lg bg-teal-800 flex items-center justify-center text-white shadow-2xs">
            <Bot className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="text-sm font-bold text-slate-900">Trợ Lý Agent Lâm Sàng</span>
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-2xs font-semibold bg-slate-100 hover:bg-teal-50 hover:text-teal-800 transition cursor-pointer"
              title="Nhấn để cấu hình AI và API Key"
            >
              <span className={`w-2 h-2 rounded-full ${cloudActive ? 'bg-teal-500 ring-2 ring-teal-200' : 'bg-emerald-500'}`} />
              <span className="hidden sm:inline text-slate-600">{cloudActive ? 'Gemini Flash-Lite' : 'Nội bộ'}</span>
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 sm:p-1.5 rounded-lg text-slate-400 hover:text-teal-700 hover:bg-slate-100 transition cursor-pointer active:scale-95"
            title="Cấu hình AI & Tối ưu chi phí"
          >
            <Settings2 className="w-4 h-4" />
          </button>
          {onToggleFullScreen && (
            <button
              type="button"
              onClick={onToggleFullScreen}
              className="p-2 sm:p-1.5 rounded-lg text-slate-500 hover:text-teal-700 hover:bg-slate-100 transition cursor-pointer active:scale-95"
              title={isFullScreen ? 'Thu nhỏ cửa sổ' : 'Mở rộng toàn màn hình'}
              aria-label={isFullScreen ? 'Thu nhỏ' : 'Toàn màn hình'}
            >
              {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          )}
          {onClearMessages && (
            <button onClick={onClearMessages} className="p-2 sm:p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer active:scale-95" title="Làm mới phiên hội thoại">
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
          {onClose && (
            <button onClick={onClose} className="p-2 sm:p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer active:scale-95" title="Thu nhỏ Trợ lý AI">
              <X className="w-5 h-5 sm:w-4 sm:h-4" />
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
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-white shadow-2xs text-xs font-bold ${isAgent ? 'bg-teal-800' : isSystem ? 'bg-slate-700' : 'bg-slate-900'}`}>
                {isAgent ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
              </div>

              <div className="space-y-2 min-w-0 flex-1">
                <div className={`p-3 rounded-2xl text-xs sm:text-sm shadow-2xs leading-relaxed ${isDarkBubble ? 'bg-slate-900 text-white rounded-tr-xs' : 'bg-white border border-slate-200/90 text-slate-800 rounded-tl-xs'}`}>
                  {renderFormattedText(msg.text, isDarkBubble)}
                </div>

                {msg.card && onExecuteCardAction && (
                  <ActionCardDispatcher card={msg.card} messageId={msg.id} onExecuteAction={onExecuteCardAction} onSelectTab={onSelectTab} />
                )}
              </div>
            </div>
          );
        })}

        {messages.length <= 1 && (
          <ShiftBriefingEmptyState currentUserRole={currentUserRole} pendingDebtsCount={pendingDebtsCount} urgentTicketsCount={urgentTicketsCount} lowStockCount={lowStockCount} onChipClick={handleChipClick} />
        )}

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
