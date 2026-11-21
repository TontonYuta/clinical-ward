import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Search,
  RefreshCw,
  X
} from 'lucide-react';
import { TelemetryEventItem, PaginatedTelemetryResponse } from '../../types/admin';
import { fetchPaginatedTelemetry } from '../../services/adminApi';

function renderEventTypeBadge(type: string) {
  switch (type) {
    case 'CACHE_HIT':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-3xs font-mono font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
          CACHE HIT
        </span>
      );
    case 'ADAPTIVE_RAG':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-3xs font-mono font-semibold bg-sky-50 text-sky-700 border border-sky-200/60">
          RAG
        </span>
      );
    case 'DDI_BLOCKED':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-3xs font-mono font-semibold bg-rose-50 text-rose-700 border border-rose-200/60">
          CHẶN DDI
        </span>
      );
    case 'GUARDRAIL_BLOCKED':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-3xs font-mono font-semibold bg-amber-50 text-amber-700 border border-amber-200/60">
          GUARDRAIL
        </span>
      );
    case 'BHYT_SUBSTITUTION':
    case 'VISION_OCR_BHYT':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-3xs font-mono font-semibold bg-purple-50 text-purple-700 border border-purple-200/60">
          BHYT OCR
        </span>
      );
    case 'MULTIMODAL_CLINICAL_VISION':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-3xs font-mono font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
          VISION
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-3xs font-mono font-semibold bg-slate-100 text-slate-700 border border-slate-200">
          {type}
        </span>
      );
  }
}

