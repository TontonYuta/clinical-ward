/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Thanh Nhập Liệu Chatbot Lâm Sàng - Nhập giọng nói tiếng Việt trực tiếp (<=120 LOC)
 */

import React, { useState, useRef, useEffect } from 'react';
import { Send, ArrowUp, Square, Mic, MicOff, Image as ImageIcon, AlertCircle, Clock, X, Globe } from 'lucide-react';
import { QuickSuggestionChip } from '../../types/clinical';
import { ImageModal } from '../Modals/ImageModal';
import { clinicalAudio } from '../../utils/audio';
import { getClipboardImageFile } from '../../utils/clipboardImage';

const VOICE_SILENCE_DELAY_MS = 1000;

interface ChatInputBarProps {
  onSendMessage: (text: string, attachment?: any, enableWebSearch?: boolean) => void;
  onStopGenerating?: () => void;
  suggestionChips?: QuickSuggestionChip[];
  isProcessing: boolean;
  isAudioMuted: boolean;
  onChipClick?: (chipOrText: string | QuickSuggestionChip) => void;
  compact?: boolean;
}

export const ChatInputBar: React.FC<ChatInputBarProps> = ({
  onSendMessage,
  onStopGenerating,
  isProcessing,
  isAudioMuted,
  compact = false,
}) => {
  const [inputText, setInputText] = useState('');
  const [clipboardImage, setClipboardImage] = useState<File | null>(null);
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
  const [isMicWarmingUp, setIsMicWarmingUp] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [liveInterimSnippet, setLiveInterimSnippet] = useState('');
  const [isWebSearchActive, setIsWebSearchActive] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        return localStorage.getItem('copilot_enable_web_search') === 'true';
      } catch {}
    }
    return false;
  });

  const toggleWebSearch = () => {
    setIsWebSearchActive(prev => {
      const next = !prev;
      try {
        localStorage.setItem('copilot_enable_web_search', String(next));
        window.dispatchEvent(new CustomEvent('copilot-web-search-changed', { detail: next }));
      } catch {}
      return next;
    });
  };

  useEffect(() => {
    const handleSync = (e: Event) => {
      const detail = (e as CustomEvent<boolean>).detail;
      if (typeof detail === 'boolean') {
        setIsWebSearchActive(detail);
      }
    };
    const handleVoiceSync = (e: Event) => {
      const detail = (e as CustomEvent<boolean>).detail;
      if (typeof detail === 'boolean') {
        setAutoSendOnSilence(detail);
      }
    };
    window.addEventListener('copilot-web-search-changed', handleSync);
    window.addEventListener('clinical-voice-auto-send-changed', handleVoiceSync);
    return () => {
      window.removeEventListener('copilot-web-search-changed', handleSync);
      window.removeEventListener('clinical-voice-auto-send-changed', handleVoiceSync);
    };
  }, []);

  const inputFieldRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const baseTextRef = useRef<string>('');
  const latestSpokenTextRef = useRef<string>('');
  const silenceTimerRef = useRef<number | null>(null);
  const hasDispatchedRef = useRef<boolean>(false);

  // Tự động giãn chiều cao textarea mượt mà theo số dòng (tối đa 144px)
  useEffect(() => {
    const el = inputFieldRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const nextHeight = Math.min(el.scrollHeight, 144);
    el.style.height = `${Math.max(nextHeight, 24)}px`;
  }, [inputText]);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      if (isProcessing) return;
      const file = event.clipboardData ? getClipboardImageFile(event.clipboardData.items) : null;
      if (!file) return;
      event.preventDefault();
      setClipboardImage(file);
      setIsImageOpen(true);
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isProcessing]);

  const scheduleVoiceDispatch = () => {
    if (!autoSendOnSilence || hasDispatchedRef.current || !latestSpokenTextRef.current.trim()) return;
    if (silenceTimerRef.current) window.clearTimeout(silenceTimerRef.current);
    setIsCountingDown(true);
    silenceTimerRef.current = window.setTimeout(() => {
      silenceTimerRef.current = null;
      const textToSend = latestSpokenTextRef.current.trim();
      if (textToSend) dispatchVoiceMessage(textToSend);
    }, VOICE_SILENCE_DELAY_MS);
  };

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
    setIsMicWarmingUp(false);
    setIsUserSpeaking(false);
    setLiveInterimSnippet('');

    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.onspeechstart = null;
        recognitionRef.current.onspeechend = null;
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }

    setIsListening(false);
    if (!isAudioMuted) clinicalAudio.playMicBeep(false);

    onSendMessage(textToSend, undefined, isWebSearchActive);
  };

  const stopListening = () => {
    if (silenceTimerRef.current) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    setIsCountingDown(false);
    setIsMicWarmingUp(false);
    setIsUserSpeaking(false);
    setLiveInterimSnippet('');
    hasDispatchedRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.onspeechstart = null;
        recognitionRef.current.onspeechend = null;
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
      setIsMicWarmingUp(false);
      setIsUserSpeaking(false);
      setLiveInterimSnippet('');
      onSendMessage(textToSend, undefined, isWebSearchActive);
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
    setIsMicWarmingUp(false);
    setIsUserSpeaking(false);
    setLiveInterimSnippet('');
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
    setIsMicWarmingUp(false);
    setIsUserSpeaking(false);
    setLiveInterimSnippet('');
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
    setLiveInterimSnippet('');
    setIsUserSpeaking(false);

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
          recognitionRef.current.onspeechstart = null;
          recognitionRef.current.onspeechend = null;
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

      // Đánh dấu đang kích hoạt micro và chờ luồng phần cứng sẵn sàng
      setIsListening(true);
      setIsMicWarmingUp(true);

      recognition.onstart = () => {
        setIsListening(true);
        setIsMicWarmingUp(false);
        setSpeechError(null);
        // Chỉ phát âm báo khi micro đã thực sự mở kết nối và sẵn sàng thu âm
        if (!isAudioMuted) clinicalAudio.playMicBeep(true);
      };

      recognition.onspeechstart = () => {
        setIsUserSpeaking(true);
        // Hủy đếm ngược ngay lập tức khi phát hiện người dùng tiếp tục nói
        if (silenceTimerRef.current) {
          window.clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
        setIsCountingDown(false);
      };

      recognition.onspeechend = () => {
        setIsUserSpeaking(false);
        scheduleVoiceDispatch();
      };

      recognition.onresult = (event: any) => {
        if (hasDispatchedRef.current) return;

        const finalParts: string[] = [];
        const interimParts: string[] = [];

        for (let i = 0; i < event.results.length; ++i) {
          const res = event.results[i];
          const text = (res[0]?.transcript || '').trim();
          if (!text) continue;
          if (res.isFinal) {
            finalParts.push(text);
          } else {
            interimParts.push(text);
          }
        }

        const finalChunk = finalParts.join(' ');
        const interimChunk = interimParts.join(' ');

        // Transcript hiển thị trong input; thanh trạng thái mic chỉ báo trạng thái.
        setLiveInterimSnippet('');
        if (interimChunk) setIsUserSpeaking(true);

        const fullSpoken = [finalChunk, interimChunk].filter(Boolean).join(' ').trim();
        {
          const base = baseTextRef.current;
          const merged = [base, fullSpoken].filter(Boolean).join(' ');
          setInputText(merged);
          latestSpokenTextRef.current = merged;

          // Tự động cuộn ô nhập liệu để từ mới nói luôn nằm trong tầm mắt
          if (inputFieldRef.current) {
            inputFieldRef.current.scrollLeft = inputFieldRef.current.scrollWidth;
          }

          // Một timer dùng chung; kết quả cuối mới được phép khởi động tự gửi.
          if (autoSendOnSilence && fullSpoken) {
            if (silenceTimerRef.current) {
              window.clearTimeout(silenceTimerRef.current);
              silenceTimerRef.current = null;
            }

            // Nếu người dùng đang nói dở câu (có interim text), KHÔNG đếm ngược
            if (interimChunk) {
              setIsCountingDown(false);
            } else {
              scheduleVoiceDispatch();
            }
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
        setIsMicWarmingUp(false);
        setIsUserSpeaking(false);
        setIsCountingDown(false);
        setLiveInterimSnippet('');
      };

      recognition.onend = () => {
        setIsListening(false);
        setIsMicWarmingUp(false);
        setIsUserSpeaking(false);
        setIsCountingDown(false);
        setLiveInterimSnippet('');
        if (!isAudioMuted) clinicalAudio.playMicBeep(false);

        // onend không gửi trực tiếp: dùng cùng một khoảng im lặng với mọi event.
        scheduleVoiceDispatch();
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.warn('SpeechRecognition start exception:', err);
      setIsListening(false);
      setIsMicWarmingUp(false);
      setIsUserSpeaking(false);
      setIsCountingDown(false);
      setLiveInterimSnippet('');
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

    onSendMessage(textToSend, undefined, isWebSearchActive);
  };

  return (
    <div className={`${compact ? 'px-2.5 py-2' : 'p-2 sm:p-3'} bg-white shrink-0`}>
      {isListening && (
        <div className="flex flex-wrap items-center justify-between gap-1.5 px-2.5 py-1.5 mb-1.5 bg-rose-50/95 border border-rose-200 rounded-lg text-xs text-rose-800 animate-in fade-in shadow-2xs">
          <div className="flex items-center gap-2 font-medium min-w-0 max-w-[65%]">
            {isMicWarmingUp ? (
              <div className="flex items-center gap-1.5 text-amber-700">
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-600"></span>
                </span>
                <span className="text-2xs sm:text-xs font-semibold">Đang kết nối Micro...</span>
              </div>
            ) : isUserSpeaking ? (
              <div className="flex items-center gap-1.5 min-w-0">
                {/* 4 thanh sóng âm mô phỏng live audio stream */}
                <div className="flex items-end gap-0.5 h-3.5 shrink-0" aria-label="Sóng âm thanh">
                  <span className="w-1 bg-teal-600 rounded-full animate-[pulse_0.6s_ease-in-out_infinite] h-3.5"></span>
                  <span className="w-1 bg-teal-500 rounded-full animate-[pulse_0.4s_ease-in-out_infinite] h-2"></span>
                  <span className="w-1 bg-teal-700 rounded-full animate-[pulse_0.7s_ease-in-out_infinite] h-3"></span>
                  <span className="w-1 bg-teal-500 rounded-full animate-[pulse_0.5s_ease-in-out_infinite] h-2.5"></span>
                </div>
                <span className="text-2xs sm:text-xs truncate text-teal-900 font-medium">Đang nhận giọng nói...</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-600"></span>
                </span>
                <span className="text-2xs sm:text-xs truncate">
                  {isCountingDown && autoSendOnSilence ? (
                    <span className="inline-flex items-center gap-1 text-rose-800 font-semibold bg-rose-100/90 px-1.5 py-0.5 rounded-sm animate-pulse">
                      <Clock className="w-3 h-3 text-rose-600" />
                      Ngừng nói... Tự gửi sau 1s
                    </span>
                  ) : (
                    'Đang nghe tiếng Việt... Hãy nói câu hỏi'
                  )}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0 ml-auto">
            {/* Chế độ tự động gửi sau 1s im lặng */}
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
              title={autoSendOnSilence ? 'Đang bật tự gửi sau 1s im lặng (Bấm để tắt)' : 'Đang tắt tự gửi (Bấm để bật)'}
            >
              Tự gửi: {autoSendOnSilence ? 'Bật (1s)' : 'Tắt'}
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
              title="Gửi ngay câu hỏi lâm sàng không cần chờ thời gian im lặng"
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

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-200/95 bg-white shadow-xs focus-within:border-slate-400/90 focus-within:shadow-sm transition-all duration-150"
      >
        <div className={compact ? 'px-3 pt-2 pb-0.5' : 'px-3.5 pt-2.5 pb-1'}>
          <textarea
            ref={inputFieldRef}
            data-testid="chat-input-field"
            rows={1}
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value);
              hasDispatchedRef.current = false;
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder={isListening ? 'Đang nghe tiếng Việt... Hãy nói câu hỏi' : 'Hỏi thông tin thuốc hoặc ca lâm sàng...'}
            className={`w-full resize-none bg-transparent ${compact ? 'text-[14px]' : 'text-sm sm:text-[15px]'} leading-relaxed text-slate-900 placeholder:text-slate-400 focus:outline-hidden max-h-36 overflow-y-auto`}
          />
        </div>

        <div className={`flex items-center justify-between gap-2 ${compact ? 'px-2 pb-1.5 pt-0.5' : 'px-2.5 pb-2 pt-0.5'}`}>
          <div className="flex items-center gap-1">
            <button
              type="button"
              data-testid="chat-web-search-toggle-btn"
              onClick={toggleWebSearch}
              aria-pressed={isWebSearchActive}
              title={isWebSearchActive ? 'Đang tìm kiếm trên Internet (Bấm để tắt)' : 'Tìm kiếm thêm trên Internet'}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-colors duration-150 cursor-pointer select-none ${
                isWebSearchActive
                  ? 'bg-sky-50 text-sky-700 border border-sky-200/90 font-semibold hover:bg-sky-100/80'
                  : 'text-slate-500 border border-transparent font-medium hover:bg-slate-100 hover:text-slate-800'
              }`}
            >
              <Globe className={`w-3.5 h-3.5 shrink-0 ${isWebSearchActive ? 'text-sky-600' : 'text-slate-400'}`} />
              <span>Tìm kiếm</span>
            </button>

            <button
              type="button"
              data-testid="chat-attach-image-btn"
              onClick={() => setIsImageOpen(true)}
              title="Đính kèm ảnh đơn thuốc hoặc hình ảnh sự cố"
              className="p-1.5 rounded-full text-slate-500 hover:bg-slate-200/70 hover:text-slate-800 transition-colors duration-150 cursor-pointer"
              aria-label="Đính kèm ảnh"
            >
              <ImageIcon className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isProcessing && onStopGenerating ? (
              <button
                type="button"
                data-testid="chat-stop-btn"
                onClick={onStopGenerating}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-slate-900 text-white hover:bg-slate-800 text-xs font-semibold transition cursor-pointer active:scale-95"
                title="Dừng tạo câu trả lời"
                aria-label="Dừng tạo câu trả lời"
              >
                <Square className="w-3 h-3 fill-current" />
                <span>Dừng</span>
              </button>
            ) : inputText.trim().length > 0 ? (
              <button
                type="submit"
                data-testid="chat-send-btn"
                disabled={isProcessing}
                className="h-8 w-8 rounded-full bg-teal-800 text-white hover:bg-teal-900 disabled:bg-slate-200 disabled:text-slate-400 transition flex items-center justify-center cursor-pointer active:scale-95 disabled:cursor-not-allowed"
                title="Gửi câu hỏi (Enter)"
                aria-label="Gửi câu hỏi"
              >
                <ArrowUp className="w-4 h-4 stroke-[2.25]" />
              </button>
            ) : (
              <button
                type="button"
                data-testid="chat-voice-btn"
                onClick={toggleListening}
                title={isListening ? 'Đang thu âm giọng nói (Bấm để dừng)' : 'Nhập bằng giọng nói (Micro tiếng Việt)'}
                className={`h-8 w-8 rounded-full transition flex items-center justify-center cursor-pointer active:scale-95 ${
                  isListening
                    ? 'bg-rose-600 text-white hover:bg-rose-700'
                    : 'bg-slate-900 text-white hover:bg-slate-800'
                }`}
                aria-label={isListening ? 'Dừng thu âm' : 'Nhập bằng giọng nói'}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>
      </form>

      <ImageModal
        isOpen={isImageOpen}
        onClose={() => setIsImageOpen(false)}
        initialFile={clipboardImage}
        onInitialFileConsumed={() => setClipboardImage(null)}
        onSendImage={(payload) => {
          onSendMessage(payload.prompt, {
            type: 'image',
            title: payload.title,
            description: `Ảnh đính kèm: ${payload.title} (${payload.fileSizeKb} KB)`,
            url: payload.previewUrl,
            imageBase64: payload.imageBase64,
            mimeType: payload.imageMimeType
          });
        }}
      />
    </div>
  );
};
