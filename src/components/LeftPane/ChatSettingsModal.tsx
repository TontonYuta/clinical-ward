import React from 'react';
import { X, Sparkles, ShieldCheck } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onKeyUpdated?: () => void;
}

export const ChatSettingsModal: React.FC<Props> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div role="dialog" aria-modal="true" aria-label="Cấu hình AI" className="clinical-modal-overlay fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/90 w-full max-w-md overflow-hidden">
        <div className="px-5 py-3.5 bg-white border-b border-slate-200/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-teal-800 text-white flex items-center justify-center"><Sparkles className="w-4 h-4" /></div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Cấu hình trợ lý AI</h3>
              <p className="text-2xs text-slate-500">Quản lý tập trung tại máy chủ</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Đóng" className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 text-sm text-slate-700">
          <div className="flex items-start gap-3 rounded-xl border border-teal-200 bg-teal-50 p-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" />
            <p>Chatbot gửi câu hỏi đến backend. Khóa Gemini được giữ ở máy chủ; không nhập hoặc lưu khóa trong trình duyệt.</p>
          </div>
          <p className="mt-3 text-xs text-slate-500">Câu trả lời lâm sàng dùng dữ liệu nội bộ/RAG và hiển thị nguồn khi có.</p>
        </div>
      </div>
    </div>
  );
};