function renderUserRoleBadge(role: string) {
  const norm = (role || '').toLowerCase();
  switch (norm) {
    case 'doctor':
      return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-3xs font-mono font-semibold bg-blue-50 text-blue-700 border border-blue-200/50">BS</span>;
    case 'nurse':
      return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-3xs font-mono font-semibold bg-teal-50 text-teal-700 border border-teal-200/50">ĐD</span>;
    case 'pharmacist':
      return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-3xs font-mono font-semibold bg-amber-50 text-amber-700 border border-amber-200/50">DS</span>;
    case 'director':
      return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-3xs font-mono font-semibold bg-purple-50 text-purple-700 border border-purple-200/50">GĐ</span>;
    default:
      return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-3xs font-mono font-medium text-slate-500 bg-slate-100">{role || 'NV'}</span>;
  }
}

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
      'Nguồn usage',
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
      `"${ev.model_name || 'unknown'}"`,
      `"${ev.provider || ''}"`,
      `"${(ev.query || '').replace(/"/g, '""')}"`,
      ev.usage_source === 'provider' ? ev.prompt_tokens || 0 : '',
      ev.usage_source === 'provider' ? ev.completion_tokens || 0 : '',
      `"${ev.usage_source || 'none'}"`,
      ev.usage_source === 'provider' ? ev.image_tokens || 0 : '',
      ev.usage_source === 'provider' ? ev.total_tokens || ev.tokens || 0 : '',
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
    <div className="bg-white border border-slate-200/90 rounded-lg overflow-hidden flex flex-col">
      {/* 1. Header & Bộ công cụ Thống kê */}
      <div className="p-3 sm:px-4 sm:py-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              Nhật ký tương tác trực tiếp &amp; Chi tiết Token
            </h2>
            {isLoading && (
              <RefreshCw className="w-3.5 h-3.5 text-teal-600 animate-spin" />
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Theo dõi {totalItems.toLocaleString()} lượt truy vấn cùng token usage và model do hệ thống ghi nhận
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Nút Xuất CSV */}
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={displayItems.length === 0}
            className="h-8 px-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-md text-xs font-medium flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40"
            title="Xuất danh sách sự kiện ra tệp CSV để đối soát chi phí"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Xuất CSV</span>
          </button>

          {/* Huy hiệu tổng số log */}
          <span className="text-2xs font-mono text-slate-400">
            {totalItems.toLocaleString()} sự kiện
          </span>
        </div>
      </div>

      {/* 2. Thanh Tìm kiếm & Bộ Lọc Thời Gian Thực */}
      <div className="px-3 sm:px-4 py-2 bg-slate-50/60 border-b border-slate-200/80 flex flex-wrap items-center gap-2">
        {/* Ô Tìm Kiếm Nhanh */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm prompt, câu lệnh, mã CHAT..."
            className="w-full h-8 pl-8 pr-7 bg-white border border-slate-200 rounded-md text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-600 transition shadow-2xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer p-0.5 rounded"
              title="Xóa tìm kiếm"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Lọc Cơ Chế */}
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          aria-label="Lọc theo loại cơ chế"
          className="h-8 bg-white border border-slate-200 rounded-md px-2 text-xs text-slate-700 focus:border-slate-400 focus:outline-none cursor-pointer"
        >
          <option value="all">Mọi Cơ Chế</option>
          <option value="ADAPTIVE_RAG">Adaptive RAG</option>
          <option value="VISION_OCR_BHYT">OCR BHYT</option>
          <option value="MULTIMODAL_CLINICAL_VISION">Ảnh Thị Giác</option>
          <option value="CACHE_HIT">Cache</option>
          <option value="DDI_BLOCKED">Chặn DDI</option>
          <option value="GUARDRAIL_BLOCKED">Guardrail</option>
        </select>

        {/* Lọc Model AI */}
        <select
          value={modelFilter}
          onChange={(e) => { setModelFilter(e.target.value); setPage(1); }}
          aria-label="Lọc theo model AI"
          className="h-8 bg-white border border-slate-200 rounded-md px-2 text-xs text-slate-700 focus:border-slate-400 focus:outline-none cursor-pointer"
        >
          <option value="all">Mọi Model</option>
          <option value="gemini-3.5-flash-lite">gemini-3.5-flash-lite</option>
          <option value="gemini-flash-lite-latest">gemini-flash-lite-latest</option>
          <option value="gemini-3.8-flash">gemini-3.8-flash</option>
          <option value="gemini-flash-latest">gemini-flash-latest</option>
          <option value="clinical-cache-engine">clinical-cache-engine</option>
          <option value="safety-ddi-matrix">safety-ddi-matrix</option>
          <option value="clinical-guardrail-v2">clinical-guardrail-v2</option>
        </select>

        {/* Lọc Vai Trò */}
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          aria-label="Lọc theo vai trò người dùng"
          className="h-8 bg-white border border-slate-200 rounded-md px-2 text-xs text-slate-700 focus:border-slate-400 focus:outline-none cursor-pointer"
        >
          <option value="all">Mọi Vai Trò</option>
          <option value="doctor">Bác Sĩ</option>
          <option value="nurse">Điều Dưỡng</option>
          <option value="pharmacist">Dược Sĩ</option>
        </select>

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
            Đặt lại
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
                  <td className="py-2.5 pr-3 whitespace-nowrap" title={ev.created_at_full || `${ev.timestamp}${ev.created_at_date ? ` · ${ev.created_at_date}` : ''}`}>
                    <div className="flex flex-col">
                      <span className="font-mono text-xs font-medium text-slate-800">
                        {ev.timestamp}
                      </span>
                      <span className="font-mono text-3xs text-slate-400">
                        {ev.created_at_date || ''}
                      </span>
                    </div>
                  </td>
                  
                  {/* Cột Cơ Chế Phục Vụ */}
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    {renderEventTypeBadge(ev.event_type)}
                  </td>

                  {/* Cột Model Đọc */}
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <span className="font-mono text-2xs text-slate-600 bg-slate-100/80 px-1.5 py-0.5 rounded" title={`Nhà cung cấp: ${ev.provider || 'Hệ thống'}`}>
                      {ev.model_name || 'unknown'}
                    </span>
                  </td>

                  {/* Cột Câu Hỏi / Tác Vụ */}
                  <td className="py-2.5 px-3 text-slate-800 max-w-xs sm:max-w-md truncate">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {ev.has_image && (
                        <span className="text-3xs font-mono text-slate-400 shrink-0" title="Kèm hình ảnh">
                          📷
                        </span>
                      )}
                      <span className="truncate">{ev.query}</span>
                    </div>
                  </td>

                  {/* Cột Phân Bổ Token (Input, Output, Image, Total) */}
                  <td className="py-2.5 px-3 text-right whitespace-nowrap">
                    <div className="flex flex-col items-end">
                      <span className="font-mono font-medium text-slate-800 text-xs">
                        {ev.usage_source === 'provider'
                          ? `${(ev.total_tokens || ev.tokens || 0).toLocaleString()} tok`
                          : ev.usage_source === 'estimated' || ev.usage_source === 'mixed'
                          ? 'Có ước tính'
                          : ev.cache_hit_count
                          ? 'Cache · 0 tok'
                          : 'Chưa có usage'}
                      </span>
                      <span className="text-3xs text-slate-400 font-mono">
                        {ev.usage_source === 'provider'
                          ? `In: ${ev.prompt_tokens || 0} · Out: ${ev.completion_tokens || 0}`
                          : ''}
                      </span>
                    </div>
                  </td>

                  {/* Cột Vai Trò */}
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    {renderUserRoleBadge(ev.user_role)}
                  </td>

                  {/* Cột Độ Trễ */}
                  <td className="py-2.5 px-3 text-right font-mono text-slate-600 text-xs whitespace-nowrap">
                    <span className={ev.latency_ms > 1000 ? 'text-amber-600 font-semibold' : 'text-slate-600'}>
                      {ev.latency_ms} ms
                    </span>
                  </td>

                  {/* Cột Thao Tác */}
                  <td className="py-2.5 pl-2 text-right whitespace-nowrap">
                    <span className="text-xs text-slate-400 group-hover:text-teal-700 font-medium inline-flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                      Chi tiết →
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
