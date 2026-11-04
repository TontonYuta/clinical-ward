/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Thanh Nhập Liệu Chatbot Lâm Sàng - Nhập giọng nói tiếng Việt trực tiếp (<=120 LOC)
 */

import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, MicOff, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { QuickSuggestionChip } from '../../types/clinical';
import { ImageModal } from '../Modals/ImageModal';
import { clinicalAudio } from '../../utils/audio';

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
  const [isImageOpen, setIsImageOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const baseTextRef = useRef<string>('');

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
      }
    };
  }, []);

  useEffect(() => {
    // Tự động giải phóng lỗi khi người dùng mở lại quyền Micro trên trình duyệt
    if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
      navigator.permissions.query({ name: 'microphone' as PermissionName }).then((status) => {
        status.onchange = () => {
          if (status.state === 'granted') {
            setSpeechError(null);
          }
        };
      }).catch(() => {});
    }

    if (speechError) {
      const timer = window.setTimeout(() => setSpeechError(null), 12000);
      return () => window.clearTimeout(timer);
    }
  }, [speechError]);

  const stopListening = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
    setIsListening(false);
    if (!isAudioMuted) clinicalAudio.playMicBeep(false);
  };

  const requestMicPermissionDirectly = async () => {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
        setSpeechError(null);
        void startListening();
      } catch (err: any) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setSpeechError('Micro đang bị chặn trong Cài đặt trình duyệt. Bấm vào biểu tượng 🔒 hoặc 🎛️ bên trái thanh URL, chọn "Cho phép Micro" rồi thử lại.');
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setSpeechError('Không tìm thấy thiết bị micro kết nối với máy tính.');
        } else {
          setSpeechError('Không thể mở micro. Vui lòng kiểm tra cài đặt quyền micro trên trình duyệt.');
        }
      }
    }
  };

  const startListening = () => {
    setSpeechError(null);

    // Kiểm tra Secure Context (Bắt buộc HTTPS hoặc localhost theo chuẩn W3C)
    if (typeof window !== 'undefined' && !window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      setSpeechError('Tính năng micro yêu cầu kết nối bảo mật HTTPS hoặc localhost.');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechError('Trình duyệt này chưa hỗ trợ nhận dạng giọng nói trực tiếp. Vui lòng dùng Chrome, Edge, Safari hoặc Cốc Cốc.');
      return;
    }

    try {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
      }
      const recognition = new SpeechRecognition();
      recognition.lang = 'vi-VN';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      baseTextRef.current = inputText.trim();

      // Cập nhật trạng thái đang lắng nghe ngay lập tức cho người dùng
      setIsListening(true);
      if (!isAudioMuted) clinicalAudio.playMicBeep(true);

      recognition.onstart = () => {
        setIsListening(true);
        setSpeechError(null);
      };

      recognition.onresult = (event: any) => {
        let fullSpoken = '';
        for (let i = 0; i < event.results.length; ++i) {
          fullSpoken += event.results[i][0].transcript;
        }
        const clean = fullSpoken.trim();
        if (clean) {
          const base = baseTextRef.current;
          setInputText(base ? `${base} ${clean}` : clean);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('SpeechRecognition error:', event.error);
        if (event.error === 'not-allowed') {
          setSpeechError('Micro đang bị chặn trong trình duyệt. Hãy bấm biểu tượng 🔒 hoặc 🎛️ bên cạnh thanh URL (hoặc Cài đặt > Safari/Chrome > Micro), chọn "Cho phép Micro" rồi bấm "Thử lại".');
        } else if (event.error === 'network') {
          setSpeechError('Lỗi kết nối dịch vụ nhận dạng giọng nói. Vui lòng kiểm tra mạng Internet.');
        } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
          setSpeechError(`Lỗi micro: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        if (!isAudioMuted) clinicalAudio.playMicBeep(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.warn('SpeechRecognition start exception:', err);
      setIsListening(false);
      void requestMicPermissionDirectly();
    }
  };

  const toggleListening = () => {
    if (isListening) stopListening();
    else void startListening();
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isListening) stopListening();
    if (!inputText.trim() || isProcessing) return;
    onSendMessage(inputText.trim());
    setInputText('');
    baseTextRef.current = '';
  };

  return (
    <div className="p-2 sm:p-3 bg-white shrink-0">
      {isListening && (
        <div className="flex items-center justify-between px-2.5 py-1 mb-1.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 animate-in fade-in">
          <div className="flex items-center gap-1.5 font-medium">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600"></span>
            </span>
            <span>Đang nghe tiếng Việt... Hãy nói câu hỏi hoặc yêu cầu</span>
          </div>
          <button
            type="button"
            onClick={stopListening}
            className="text-2xs font-bold text-rose-700 hover:text-rose-900 px-1.5 py-0.5 rounded-sm hover:bg-rose-100 transition cursor-pointer"
          >
            Dừng
          </button>
        </div>
      )}

      {speechError && (
        <div className="flex items-center justify-between px-2.5 py-1 mb-1.5 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-900 animate-in fade-in shadow-2xs">
          <div className="flex items-center gap-1.5 min-w-0 pr-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span className="text-2xs sm:text-xs leading-tight">{speechError}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => void requestMicPermissionDirectly()}
              className="px-2 py-0.5 rounded-sm bg-amber-200 hover:bg-amber-300 text-amber-900 text-3xs font-bold transition cursor-pointer"
              title="Yêu cầu trình duyệt cấp quyền Micro"
            >
              Cấp quyền / Thử lại
            </button>
            <button
              type="button"
              onClick={() => setSpeechError(null)}
              className="text-amber-700 hover:text-amber-950 font-bold px-1 cursor-pointer"
              title="Đóng thông báo"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-center gap-1.5 sm:gap-2">
        <div className="relative flex-1">
          <input
            data-testid="chat-input-field"
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={isListening ? '🎙️ Đang nghe tiếng Việt... Hãy nói câu hỏi' : 'Nhập câu hỏi hoặc yêu cầu lâm sàng...'}
            className="w-full pl-3.5 pr-18 sm:pr-22 h-10.5 sm:h-11 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:border-teal-700 focus:bg-white text-slate-900 transition shadow-2xs font-medium"
            disabled={isProcessing}
          />
          <div className="absolute right-1.5 sm:right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 sm:gap-1">
            <button
              type="button"
              data-testid="chat-voice-btn"
              onClick={toggleListening}
              title={isListening ? 'Đang thu âm giọng nói (Bấm để dừng)' : 'Nhập bằng giọng nói (Micro tiếng Việt)'}
              className={`p-1 sm:p-1.5 rounded-md transition cursor-pointer ${
                isListening
                  ? 'bg-rose-600 text-white animate-pulse ring-2 ring-rose-300 hover:bg-rose-700'
                  : 'hover:bg-slate-200 text-slate-500 hover:text-slate-800'
              }`}
            >
              {isListening ? <MicOff className="w-4 h-4 sm:w-4.5 sm:h-4.5" /> : <Mic className="w-4 h-4 sm:w-4.5 sm:h-4.5" />}
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
