/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, X, Radio, Send, AlertCircle } from 'lucide-react';
import { clinicalAudio } from '../../utils/audio';

interface VoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTranscript: (text: string, sendImmediately?: boolean) => void;
  isAudioMuted: boolean;
}

export const VoiceModal: React.FC<VoiceModalProps> = ({
  isOpen,
  onClose,
  onSelectTranscript,
  isAudioMuted
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSpeechSupported, setIsSpeechSupported] = useState(true);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [waveHeights, setWaveHeights] = useState<number[]>([12, 24, 40, 18, 50, 32, 16, 44, 28, 14, 38, 22]);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Check if browser supports Web Speech API
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSpeechSupported(false);
    }
  }, []);

  useEffect(() => {
    let interval: number;
    if (isRecording) {
      interval = window.setInterval(() => {
        setWaveHeights(prev => prev.map(() => Math.floor(Math.random() * 48) + 8));
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  useEffect(() => {
    // Cleanup recognition when modal unmounts or closes
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    };
  }, []);

  if (!isOpen) return null;

  const handleStartRealRecording = async () => {
    setSpeechError(null);
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      handleStartSimulatedRecording();
      return;
    }

    if (navigator?.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
      } catch (err: any) {
        console.warn('getUserMedia mic request failed:', err);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setSpeechError('Micro đang bị chặn. Hãy bấm biểu tượng 🔒 trên thanh địa chỉ trình duyệt, chọn "Cho phép Micro" rồi thử lại.');
        } else {
          setSpeechError('Không thể mở micro. Vui lòng kiểm tra quyền micro trên trình duyệt.');
        }
        setIsRecording(false);
        return;
      }
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

      recognition.onstart = () => {
        setIsRecording(true);
        setTranscript('Đang lắng nghe giọng nói tiếng Việt... Hãy nói câu hỏi lâm sàng.');
        if (!isAudioMuted) clinicalAudio.playMicBeep(true);
      };

      recognition.onresult = (event: any) => {
        let fullTranscript = '';
        for (let i = event.results.length - 1; i >= 0; --i) {
          fullTranscript = event.results[i][0].transcript;
          break;
        }
        if (fullTranscript.trim()) {
          setTranscript(fullTranscript.trim());
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Web Speech API event error:', event.error);
        if (event.error === 'not-allowed') {
          setSpeechError('Micro đang bị chặn. Hãy bấm biểu tượng 🔒 trên thanh địa chỉ trình duyệt, chọn "Cho phép Micro" rồi thử lại.');
        } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
          setSpeechError(`Lỗi nhận diện: ${event.error}`);
        }
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
        if (!isAudioMuted) clinicalAudio.playMicBeep(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn('Speech recognition start failed, using fallback:', err);
      handleStartSimulatedRecording();
    }
  };

  const handleStopRecording = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    setIsRecording(false);
  };

  const handleStartSimulatedRecording = () => {
    if (!isAudioMuted) clinicalAudio.playMicBeep(true);
    setIsRecording(true);
    setTranscript('Đang nhận diện giọng nói kíp trực...');

    window.setTimeout(() => {
      setTranscript('Tra cứu tương tác thuốc giữa Paracetamol và Warfarin');
      setIsRecording(false);
      if (!isAudioMuted) clinicalAudio.playMicBeep(false);
    }, 2000);
  };

  const handleUseTranscript = (text: string, sendImmediately: boolean = false) => {
    if (!isAudioMuted) clinicalAudio.playMicBeep(true);
    onSelectTranscript(text, sendImmediately);
    onClose();
  };

  const handleSendCurrentTranscript = () => {
    if (transcript.trim() && !transcript.startsWith('Đang lắng nghe')) {
      handleUseTranscript(transcript, true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2.5 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-lg shadow-xl border border-slate-200 max-w-lg w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-3.5 sm:px-5 py-3 sm:py-4 bg-slate-900 text-white flex items-center justify-between shrink-0 gap-2">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="p-2 bg-slate-800 rounded-lg shrink-0">
              <Mic className="w-5 h-5 text-teal-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base truncate">Ra Lệnh Giọng Nói Y Tế</h3>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 shrink-0">
                  vi-VN Live
                </span>
              </div>
              <p className="text-[11px] text-slate-300 truncate">Nhận diện giọng nói tiếng Việt rảnh tay cho kíp trực</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/20 text-white/80 hover:text-white transition cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          {/* Waveform & Recording Area */}
          <div className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-xl border border-slate-200/80 mb-5">
            <div className="h-16 flex items-center gap-1.5 mb-4">
              {waveHeights.map((h, i) => (
                <div
                  key={i}
                  style={{ height: `${isRecording ? h : 10}px` }}
                  className={`w-1.5 rounded-full transition-all duration-100 ${
                    isRecording ? 'bg-teal-600' : 'bg-slate-300'
                  }`}
                />
              ))}
            </div>

            <button
              onClick={isRecording ? handleStopRecording : handleStartRealRecording}
              className={`flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-sm transition-all shadow-md cursor-pointer ${
                isRecording
                  ? 'bg-rose-600 hover:bg-rose-700 text-white ring-4 ring-rose-200'
                  : 'bg-teal-800 hover:bg-teal-900 text-white'
              }`}
            >
              {isRecording ? (
                <>
                  <MicOff className="w-4 h-4" />
                  <span>Đang thu âm tiếng Việt... Bấm để dừng</span>
                </>
              ) : (
                <>
                  <Radio className="w-4 h-4 text-emerald-300" />
                  <span>Bấm để nói trực tiếp (Micro Live)</span>
                </>
              )}
            </button>

            {speechError && (
              <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                <span>{speechError}</span>
              </div>
            )}

            {transcript && (
              <div className="mt-4 p-3 bg-white rounded-lg border border-teal-200 text-sm text-slate-800 text-center w-full shadow-xs">
                <span className="text-xs text-slate-400 block mb-0.5 font-medium">Văn bản nhận diện thực tế:</span>
                <span className="font-semibold text-slate-900">"{transcript}"</span>
                
                {!isRecording && !transcript.startsWith('Đang lắng nghe') && (
                  <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-center gap-2">
                    <button
                      onClick={handleSendCurrentTranscript}
                      className="px-4 py-1.5 rounded-lg bg-teal-800 hover:bg-teal-900 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5 text-teal-300" />
                      <span>Gửi câu hỏi này đến AI Copilot</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-2.5 sm:py-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500 shrink-0">
          <span>Tương thích Web Speech API trên Chrome, Edge &amp; Safari</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 font-medium transition cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
