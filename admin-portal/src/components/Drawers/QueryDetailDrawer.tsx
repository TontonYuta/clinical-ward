import React, { useEffect, useState } from 'react';
import { X, Clock, User, Zap, Database, ShieldAlert, CheckCircle2, Copy, FileText, CornerDownRight, Cpu, Image as ImageIcon, Layers, DollarSign } from 'lucide-react';
import { TelemetryEventItem } from '../../types/admin';

interface QueryDetailDrawerProps {
  event: TelemetryEventItem | null;
  onClose: () => void;
}

export const QueryDetailDrawer: React.FC<QueryDetailDrawerProps> = ({ event, onClose }) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!event) return null;

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1800);
  };

  const pTokens = event.prompt_tokens || Math.max(15, Math.floor(event.query.length / 3));
  const cTokens = event.completion_tokens || Math.max(25, Math.floor((event.reply_text || '').length / 3));
  const imgTokens = event.has_image ? (event.image_tokens || 258) : 0;
  const totTokens = event.total_tokens || event.tokens || (pTokens + cTokens);
  const costVnd = Math.round((((pTokens / 1_000_000) * 0.075 + (cTokens / 1_000_000) * 0.30) * 25500) * 100) / 100;

  const pPct = totTokens > 0 ? Math.round((pTokens / totTokens) * 100) : 50;
  const imgPct = (totTokens > 0 && imgTokens > 0) ? Math.round((imgTokens / totTokens) * 100) : 0;
  const cPct = Math.max(0, 100 - pPct - imgPct);

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
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono font-bold text-slate-800">
                {event.event_type}
              </span>
              <span className="text-xs text-slate-500 font-mono" title={event.created_at_full || `${event.timestamp} · ${event.created_at_date || ''}`}>
                · {event.timestamp} {event.created_at_date ? `· ${event.created_at_date}` : ''}
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-medium font-mono">
                <span className={`w-1.5 h-1.5 rounded-full ${event.status === 'blocked' ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                <span className={event.status === 'blocked' ? 'text-rose-600' : 'text-slate-700'}>
                  {event.status === 'blocked' ? 'Bị Chặn An Toàn' : 'Thành Công'}
                </span>
              </span>
              {event.has_image && (
                <span className="text-xs text-slate-500 font-mono">
                  · 📷 Vision
                </span>
              )}
            </div>
            <h2 className="text-base font-bold text-slate-900 mt-1">
              Thanh Tra Truy Vấn &amp; Phân Bổ Token #{event.id.slice(0, 10)}
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
          {/* Card Phân Bổ Token Độc Quyền */}
          <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                Model: <strong className="font-mono text-slate-900 font-semibold ml-1">{event.model_name || 'gemini-3.5-flash-lite'}</strong>
              </span>
              <span className="text-2xs font-mono text-slate-400">
                Provider: {event.provider || 'gemini'}
              </span>
            </div>

            {/* Thanh Tỷ Lệ Token Bar */}
            <div className="space-y-1.5">
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex">
                <div style={{ width: `${pPct}%` }} className="bg-slate-400 h-full" title={`Input Prompt: ${pPct}%`} />
                {imgTokens > 0 && (
                  <div style={{ width: `${imgPct}%` }} className="bg-slate-500 h-full" title={`Image Vision: ${imgPct}%`} />
                )}
                <div style={{ width: `${cPct}%` }} className="bg-teal-700 h-full" title={`Output Completion: ${cPct}%`} />
              </div>
              <div className="flex items-center justify-between text-2xs text-slate-500 font-mono">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block" /> Prompt: {pTokens} tok ({pPct}%)
                </span>
                {imgTokens > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-500 inline-block" /> Ảnh: {imgTokens} tok
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-700 inline-block" /> Output: {cTokens} tok ({cPct}%)
                </span>
              </div>
            </div>

            {/* Grid 4 Thống Kê Token */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
              <div className="p-2.5 bg-slate-50/60 border border-slate-200 rounded-lg">
                <span className="text-3xs font-medium text-slate-400 uppercase tracking-wider block">Prompt Input</span>
                <span className="text-sm font-bold font-mono text-slate-900 mt-0.5 block">{pTokens.toLocaleString()}</span>
              </div>
              <div className="p-2.5 bg-slate-50/60 border border-slate-200 rounded-lg">
                <span className="text-3xs font-medium text-slate-400 uppercase tracking-wider block">Ảnh Vision</span>
                <span className="text-sm font-bold font-mono text-slate-900 mt-0.5 block">
                  {imgTokens > 0 ? `${imgTokens} tok` : '0 tok'}
                </span>
              </div>
              <div className="p-2.5 bg-slate-50/60 border border-slate-200 rounded-lg">
                <span className="text-3xs font-medium text-slate-400 uppercase tracking-wider block">Output Sinh Ra</span>
                <span className="text-sm font-bold font-mono text-slate-900 mt-0.5 block">{cTokens.toLocaleString()}</span>
              </div>
              <div className="p-2.5 bg-slate-50/60 border border-slate-200 rounded-lg">
                <span className="text-3xs font-medium text-slate-400 uppercase tracking-wider block">Tổng Token &amp; Giá</span>
                <span className="text-sm font-bold font-mono text-slate-900 mt-0.5 block">
                  {totTokens.toLocaleString()} <span className="text-3xs font-normal text-slate-400">({costVnd} đ)</span>
                </span>
              </div>
            </div>
          </div>

          {/* Section 1: Query Prompt */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-teal-700" />
                Câu Hỏi / Yêu Cầu Của ({event.user_role.toUpperCase()})
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard(event.query, 'query')}
                className={`text-xs flex items-center gap-1 cursor-pointer transition ${
                  copiedField === 'query' ? 'text-emerald-700 font-semibold' : 'text-slate-500 hover:text-teal-800'
                }`}
                title="Sao chép câu hỏi"
              >
                {copiedField === 'query' ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Đã sao chép!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" /> Sao chép
                  </>
                )}
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
                  onClick={() => copyToClipboard(event.reply_text || '', 'reply')}
                  className={`text-xs flex items-center gap-1 cursor-pointer transition ${
                    copiedField === 'reply' ? 'text-emerald-700 font-semibold' : 'text-slate-500 hover:text-teal-800'
                  }`}
                  title="Sao chép phản hồi"
                >
                  {copiedField === 'reply' ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Đã sao chép!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Sao chép
                    </>
                  )}
                </button>
              )}
            </div>
            <div className="p-4 bg-slate-50/70 border border-slate-200 rounded-xl text-sm text-slate-800 leading-relaxed max-h-80 overflow-y-auto font-sans whitespace-pre-wrap">
              {event.reply_text || 'Hệ thống tra cứu tức thì từ bảng Dược thư nội viện, không cần sinh văn bản tự do.'}
            </div>
          </div>

          {/* Section 3: Telemetry Metadata */}
          <div className="space-y-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Thông Số Giám Sát &amp; Nguồn Dữ Liệu
            </span>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="text-slate-400 block font-medium">Thời Gian Ghi Nhận (GMT+7)</span>
                <span className="text-xs font-bold font-mono text-slate-900 block">
                  {event.timestamp} · {event.created_at_date || '10/11/2026'}
                </span>
                <span className="text-3xs text-slate-400 block truncate">
                  {event.created_at_iso || 'Asia/Ho_Chi_Minh'}
                </span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="text-slate-400 block font-medium">Độ Trễ Phục Vụ</span>
                <span className="text-sm font-bold font-mono text-slate-900">{event.latency_ms} ms</span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="text-slate-400 block font-medium">Người Thao Tác</span>
                <span className="text-sm font-semibold text-slate-800">{event.user_name || 'Bác sĩ lâm sàng'}</span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="text-slate-400 block font-medium">Nhà Cung Cấp Model</span>
                <span className="text-xs font-bold font-mono text-teal-800">{event.provider || 'gemini'}</span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 col-span-2">
                <span className="text-slate-400 block font-medium">Căn Cứ Dược Điển &amp; Pháp Lý (Grounded Sources)</span>
                <span className="text-xs font-semibold text-slate-800">
                  {event.grounded_source || 'Dược Thư Quốc Gia Việt Nam V · Quyết định 5948/QĐ-BYT · TT 26/2025/TT-BYT · QĐ 130/QĐ-BYT'}
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
