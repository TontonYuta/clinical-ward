import React, { useEffect, useState } from 'react';
import { X, Sparkles, ShieldCheck, Globe, Cpu, RotateCcw, Trash2, LogOut, User } from 'lucide-react';
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
  availabilityMode = 'online_ai',
  onClearMessages,
  onClearAllHistory,
  currentUserName,
  onLogout,
}) => {
  const [isWebSearchEnabled, setIsWebSearchEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('copilot_enable_web_search') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!isOpen) return;
    try {
      setIsWebSearchEnabled(localStorage.getItem('copilot_enable_web_search') === 'true');
    } catch {
      // ignore
    }
  }, [isOpen]);

  const toggleWebSearch = () => {
    const next = !isWebSearchEnabled;
    setIsWebSearchEnabled(next);
    try {
      localStorage.setItem('copilot_enable_web_search', String(next));
      window.dispatchEvent(new CustomEvent('copilot-web-search-changed', { detail: next }));
    } catch {
      // ignore
    }
  };

  if (!isOpen) return null;

  const isGeminiOnline = availabilityMode === 'online_ai';
  const isChecking = availabilityMode === 'checking';

  return (
    <div role="dialog" aria-modal="true" aria-label="Cấu hình AI" className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/90 w-full max-w-md overflow-hidden">
        <div className="px-5 py-3.5 bg-white border-b border-slate-200/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-teal-800 text-white flex items-center justify-center"><Sparkles className="w-4 h-4" /></div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Cấu hình trợ lý AI</h3>
              <p className="text-2xs text-slate-500">Quản lý trạng thái Online & tìm kiếm tách biệt</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Đóng" className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-3 text-sm text-slate-700">
          {/* 1. Trạng thái Gemini Cloud / Cục bộ */}
          <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
            <div className="flex items-start gap-2.5 min-w-0">
              <Cpu className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" />
              <div className="min-w-0">
                <p className="font-semibold text-slate-900 text-xs sm:text-sm">AI Suy luận (Gemini Cloud)</p>
                <p className="text-xs text-slate-500">Tổng hợp lâm sàng & RAG nội bộ</p>
              </div>
            </div>
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold shrink-0 ${
              isChecking
                ? 'bg-slate-100 text-slate-600 border border-slate-200'
                : isGeminiOnline
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-sky-50 text-sky-700 border border-sky-200'
            }`}>
              {isChecking ? 'Đang kiểm tra...' : isGeminiOnline ? '🟢 Online' : '🔵 Cục bộ'}
            </span>
          </div>

          {/* 2. Trạng thái & Công tắc Web Search (Serper / DuckDuckGo) */}
          <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
            <div className="flex items-start gap-2.5 min-w-0">
              <Globe className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" />
              <div className="min-w-0">
                <p className="font-semibold text-slate-900 text-xs sm:text-sm">Tìm kiếm Internet (Serper)</p>
                <p className="text-xs text-slate-500">
                  {isWebSearchEnabled
                    ? 'Đang bật — Tra cứu web thời gian thực & trích nguồn'
                    : 'Đang tắt — Chỉ dùng Dược Thư Quốc Gia & KB nội bộ'}
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isWebSearchEnabled}
              onClick={toggleWebSearch}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                isWebSearchEnabled ? 'bg-teal-600' : 'bg-slate-300'
              }`}
              title={isWebSearchEnabled ? 'Tắt Web Search' : 'Bật Web Search'}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
                  isWebSearchEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* 3. Quản lý phiên & Lịch sử */}
          {(onClearMessages || onClearAllHistory) && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2">
              <p className="font-semibold text-slate-900 text-xs sm:text-sm">Quản lý phiên &amp; Lịch sử</p>
              <div className="flex flex-col sm:flex-row gap-2">
                {onClearMessages && (
                  <button
                    type="button"
                    data-testid="chat-clear-btn"
                    onClick={() => {
                      onClearMessages();
                      onClose();
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 transition cursor-pointer active:scale-95"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-teal-700" />
                    <span>Làm mới phiên hội thoại</span>
                  </button>
                )}
                {onClearAllHistory && (
                  <button
                    type="button"
                    data-testid="chat-clear-all-history-btn"
                    onClick={() => {
                      onClearAllHistory();
                      onClose();
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition cursor-pointer active:scale-95"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa lịch sử chatbot</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 4. Tài khoản & Đăng xuất (trên Mobile) */}
          {onLogout && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
              <div className="flex items-center gap-2 min-w-0">
                <User className="h-4 w-4 shrink-0 text-slate-600" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900 truncate">{currentUserName || 'Tài khoản hiện tại'}</p>
                  <p className="text-[11px] text-slate-500">Phiên bản di động</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onLogout();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-white hover:bg-rose-50 hover:text-rose-700 border border-slate-300 hover:border-rose-200 transition cursor-pointer active:scale-95 shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Đăng xuất</span>
              </button>
            </div>
          )}

          {/* 5. Ghi chú bảo mật */}
          <div className="flex items-start gap-3 rounded-xl border border-teal-200 bg-teal-50 p-3.5 text-xs text-slate-700">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" />
            <p>Khóa API Gemini &amp; Serper được lưu tập trung và mã hóa ở máy chủ; không lưu khóa trên trình duyệt.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
