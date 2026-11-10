import React, { useState } from 'react';
import { Filter, ChevronRight, Cpu, Image as ImageIcon } from 'lucide-react';
import { TelemetryEventItem } from '../../types/admin';

interface TelemetryLiveStreamTableProps {
  events: TelemetryEventItem[];
  onSelectEvent: (event: TelemetryEventItem) => void;
}

export const TelemetryLiveStreamTable: React.FC<TelemetryLiveStreamTableProps> = ({
  events,
  onSelectEvent
}) => {
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  const filteredEvents = events.filter((ev) => {
    const matchRole = roleFilter === 'all' || ev.user_role.toLowerCase() === roleFilter.toLowerCase();
    const matchType = typeFilter === 'all' || ev.event_type === typeFilter;
    return matchRole && matchType;
  });

  return (
    <div className="p-5 bg-white rounded-xl border border-slate-200/90 shadow-2xs space-y-3.5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-sm lg:text-base font-bold text-slate-900">Nhật ký tương tác trực tiếp &amp; Chi tiết Token</h2>
          <p className="text-xs text-slate-500">Đồng bộ 100% token input prompt, completion output, ảnh multimodal và model AI phục vụ</p>
        </div>
        <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
          {events.length} sự kiện mới nhất
        </span>
      </div>

      {/* Thanh Bộ Lọc Thời Gian Thực */}
      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
          <Filter className="w-3.5 h-3.5 text-teal-700" />
          <span>Lọc:</span>
        </div>

        {/* Filter Type */}
        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
          {[
            { id: 'all', label: 'Tất cả' },
            { id: 'ADAPTIVE_RAG', label: 'Adaptive RAG' },
            { id: 'VISION_OCR_BHYT', label: 'OCR BHYT' },
            { id: 'MULTIMODAL_CLINICAL_VISION', label: 'Ảnh Thị Giác' },
            { id: 'CACHE_HIT', label: 'Cache & Vector' },
            { id: 'DDI_BLOCKED', label: 'Chặn DDI' },
            { id: 'GUARDRAIL_BLOCKED', label: 'Guardrails' }
          ].map((btn) => (
            <button
              key={btn.id}
              type="button"
              onClick={() => setTypeFilter(btn.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                typeFilter === btn.id
                  ? 'bg-white text-teal-900 font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {/* Filter Role */}
        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
          {[
            { id: 'all', label: 'Mọi Vai Trò' },
            { id: 'doctor', label: 'Bác Sĩ' },
            { id: 'nurse', label: 'Điều Dưỡng' },
            { id: 'pharmacist', label: 'Dược Sĩ' }
          ].map((btn) => (
            <button
              key={btn.id}
              type="button"
              onClick={() => setRoleFilter(btn.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                roleFilter === btn.id
                  ? 'bg-white text-teal-900 font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {(typeFilter !== 'all' || roleFilter !== 'all') && (
          <button
            type="button"
            onClick={() => { setTypeFilter('all'); setRoleFilter('all'); }}
            className="text-xs text-rose-600 hover:underline cursor-pointer font-medium ml-auto"
          >
            Đặt lại ({filteredEvents.length} kết quả)
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500 font-semibold text-xs lg:text-sm uppercase tracking-wider">
              <th className="pb-3 pr-3">Thời Gian</th>
              <th className="pb-3 px-3">Cơ Chế Phục Vụ</th>
              <th className="pb-3 px-3">Model Đọc</th>
              <th className="pb-3 px-3">Nội Dung Truy Vấn / Tác Vụ</th>
              <th className="pb-3 px-3 text-right">Phân Bổ Token</th>
              <th className="pb-3 px-3">Vai Trò</th>
              <th className="pb-3 px-3 text-right">Độ Trễ</th>
              <th className="pb-3 pl-2 text-right">Thao Tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredEvents.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-400 text-sm">
                  {events.length === 0
                    ? 'Chưa có nhật ký truy vấn nào phát sinh trong ca trực'
                    : 'Không tìm thấy sự kiện nào phù hợp với bộ lọc hiện tại'}
                </td>
              </tr>
            ) : (
              filteredEvents.map((ev, i) => (
                <tr
                  key={i}
                  onClick={() => onSelectEvent(ev)}
                  className="hover:bg-teal-50/70 cursor-pointer transition group"
                  title="Nhấn để mở thanh tra chi tiết truy vấn & phân bổ token"
                >
                  <td className="py-3 pr-3 font-mono text-xs text-slate-500 whitespace-nowrap">{ev.timestamp}</td>
                  
                  {/* Cột Cơ Chế Phục Vụ */}
                  <td className="py-3 px-3 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-0.5 rounded-md text-2xs font-semibold ${
                      ev.event_type === 'CACHE_HIT'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : ev.event_type === 'DDI_BLOCKED' || ev.event_type === 'GUARDRAIL_BLOCKED'
                        ? 'bg-rose-50 text-rose-800 border border-rose-200'
                        : ev.event_type === 'VISION_OCR_BHYT'
                        ? 'bg-blue-50 text-blue-800 border border-blue-200'
                        : ev.event_type === 'MULTIMODAL_CLINICAL_VISION'
                        ? 'bg-purple-50 text-purple-800 border border-purple-200'
                        : 'bg-teal-50 text-teal-800 border border-teal-200'
                    }`}>
                      {ev.event_type}
                    </span>
                  </td>

                  {/* Cột Model Đọc */}
                  <td className="py-3 px-3 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200 text-2xs font-mono font-semibold" title={`Nhà cung cấp: ${ev.provider || 'gemini'}`}>
                      <Cpu className="w-3 h-3 text-teal-700 shrink-0" />
                      <span>{ev.model_name || 'gemini-2.5-flash'}</span>
                    </span>
                  </td>

                  {/* Cột Câu Hỏi / Tác Vụ */}
                  <td className="py-3 px-3 font-medium text-slate-800 group-hover:text-teal-950 max-w-xs sm:max-w-md truncate">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {ev.has_image && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-3xs font-bold shrink-0">
                          <ImageIcon className="w-2.5 h-2.5" />
                          <span>Ảnh</span>
                        </span>
                      )}
                      <span className="truncate">{ev.query}</span>
                    </div>
                  </td>

                  {/* Cột Phân Bổ Token (Input, Output, Image, Total) */}
                  <td className="py-3 px-3 text-right whitespace-nowrap">
                    <div className="flex flex-col items-end">
                      <span className="font-mono font-bold text-slate-900 text-xs">
                        {(ev.total_tokens || ev.tokens || 0).toLocaleString()} <span className="text-2xs font-normal text-slate-400">tok</span>
                      </span>
                      <span className="text-2xs text-slate-500 font-mono tracking-tight">
                        In: {ev.prompt_tokens || Math.max(15, Math.floor(ev.query.length / 3))} · Out: {ev.completion_tokens || Math.max(25, Math.floor((ev.reply_text || '').length / 3))}
                        {ev.has_image && <span className="text-teal-700 font-bold ml-1">· 📷 {ev.image_tokens || 258}</span>}
                      </span>
                    </div>
                  </td>

                  {/* Cột Vai Trò */}
                  <td className="py-3 px-3 text-slate-600 font-semibold text-2xs whitespace-nowrap uppercase">
                    <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                      {ev.user_role}
                    </span>
                  </td>

                  {/* Cột Độ Trễ */}
                  <td className="py-3 px-3 text-right font-mono font-bold text-slate-800 text-xs whitespace-nowrap">
                    {ev.latency_ms} ms
                  </td>

                  {/* Cột Thao Tác */}
                  <td className="py-3 pl-2 text-right whitespace-nowrap">
                    <span className="inline-flex items-center text-xs font-semibold text-teal-700 group-hover:underline">
                      Chi tiết <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
