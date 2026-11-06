/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Thanh Nhập Liệu Chatbot Lâm Sàng - Nhập giọng nói tiếng Việt trực tiếp (<=120 LOC)
 */

import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, MicOff, Image as ImageIcon, AlertCircle, Clock, X } from 'lucide-react';
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
  const [autoSendOnSilence, setAutoSendOnSilence] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        return localStorage.getItem('clinical_voice_auto_send') !== 'false';
      } catch {}
    }
    return true;
  });
  const [isCountingDown, setIsCountingDown] = useState(false);

  const recognitionRef = useRef<any>(null);
  const baseTextRef = useRef<string>('');
  const latestSpokenTextRef = useRef<string>('');
  const silenceTimerRef = useRef<number | null>(null);
  const hasDispatchedRef = useRef<boolean>(false);

  useEffect(() => {
    return () => {
      if (silenceTimerRef.current) window.clearTimeout(silenceTimerRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.onresult = null;
          recognitionRef.current.onerror = null;
          recognitionRef.current.onend = null;
          recognitionRef.current.abort();
        } catch {}
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

  // Tự động giải phóng cờ voice dispatch khi bot đã hoàn tất phản hồi
  useEffect(() => {
    if (!isProcessing) {
      hasDispatchedRef.current = false;
    }
  }, [isProcessing]);

  const dispatchVoiceMessage = (rawText: string) => {
    const textToSend = rawText.trim();
    if (!textToSend || hasDispatchedRef.current || isProcessing) {
      return;
    }
    hasDispatchedRef.current = true;

    if (silenceTimerRef.current) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    latestSpokenTextRef.current = '';
    baseTextRef.current = '';
    setInputText('');
    setIsCountingDown(false);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }

    setIsListening(false);
    if (!isAudioMuted) clinicalAudio.playMicBeep(false);

    onSendMessage(textToSend);
  };

  const stopListening = () => {
    if (silenceTimerRef.current) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    setIsCountingDown(false);
    hasDispatchedRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    setIsListening(false);
    if (!isAudioMuted) clinicalAudio.playMicBeep(false);
  };

  const handleInstantSend = () => {
    const textToSend = (latestSpokenTextRef.current || inputText).trim();
    if (textToSend) {
      if (silenceTimerRef.current) {
        window.clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      if (isListening) {
        stopListening();
      }
      hasDispatchedRef.current = false;
      latestSpokenTextRef.current = '';
      baseTextRef.current = '';
      setInputText('');
      setIsCountingDown(false);
      onSendMessage(textToSend);
    } else {
      stopListening();
    }
  };

  const handleCancelVoice = () => {
    hasDispatchedRef.current = true;
    if (silenceTimerRef.current) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    latestSpokenTextRef.current = '';
    stopListening();
    setInputText(baseTextRef.current);
    setIsCountingDown(false);
  };

  const handleStopKeepText = () => {
    hasDispatchedRef.current = true;
    if (silenceTimerRef.current) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    latestSpokenTextRef.current = '';
    stopListening();
    setIsCountingDown(false);
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
    setIsCountingDown(false);
    hasDispatchedRef.current = false;

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
        try {
          recognitionRef.current.onresult = null;
          recognitionRef.current.onerror = null;
          recognitionRef.current.onend = null;
          recognitionRef.current.abort();
        } catch {}
      }
      const recognition = new SpeechRecognition();
      recognition.lang = 'vi-VN';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      baseTextRef.current = inputText.trim();
      latestSpokenTextRef.current = baseTextRef.current;

      // Cập nhật trạng thái đang lắng nghe ngay lập tức cho người dùng
      setIsListening(true);
      if (!isAudioMuted) clinicalAudio.playMicBeep(true);

      recognition.onstart = () => {
        setIsListening(true);
        setSpeechError(null);
      };

      recognition.onresult = (event: any) => {
        if (hasDispatchedRef.current) return;
        let fullSpoken = '';
        for (let i = 0; i < event.results.length; ++i) {
          fullSpoken += event.results[i][0].transcript;
        }
        const clean = fullSpoken.trim();
        if (clean) {
          const base = baseTextRef.current;
          const merged = base ? `${base} ${clean}` : clean;
          setInputText(merged);
          latestSpokenTextRef.current = merged;

          // Logic Tự động gửi sau 2.0s im lặng nếu người dùng bật autoSendOnSilence
          if (autoSendOnSilence) {
            if (silenceTimerRef.current) {
              window.clearTimeout(silenceTimerRef.current);
            }
            setIsCountingDown(true);
            silenceTimerRef.current = window.setTimeout(() => {
              const textToSend = latestSpokenTextRef.current.trim();
              if (textToSend) {
                dispatchVoiceMessage(textToSend);
              }
            }, 2000);
          }
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
        setIsCountingDown(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        setIsCountingDown(false);
        if (!isAudioMuted) clinicalAudio.playMicBeep(false);

        // Nếu người dùng bật tự gửi, chưa từng dispatch và có nội dung văn bản nói xong
        if (autoSendOnSilence && !hasDispatchedRef.current && latestSpokenTextRef.current.trim()) {
          dispatchVoiceMessage(latestSpokenTextRef.current);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.warn('SpeechRecognition start exception:', err);
      setIsListening(false);
      setIsCountingDown(false);
      void requestMicPermissionDirectly();
    }
  };

  const toggleListening = () => {
    if (isListening) stopListening();
    else void startListening();
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const textToSend = inputText.trim();
    if (!textToSend || isProcessing) return;

    if (silenceTimerRef.current) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (isListening) {
      stopListening();
    }

    hasDispatchedRef.current = false;
    latestSpokenTextRef.current = '';
    baseTextRef.current = '';
    setInputText('');
    setIsCountingDown(false);

    onSendMessage(textToSend);
  };

  return (
    <div className="p-2 sm:p-3 bg-white shrink-0">
      {isListening && (
        <div className="flex flex-wrap items-center justify-between gap-1.5 px-2.5 py-1.5 mb-1.5 bg-rose-50/95 border border-rose-200 rounded-lg text-xs text-rose-800 animate-in fade-in shadow-2xs">
          <div className="flex items-center gap-1.5 font-medium min-w-0">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-600"></span>
            </span>
            <span className="text-2xs sm:text-xs truncate">
              {isCountingDown && autoSendOnSilence ? (
                <span className="inline-flex items-center gap-1 text-rose-800 font-semibold bg-rose-100/90 px-1.5 py-0.5 rounded-sm animate-pulse">
                  <Clock className="w-3 h-3 text-rose-600" />
                  Ngừng nói... Tự gửi sau 2s
                </span>
              ) : (
                'Đang nghe tiếng Việt... Hãy nói câu hỏi'
              )}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0 ml-auto">
            {/* Chế độ tự động gửi sau 2s im lặng */}
            <button
              type="button"
              data-testid="voice-auto-send-toggle"
              onClick={() => {
                const nextVal = !autoSendOnSilence;
                setAutoSendOnSilence(nextVal);
                if (!nextVal && silenceTimerRef.current) {
                  window.clearTimeout(silenceTimerRef.current);
                  silenceTimerRef.current = null;
                  setIsCountingDown(false);
                }
                try {
                  localStorage.setItem('clinical_voice_auto_send', String(nextVal));
                } catch {}
              }}
              className={`text-3xs px-1.5 py-0.5 rounded-sm border transition cursor-pointer font-medium ${
                autoSendOnSilence
                  ? 'bg-rose-100 border-rose-300 text-rose-800 hover:bg-rose-200'
                  : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
              }`}
              title={autoSendOnSilence ? 'Đang bật tự gửi sau 2s im lặng (Bấm để tắt)' : 'Đang tắt tự gửi (Bấm để bật)'}
            >
              Tự gửi: {autoSendOnSilence ? 'Bật (2s)' : 'Tắt'}
            </button>

            {/* Dừng nghe và giữ lại văn bản trong ô nhập để gõ thêm hoặc chỉnh sửa */}
            <button
              type="button"
              data-testid="voice-stop-btn"
              onClick={handleStopKeepText}
              className="text-3xs sm:text-2xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 px-2 py-0.5 rounded-sm transition cursor-pointer"
              title="Dừng thu âm và giữ lại văn bản trong ô nhập để chỉnh sửa"
            >
              Dừng sửa
            </button>

            {/* Gửi ngay lập tức câu hỏi lâm sàng */}
            <button
              type="button"
              data-testid="voice-instant-send-btn"
              onClick={handleInstantSend}
              disabled={isProcessing}
              className="inline-flex items-center gap-1 text-3xs sm:text-2xs font-bold text-white bg-teal-800 hover:bg-teal-900 px-2 py-0.5 rounded-sm shadow-2xs transition cursor-pointer disabled:opacity-50"
              title="Gửi ngay câu hỏi lâm sàng không cần chờ 2 giây"
            >
              <Send className="w-2.5 h-2.5" />
              <span>Gửi ngay</span>
            </button>

            {/* Hủy bỏ hoàn toàn đoạn thu âm vừa nói, trả về nội dung ban đầu */}
            <button
              type="button"
              data-testid="voice-cancel-btn"
              onClick={handleCancelVoice}
              className="text-rose-600 hover:text-rose-900 hover:bg-rose-100 p-1 rounded-sm transition cursor-pointer"
              title="Hủy bỏ đoạn vừa nói (khôi phục văn bản cũ)"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
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
            onChange={(e) => {
              setInputText(e.target.value);
              hasDispatchedRef.current = false;
            }}
            placeholder={isListening ? '🎙️ Đang nghe tiếng Việt... Hãy nói câu hỏi' : 'Nhập câu hỏi hoặc yêu cầu lâm sàng...'}
            className="w-full pl-4 pr-20 sm:pr-24 h-11 sm:h-12 text-sm sm:text-base bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:border-teal-700 focus:bg-white text-slate-900 transition shadow-2xs font-medium"
            disabled={isProcessing}
          />
          <div className="absolute right-1.5 sm:right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 sm:gap-1">
            <button
              type="button"
              data-testid="chat-voice-btn"
              onClick={toggleListening}
              title={isListening ? 'Đang thu âm giọng nói (Bấm để dừng)' : 'Nhập bằng giọng nói (Micro tiếng Việt)'}
              className={`p-1.5 rounded-md transition cursor-pointer ${
                isListening
                  ? 'bg-rose-600 text-white animate-pulse ring-2 ring-rose-300 hover:bg-rose-700'
                  : 'hover:bg-slate-200 text-slate-500 hover:text-slate-800'
              }`}
            >
              {isListening ? <MicOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Mic className="w-4 h-4 sm:w-5 sm:h-5" />}
            </button>
            <button
              type="button"
              onClick={() => setIsImageOpen(true)}
              title="Đính kèm ảnh hiện trường sự cố"
              className="p-1.5 rounded-md hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition cursor-pointer"
            >
              <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={!inputText.trim() || isProcessing}
          className="h-11 w-11 sm:h-12 sm:w-12 rounded-lg bg-teal-800 text-white hover:bg-teal-900 disabled:opacity-40 transition shrink-0 flex items-center justify-center shadow-2xs cursor-pointer active:scale-98"
          title="Gửi yêu cầu"
        >
          <Send className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
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
