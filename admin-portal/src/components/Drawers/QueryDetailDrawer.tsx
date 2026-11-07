import React, { useEffect } from 'react';
import { X, Clock, User, Zap, Database, ShieldAlert, CheckCircle2, Copy, FileText, CornerDownRight } from 'lucide-react';
import { TelemetryEventItem } from '../../types/admin';

interface QueryDetailDrawerProps {
  event: TelemetryEventItem | null;
  onClose: () => void;
}

export const QueryDetailDrawer: React.FC<QueryDetailDrawerProps> = ({ event, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!event) return null;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col z-10 border-l border-slate-200 overflow-hidden animate-in slide-in-from-right duration-300">
        {/* Drawer Header */}
        <div className="px-6 py-4.5 border-b border-slate-200/90 flex items-center justify-between bg-slate-50/70">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-teal-100 text-teal-800">
                {event.event_type}
              </span>
              <span className="text-xs text-slate-400 font-mono">{event.timestamp}</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                event.status === 'blocked' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
              }`}>
                {event.status === 'blocked' ? 'Bị Chặn An Toàn' : 'Phục Vụ Thành Công'}
              </span>
            </div>
            <h2 className="text-base font-bold text-slate-900 mt-1">
              Thanh Tra Truy Vấn Lâm Sàng #{event.id.slice(0, 8)}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
            title="Đóng (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Section 1: Query Prompt */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-teal-700" />
                Câu Hỏi Của Nhân Viên Y Tế ({event.user_role.toUpperCase()})
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard(event.query)}
                className="text-xs text-slate-500 hover:text-teal-800 flex items-center gap-1 cursor-pointer"
                title="Sao chép câu hỏi"
              >
                <Copy className="w-3.5 h-3.5" /> Sao chép
              </button>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 leading-relaxed">
              {event.query}
            </div>
          </div>

          {/* Section 2: AI Clinical Response */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-teal-800 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                Nội Dung Phản Hồi Lâm Sàng Của AI
              </span>
              {event.reply_text && (
                <button
                  type="button"
                  onClick={() => copyToClipboard(event.reply_text || '')}
                  className="text-xs text-slate-500 hover:text-teal-800 flex items-center gap-1 cursor-pointer"
                  title="Sao chép phản hồi"
                >
                  <Copy className="w-3.5 h-3.5" /> Sao chép
                </button>
              )}
            </div>
            <div className="p-4.5 bg-teal-50/40 border border-teal-200/80 rounded-xl text-sm text-slate-800 leading-relaxed max-h-80 overflow-y-auto font-sans whitespace-pre-wrap">
              {event.reply_text || 'Hệ thống tra cứu tức thì từ bảng Dược thư nội viện, không cần sinh văn bản tự do.'}
            </div>
          </div>

          {/* Section 3: Telemetry Metadata */}
          <div className="space-y-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Thông Số Giám Sát & Nguồn Dữ Liệu
            </span>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="text-slate-400 block font-medium">Độ Trễ Phục Vụ</span>
                <span className="text-sm font-bold font-mono text-slate-900">{event.latency_ms} ms</span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="text-slate-400 block font-medium">Tokens Tiêu Thụ</span>
                <span className="text-sm font-bold font-mono text-teal-800">{event.tokens} tokens</span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 col-span-2">
                <span className="text-slate-400 block font-medium">Căn Cứ Dược Điển & Pháp Lý (Grounded Sources)</span>
                <span className="text-xs font-semibold text-slate-800">
                  {event.grounded_source || 'Dược Thư Quốc Gia Việt Nam V · Quyết định 5948/QĐ-BYT · TT 26/2025/TT-BYT'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-slate-200/80 bg-slate-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold transition cursor-pointer"
          >
            Đóng Thanh Tra
          </button>
        </div>
      </div>
    </div>
  );
};
