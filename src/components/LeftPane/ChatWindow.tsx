/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect } from 'react';
import { Bot, User, X, ShieldCheck, RotateCcw, Paperclip } from 'lucide-react';
import { ChatMessage, QuickSuggestionChip, UserRole, DashboardTab } from '../../types/clinical';
import { clinicalAudio } from '../../utils/audio';
import { renderFormattedText } from './ChatMarkdown';
import { ActionCardDispatcher } from './Cards/ActionCardDispatcher';
import { ShiftBriefingEmptyState } from './ShiftBriefingEmptyState';
import { ChatInputBar } from './ChatInputBar';

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
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  messages,
  suggestionChips,
  onSendMessage,
  isProcessing,
  isAudioMuted,
  onSelectTab,
  currentUserRole = 'nurse',
  onClose,
  pendingDebtsCount = 0,
  urgentTicketsCount = 0,
  lowStockCount = 0,
  onExecuteCardAction,
  onClearMessages,
  onOpenLegalDocs,
}) => {
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  const handleChipClick = (chipOrText: string | QuickSuggestionChip) => {
    if (!isAudioMuted) clinicalAudio.playTelegramChime();
    const prompt = typeof chipOrText === 'string' ? chipOrText : chipOrText.fullPrompt;
    onSendMessage(prompt);
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
            <span className="w-2 h-2 rounded-full bg-emerald-500" title="Agent Live REST API" />
          </div>
        </div>
        <div className="flex items-center gap-1">
          {onClearMessages && (
            <button
              onClick={onClearMessages}
              className="p-2 sm:p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer active:scale-95"
              title="Làm mới phiên hội thoại"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 sm:p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer active:scale-95"
              title="Thu nhỏ Trợ lý AI"
            >
              <X className="w-5 h-5 sm:w-4 sm:h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Messages Stream */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5">
        {messages.map((msg) => {
          const isAgent = msg.sender === 'agent';
          const isSystem = msg.sender === 'system';
          const isUser = msg.sender === 'user';
          const isDarkBubble = isUser || isSystem;

          return (
            <div key={msg.id} className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}>
              <div
                className={`w-7.5 h-7.5 rounded-lg flex items-center justify-center shrink-0 text-white text-xs shadow-2xs ${
                  isSystem
                    ? 'bg-teal-900 text-teal-300 border border-teal-500/40'
                    : isAgent
                    ? 'bg-teal-800'
                    : 'bg-slate-800'
                }`}
              >
                {isSystem ? <ShieldCheck className="w-4 h-4 text-emerald-300" /> : isAgent ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
              </div>

              <div
                className={`max-w-[90%] rounded-lg p-3 text-sm leading-relaxed shadow-2xs ${
                  isSystem
                    ? 'bg-slate-900 text-slate-100 border border-teal-500/30'
                    : isAgent
                    ? 'bg-white border border-slate-200 text-slate-800'
                    : 'bg-slate-900 text-white'
                }`}
              >
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="mb-2 p-2 rounded-md bg-black/10 text-xs flex items-center gap-2 font-medium">
                    <Paperclip className="w-4 h-4 shrink-0 text-teal-400" />
                    <span className="truncate">{msg.attachments[0].title}</span>
                  </div>
                )}

                <div className="space-y-1">{renderFormattedText(msg.text, isDarkBubble)}</div>

                <ActionCardDispatcher
                  msg={msg}
                  onExecuteCardAction={onExecuteCardAction}
                  onSelectTab={onSelectTab}
                  onOpenLegalDocs={onOpenLegalDocs}
                />

                {msg.suggestedChips && msg.suggestedChips.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap gap-1.5">
                    {msg.suggestedChips.map((chipText, cIdx) => (
                      <button
                        key={cIdx}
                        onClick={() => handleChipClick(chipText)}
                        className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 hover:bg-teal-50 text-slate-700 hover:text-teal-900 border border-slate-200 transition cursor-pointer"
                      >
                        {chipText}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {messages.length <= 1 && (
          <ShiftBriefingEmptyState
            currentUserRole={currentUserRole}
            pendingDebtsCount={pendingDebtsCount}
            urgentTicketsCount={urgentTicketsCount}
            lowStockCount={lowStockCount}
            onChipClick={handleChipClick}
          />
        )}

        {isProcessing && (
          <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-500 pl-9 font-medium">
            <span className="w-2 h-2 rounded-full bg-teal-600 animate-pulse"></span>
            <span>Trợ lý đang phân tích ngữ cảnh lâm sàng...</span>
          </div>
        )}

        <div ref={chatBottomRef} />
      </div>

      {/* 3. Input Area */}
      <ChatInputBar
        onSendMessage={handleSend}
        suggestionChips={suggestionChips}
        isProcessing={isProcessing}
        isAudioMuted={isAudioMuted}
        onChipClick={handleChipClick}
      />
    </div>
  );
};
