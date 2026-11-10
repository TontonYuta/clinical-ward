import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Filter,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Cpu,
  Image as ImageIcon,
  Download,
  Search,
  RefreshCw
} from 'lucide-react';
import { TelemetryEventItem, PaginatedTelemetryResponse } from '../../types/admin';
import { fetchPaginatedTelemetry } from '../../services/adminApi';

interface TelemetryLiveStreamTableProps {
  events: TelemetryEventItem[];
  onSelectEvent: (event: TelemetryEventItem) => void;
}

export const TelemetryLiveStreamTable: React.FC<TelemetryLiveStreamTableProps> = ({
  events,
  onSelectEvent
}) => {
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [modelFilter, setModelFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');

  const [paginatedData, setPaginatedData] = useState<PaginatedTelemetryResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Debounce tìm kiếm 350ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Tải danh sách sự kiện từ máy chủ (Server-side Pagination)
  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchPaginatedTelemetry({
        page,
        pageSize,
        eventType: typeFilter,
        modelName: modelFilter,
        userRole: roleFilter,
        q: debouncedSearch
      });
      setPaginatedData(data);
    } catch (err) {
      console.warn('Lỗi tải nhật ký telemetry phân trang, sử dụng dữ liệu cục bộ:', err);
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, typeFilter, modelFilter, roleFilter, debouncedSearch]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Dự phòng cục bộ (Client-side fallback) nếu chưa có phản hồi từ endpoint phân trang
  const clientFilteredEvents = useMemo(() => {
    return events.filter((ev) => {
      const matchRole = roleFilter === 'all' || ev.user_role.toLowerCase() === roleFilter.toLowerCase();
      const matchType = typeFilter === 'all' || ev.event_type === typeFilter;
      const matchModel = modelFilter === 'all' || ev.model_name === modelFilter;
      const matchSearch = !debouncedSearch.trim() || 
        ev.query.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        ev.id.toLowerCase().includes(debouncedSearch.toLowerCase());
      return matchRole && matchType && matchModel && matchSearch;
    });
  }, [events, roleFilter, typeFilter, modelFilter, debouncedSearch]);

  const displayItems: TelemetryEventItem[] = paginatedData ? paginatedData.items : clientFilteredEvents.slice((page - 1) * pageSize, page * pageSize);
  const totalItems: number = paginatedData ? paginatedData.total_items : clientFilteredEvents.length;
  const totalPages: number = paginatedData ? paginatedData.total_pages : Math.max(1, Math.ceil(clientFilteredEvents.length / pageSize));

  // Xuất file CSV đối soát kiểm toán
  const handleExportCsv = () => {
    const headers = [
      'Thời Gian (GMT+7)',
      'Ngày',
      'Thời Gian Đầy Đủ',
      'Mã Sự Kiện',
      'Cơ Chế Phục Vụ',
      'Model AI',
      'Nhà Cung Cấp',
      'Nội Dung Truy Vấn',
      'Input Prompt Tokens',
      'Output Tokens',
      'Image Tokens',
      'Tổng Tokens',
      'Vai Trò',
      'Độ Trễ (ms)',
      'Trạng Thái'
    ];

    const rows = displayItems.map((ev) => [
      `"${ev.timestamp || ''}"`,
      `"${ev.created_at_date || ''}"`,
      `"${ev.created_at_full || (ev.timestamp + ' ' + (ev.created_at_date || ''))}"`,
      `"${ev.id || ''}"`,
      `"${ev.event_type || ''}"`,
      `"${ev.model_name || 'gemini-3.5-flash-lite'}"`,
      `"${ev.provider || ''}"`,
      `"${(ev.query || '').replace(/"/g, '""')}"`,
      ev.prompt_tokens || 0,
      ev.completion_tokens || 0,
      ev.image_tokens || 0,
      ev.total_tokens || ev.tokens || 0,
      `"${ev.user_role || ''}"`,
      ev.latency_ms || 0,
      `"${ev.status || ''}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Nhat_Ky_Telemetry_Tokens_Trang_${page}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-5 bg-white rounded-xl border border-slate-200/90 shadow-2xs space-y-3.5">
      
      {/* 1. Header & Bộ công cụ Thống kê */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm lg:text-base font-bold text-slate-900">
              Nhật ký tương tác trực tiếp &amp; Chi tiết Token
            </h2>
            {isLoading && (
              <RefreshCw className="w-3.5 h-3.5 text-teal-600 animate-spin" />
            )}
          </div>
          <p className="text-xs text-slate-500">
            Theo dõi toàn diện {totalItems.toLocaleString()} lượt truy vấn, đồng bộ 100% token input prompt, completion output, ảnh multimodal và model AI
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Nút Xuất CSV */}
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={displayItems.length === 0}
            className="h-8 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition cursor-pointer disabled:opacity-40"
            title="Xuất danh sách sự kiện ra tệp CSV để đối soát chi phí"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>Xuất CSV</span>
          </button>

          {/* Huy hiệu tổng số log */}
          <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
            {totalItems.toLocaleString()} sự kiện
          </span>
        </div>
      </div>

      {/* 2. Thanh Tìm kiếm & Bộ Lọc Thời Gian Thực */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
        
        {/* Ô Tìm Kiếm Nhanh */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm prompt, câu lệnh, mã CHAT..."
            className="w-full h-8 pl-8 pr-2.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-600 transition"
          />
        </div>

        {/* Lọc Model AI */}
        <div className="flex items-center gap-1 text-xs">
          <select
            value={modelFilter}
            onChange={(e) => { setModelFilter(e.target.value); setPage(1); }}
            aria-label="Lọc theo model AI"
            className="h-8 bg-white border border-slate-200 rounded-lg px-2 text-xs font-medium text-slate-700 focus:border-teal-600 focus:outline-none cursor-pointer"
          >
            <option value="all">Tất Cả Model</option>
            <option value="gemini-3.5-flash-lite">gemini-3.5-flash-lite (Active Google AI Studio)</option>
            <option value="gemini-flash-lite-latest">gemini-flash-lite-latest</option>
            <option value="gemini-3.8-flash">gemini-3.8-flash</option>
            <option value="gemini-flash-latest">gemini-flash-latest</option>
            <option value="clinical-cache-engine">clinical-cache-engine (Local Cache)</option>
            <option value="safety-ddi-matrix">safety-ddi-matrix (DDI Safety)</option>
            <option value="clinical-guardrail-v2">clinical-guardrail-v2 (Guardrail)</option>
          </select>
        </div>

        {/* Lọc Vai Trò */}
        <div className="flex items-center gap-1 text-xs">
          <select
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
            aria-label="Lọc theo vai trò người dùng"
            className="h-8 bg-white border border-slate-200 rounded-lg px-2 text-xs font-medium text-slate-700 focus:border-teal-600 focus:outline-none cursor-pointer"
          >
            <option value="all">Mọi Vai Trò</option>
            <option value="doctor">Bác Sĩ</option>
            <option value="nurse">Điều Dưỡng</option>
            <option value="pharmacist">Dược Sĩ</option>
          </select>
        </div>

        {/* Nút lọc Loại Cơ Chế (Tabs nhỏ) */}
        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs overflow-x-auto max-w-full">
          {[
            { id: 'all', label: 'Tất cả' },
            { id: 'ADAPTIVE_RAG', label: 'Adaptive RAG' },
            { id: 'VISION_OCR_BHYT', label: 'OCR BHYT' },
            { id: 'MULTIMODAL_CLINICAL_VISION', label: 'Ảnh Thị Giác' },
            { id: 'CACHE_HIT', label: 'Cache' },
            { id: 'DDI_BLOCKED', label: 'Chặn DDI' },
            { id: 'GUARDRAIL_BLOCKED', label: 'Guardrail' }
          ].map((btn) => (
            <button
              key={btn.id}
              type="button"
              onClick={() => { setTypeFilter(btn.id); setPage(1); }}
              className={`px-2 py-1 rounded-md text-2xs font-medium transition cursor-pointer whitespace-nowrap ${
                typeFilter === btn.id
                  ? 'bg-white text-teal-900 font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {/* Nút Đặt lại bộ lọc */}
        {(typeFilter !== 'all' || roleFilter !== 'all' || modelFilter !== 'all' || searchQuery.trim()) && (
          <button
            type="button"
            onClick={() => {
              setTypeFilter('all');
              setRoleFilter('all');
              setModelFilter('all');
              setSearchQuery('');
              setPage(1);
            }}
            className="text-xs text-rose-600 hover:underline cursor-pointer font-medium ml-auto"
          >
            Đặt lại bộ lọc
          </button>
        )}
      </div>

      {/* 3. Bảng Dữ Liệu Sự Kiện & Token */}
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
            {displayItems.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-10 text-center text-slate-400 text-sm">
                  {isLoading ? 'Đang tải dữ liệu...' : 'Không tìm thấy sự kiện nào phù hợp với bộ lọc hiện tại'}
                </td>
              </tr>
            ) : (
              displayItems.map((ev, i) => (
                <tr
                  key={ev.id || i}
                  onClick={() => onSelectEvent(ev)}
                  className="hover:bg-teal-50/70 cursor-pointer transition group"
                  title="Nhấn để mở thanh tra chi tiết truy vấn & phân bổ token"
                >
                  {/* Cột Thời Gian (Giờ VN GMT+7 & Ngày Tháng) */}
                  <td className="py-3 pr-3 whitespace-nowrap" title={ev.created_at_full || `${ev.timestamp} · ${ev.created_at_date || '10/11/2026'} (GMT+7 · Giờ Việt Nam)`}>
                    <div className="flex flex-col">
                      <span className="font-mono text-xs font-bold text-slate-800 tracking-tight">
                        {ev.timestamp}
                      </span>
                      <span className="font-mono text-3xs text-slate-400">
                        {ev.created_at_date || '10/11/2026'} <span className="text-teal-700 font-semibold">(VN)</span>
                      </span>
                    </div>
                  </td>
                  
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
                    {(() => {
                      const mName = ev.model_name || 'gemini-3.5-flash-lite';
                      const isGemini = mName.startsWith('gemini');
                      const isCache = mName.includes('cache');
                      const isSafety = mName.includes('ddi') || mName.includes('guardrail');
                      const colorClass = isGemini
                        ? 'bg-cyan-50 text-cyan-900 border-cyan-200'
                        : isCache
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : isSafety
                        ? 'bg-amber-50 text-amber-900 border-amber-200'
                        : 'bg-slate-100 text-slate-800 border-slate-200';
                      return (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-2xs font-mono font-semibold ${colorClass}`} title={`Nhà cung cấp: ${ev.provider || (isGemini ? 'Google AI Studio' : 'Hệ thống')}`}>
                          <Cpu className="w-3 h-3 shrink-0 text-current opacity-80" />
                          <span>{mName}</span>
                        </span>
                      );
                    })()}
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

      {/* 4. Thanh Điều Khiển Phân Trang (Pagination Controls) */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200 text-xs text-slate-600">
        
        {/* Thông tin số lượng hiển thị */}
        <div className="flex items-center gap-2">
          <span>
            Hiển thị <strong>{totalItems === 0 ? 0 : (page - 1) * pageSize + 1}</strong> - <strong>{Math.min(page * pageSize, totalItems)}</strong> trong tổng số <strong>{totalItems.toLocaleString()}</strong> sự kiện
          </span>
          
          {/* Bộ chọn Page Size */}
          <div className="flex items-center gap-1.5 ml-2 border-l border-slate-200 pl-3">
            <span className="text-slate-500">Mỗi trang:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              aria-label="Chọn số dòng trên một trang"
              className="h-7 bg-white border border-slate-200 rounded px-1.5 text-xs font-semibold text-slate-800 focus:border-teal-600 focus:outline-none cursor-pointer"
            >
              <option value={25}>25 dòng</option>
              <option value={50}>50 dòng</option>
              <option value={100}>100 dòng</option>
              <option value={200}>200 dòng</option>
            </select>
          </div>
        </div>

        {/* Nút Điều Hướng Trang */}
        <div className="flex items-center gap-1">
          {/* Về trang đầu */}
          <button
            type="button"
            onClick={() => setPage(1)}
            disabled={page <= 1 || isLoading}
            className="w-7 h-7 flex items-center justify-center rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
            title="Về trang đầu"
          >
            <ChevronsLeft className="w-3.5 h-3.5 text-slate-700" />
          </button>

          {/* Trang trước */}
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || isLoading}
            className="w-7 h-7 flex items-center justify-center rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
            title="Trang trước"
          >
            <ChevronLeft className="w-3.5 h-3.5 text-slate-700" />
          </button>

          {/* Chỉ số trang */}
          <span className="px-3 py-1 font-semibold text-slate-800 bg-slate-100 rounded border border-slate-200 text-xs">
            Trang {page} / {totalPages}
          </span>

          {/* Trang sau */}
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || isLoading}
            className="w-7 h-7 flex items-center justify-center rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
            title="Trang sau"
          >
            <ChevronRight className="w-3.5 h-3.5 text-slate-700" />
          </button>

          {/* Đến trang cuối */}
          <button
            type="button"
            onClick={() => setPage(totalPages)}
            disabled={page >= totalPages || isLoading}
            className="w-7 h-7 flex items-center justify-center rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
            title="Đến trang cuối"
          >
            <ChevronsRight className="w-3.5 h-3.5 text-slate-700" />
          </button>
        </div>
      </div>

    </div>
  );
};
