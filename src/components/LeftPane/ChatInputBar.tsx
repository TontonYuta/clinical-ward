/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Send, Mic, Image as ImageIcon } from 'lucide-react';
import { QuickSuggestionChip } from '../../types/clinical';
import { ClinicalMacroAutocomplete } from '../Common/ClinicalMacroAutocomplete';
import { ClinicalMacro, CLINICAL_MACROS } from '../../data/clinicalMacros';
import { VoiceModal } from '../Modals/VoiceModal';
import { ImageModal } from '../Modals/ImageModal';

interface ChatInputBarProps {
  onSendMessage: (text: string, attachment?: any) => void;
  suggestionChips: QuickSuggestionChip[];
  isProcessing: boolean;
  isAudioMuted: boolean;
  onChipClick: (chipOrText: string | QuickSuggestionChip) => void;
}

export const ChatInputBar: React.FC<ChatInputBarProps> = ({
  onSendMessage,
  suggestionChips,
  isProcessing,
  isAudioMuted,
  onChipClick
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

  const handleSelectMacro = (macro: ClinicalMacro, mode?: 'replace_word' | 'full_prompt' | 'append') => {
    if (mode === 'full_prompt') {
      setInputText(macro.suggestedPrompt);
      return;
    }
    const trimmed = inputText.trimEnd();
    const words = trimmed ? trimmed.split(/\s+/) : [];
    if (words.length > 0) {
      const lastWord = words[words.length - 1];
      if (
        lastWord.toLowerCase() === macro.shortcut.toLowerCase() ||
        lastWord.toLowerCase() === `/${macro.shortcut.toLowerCase()}` ||
        macro.shortcut.toLowerCase().startsWith(lastWord.toLowerCase().replace(/^\//, ''))
      ) {
        words[words.length - 1] = macro.expansion;
        setInputText(words.join(' ') + ' ');
        return;
      }
    }
    setInputText(!inputText.trim() ? macro.expansion + ' ' : inputText + ' ' + macro.expansion + ' ');
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab') {
      const words = inputText.trimEnd().split(/\s+/);
      if (words.length > 0) {
        const lastWord = words[words.length - 1]?.replace(/^\//, '').toUpperCase();
        const matched = CLINICAL_MACROS.find((m) => m.shortcut.toUpperCase() === lastWord);
        if (matched) {
          e.preventDefault();
          words[words.length - 1] = matched.expansion;
          setInputText(words.join(' ') + ' ');
        }
      }
    }
  };

  return (
    <div className="p-2 sm:p-3 bg-white border-t border-slate-200 shrink-0 space-y-1.5 pb-3 sm:pb-3">
      <ClinicalMacroAutocomplete
        currentText={inputText}
        onSelectMacro={handleSelectMacro}
        placement="top"
        showQuickBar={true}
      >
        {suggestionChips && suggestionChips.length > 0 && (
          <>
            {suggestionChips.map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => onChipClick(chip)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700 hover:text-slate-900 whitespace-nowrap transition cursor-pointer shrink-0 border border-slate-200 active:scale-98"
              >
                <span>{chip.label}</span>
                {chip.badge && (
                  <span className="text-xs font-mono text-slate-600 font-semibold bg-white px-1.5 py-0.5 rounded border border-slate-200">
                    {chip.badge}
                  </span>
                )}
              </button>
            ))}
            <div className="h-4 w-px bg-slate-200 shrink-0 mx-0.5" />
          </>
        )}
      </ClinicalMacroAutocomplete>

      <form onSubmit={handleSubmit} className="flex items-center gap-1.5 sm:gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Yêu cầu hoặc gõ tắt (THA, NMCT, PUV)..."
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
          title="Gửi lệnh"
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
