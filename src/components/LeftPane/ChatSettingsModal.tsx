import React, { useEffect, useState } from 'react';
import { X, Mic, RotateCcw, Trash2, LogOut, User } from 'lucide-react';
import type { ChatbotAvailability } from '../../services/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onKeyUpdated?: () => void;
  availabilityMode?: ChatbotAvailability['mode'] | 'checking';
  onClearMessages?: () => void;
  onClearAllHistory?: () => void;
  currentUserName?: string;
  onLogout?: () => void;
}

export const ChatSettingsModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onClearMessages,
  onClearAllHistory,
  currentUserName,
  onLogout,
}) => {
  const [autoSendVoice, setAutoSendVoice] = useState<boolean>(() => {
    try {
      return localStorage.getItem('clinical_voice_auto_send') !== 'false';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    if (!isOpen) return;
    try {
      setAutoSendVoice(localStorage.getItem('clinical_voice_auto_send') !== 'false');
    } catch {
      // ignore
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const toggleAutoSendVoice = () => {
    const next = !autoSendVoice;
    setAutoSendVoice(next);
    try {
      localStorage.setItem('clinical_voice_auto_send', String(next));
      window.dispatchEvent(new CustomEvent('clinical-voice-auto-send-changed', { detail: next }));
    } catch {
      // ignore
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cài đặt"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="clinical-prose bg-white rounded-2xl shadow-2xl border border-slate-200/90 w-full max-w-md overflow-hidden"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-slate-950 text-[16px]">Cài đặt</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-2 divide-y divide-slate-100 text-[14px] text-slate-800">
          {/* 1. Nhập giọng nói */}
          <div className="py-3.5 flex items-center justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <Mic className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
              <div className="min-w-0">
                <p className="font-medium text-slate-900">Tự động gửi sau khi nói</p>
                <p className="text-[12.5px] text-slate-500 mt-0.5">
                  Tự gửi câu hỏi sau 1 giây ngừng nói
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={autoSendVoice}
              onClick={toggleAutoSendVoice}
              className={`relative inline-flex h-5.5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 ${
                autoSendVoice ? 'bg-teal-700' : 'bg-slate-300'
              }`}
              title={autoSendVoice ? 'Tắt tự động gửi' : 'Bật tự động gửi'}
            >
              <span
                className={`pointer-events-none inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow-xs transition duration-150 ${
                  autoSendVoice ? 'translate-x-4.5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* 2. Làm mới cuộc trò chuyện hiện tại */}
          {onClearMessages && (
            <div className="py-3.5 flex items-center justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <RotateCcw className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">Làm mới đoạn chat hiện tại</p>
                  <p className="text-[12.5px] text-slate-500 mt-0.5">
                    Xóa nội dung trong phiên đang mở
                  </p>
                </div>
              </div>
              <button
                type="button"
                data-testid="chat-clear-btn"
                onClick={() => {
                  onClearMessages();
                  onClose();
                }}
                className="px-3 py-1.5 rounded-lg text-[13px] font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 transition cursor-pointer active:scale-95 shrink-0"
              >
                Làm mới
              </button>
            </div>
          )}

          {/* 3. Xóa toàn bộ lịch sử */}
          {onClearAllHistory && (
            <div className="py-3.5 flex items-center justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <Trash2 className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">Xóa toàn bộ lịch sử</p>
                  <p className="text-[12.5px] text-slate-500 mt-0.5">
                    Xóa vĩnh viễn tất cả các cuộc trò chuyện
                  </p>
                </div>
              </div>
              <button
                type="button"
                data-testid="chat-clear-all-history-btn"
                onClick={() => {
                  onClearAllHistory();
                  onClose();
                }}
                className="px-3 py-1.5 rounded-lg text-[13px] font-medium text-rose-700 bg-rose-50/70 hover:bg-rose-100 border border-rose-200/80 transition cursor-pointer active:scale-95 shrink-0"
              >
                Xóa tất cả
              </button>
            </div>
          )}

          {/* 4. Tài khoản & Đăng xuất (trên Mobile) */}
          {onLogout && (
            <div className="py-3.5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <User className="h-4 w-4 shrink-0 text-slate-500" />
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 truncate">
                    {currentUserName || 'Tài khoản hiện tại'}
                  </p>
                  <p className="text-[12.5px] text-slate-500">Đăng xuất khỏi thiết bị này</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onLogout();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-slate-700 bg-white hover:bg-rose-50 hover:text-rose-700 border border-slate-200 hover:border-rose-200 transition cursor-pointer active:scale-95 shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Đăng xuất</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
