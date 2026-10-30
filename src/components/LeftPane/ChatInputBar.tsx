/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Thanh Nhập Liệu Chatbot Lâm Sàng (<=120 LOC)
 */

import React, { useState } from 'react';
import { Send, Mic, Image as ImageIcon } from 'lucide-react';
import { QuickSuggestionChip } from '../../types/clinical';
import { VoiceModal } from '../Modals/VoiceModal';
import { ImageModal } from '../Modals/ImageModal';

interface ChatInputBarProps {
  onSendMessage: (text: string, attachment?: any) => void;
  suggestionChips?: QuickSuggestionChip[];
  isProcessing: boolean;
  isAudioMuted: boolean;
  onChipClick?: (chipOrText: string | QuickSuggestionChip) => void;
}

export const ChatInputBar: React.FC<ChatInputBarProps> = ({
  onSendMessage,
  isProcessing,
  isAudioMuted,
}) => {
  const [inputText, setInputText] = useState('');
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [isImageOpen, setIsImageOpen] = useState(false);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isProcessing) return;
    onSendMessage(inputText);
    setInputText('');
  };

  /*
   * Tạm thời tắt phím tắt & macro autocomplete theo yêu cầu người dùng:
   * const handleSelectMacro = (macro: ClinicalMacro) => { ... };
   * const handleInputKeyDown = (e: React.KeyboardEvent) => { ... };
   */

  return (
    <div className="p-2 sm:p-3 bg-white shrink-0">
      <form onSubmit={handleSubmit} className="flex items-center gap-1.5 sm:gap-2">
        <div className="relative flex-1">
          <input
            data-testid="chat-input-field"
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Nhập câu hỏi hoặc yêu cầu lâm sàng..."
            className="w-full pl-3.5 pr-18 sm:pr-22 h-10.5 sm:h-11 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:border-teal-700 focus:bg-white text-slate-900 transition shadow-2xs font-medium"
            disabled={isProcessing}
          />
          <div className="absolute right-1.5 sm:right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 sm:gap-1">
            <button
              type="button"
              onClick={() => setIsVoiceOpen(true)}
              title="Giọng nói lâm sàng"
              className="p-1 sm:p-1.5 rounded-md hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition cursor-pointer"
            >
              <Mic className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </button>
            <button
              type="button"
              onClick={() => setIsImageOpen(true)}
              title="Đính kèm ảnh hiện trường sự cố"
              className="p-1 sm:p-1.5 rounded-md hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition cursor-pointer"
            >
              <ImageIcon className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={!inputText.trim() || isProcessing}
          className="h-10.5 w-10.5 sm:h-11 sm:w-11 rounded-lg bg-teal-800 text-white hover:bg-teal-900 disabled:opacity-40 transition shrink-0 flex items-center justify-center shadow-2xs cursor-pointer active:scale-98"
          title="Gửi yêu cầu"
        >
          <Send className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
        </button>
      </form>

      <VoiceModal
        isOpen={isVoiceOpen}
        onClose={() => setIsVoiceOpen(false)}
        onSelectTranscript={(txt, sendImmediately) => {
          if (sendImmediately) onSendMessage(txt);
          else setInputText(txt);
        }}
        isAudioMuted={isAudioMuted}
      />
      <ImageModal
        isOpen={isImageOpen}
        onClose={() => setIsImageOpen(false)}
        onSendImageWithText={(title, prompt) => {
          onSendMessage(prompt, { type: 'image', title, description: 'Ảnh đính kèm' });
        }}
      />
    </div>
  );
};
