import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Search,
  RefreshCw,
  X,
  Image as ImageIcon,
  RotateCcw,
} from 'lucide-react';
import { TelemetryEventItem, PaginatedTelemetryResponse } from '../../types/admin';
import { fetchPaginatedTelemetry } from '../../services/adminApi';

function renderEventTypeBadge(type: string) {
  switch (type) {
    case 'CACHE_HIT':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-3xs font-mono font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/70">
          CACHE HIT
        </span>
      );
    case 'ADAPTIVE_RAG':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-3xs font-mono font-semibold bg-sky-50 text-sky-700 border border-sky-200/70">
          RAG
        </span>
      );
    case 'DDI_BLOCKED':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-3xs font-mono font-semibold bg-rose-50 text-rose-700 border border-rose-200/70">
          CHẶN DDI
        </span>
      );
    case 'GUARDRAIL_BLOCKED':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-3xs font-mono font-semibold bg-amber-50 text-amber-800 border border-amber-200/70">
          GUARDRAIL
        </span>
      );
    case 'BHYT_SUBSTITUTION':
    case 'VISION_OCR_BHYT':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-3xs font-mono font-semibold bg-purple-50 text-purple-700 border border-purple-200/70">
          BHYT OCR
        </span>
      );
    case 'MULTIMODAL_CLINICAL_VISION':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-3xs font-mono font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/70">
          VISION
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-3xs font-mono font-semibold bg-slate-100 text-slate-700 border border-slate-200">
          {type}
        </span>
      );
  }
}

function renderUserRoleBadge(role: string) {
  const norm = (role || '').toLowerCase();
  switch (norm) {
    case 'doctor':
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-3xs font-mono font-semibold bg-sky-50 text-sky-700 border border-sky-200/60">
          BS
        </span>
      );
    case 'nurse':
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-3xs font-mono font-semibold bg-teal-50 text-teal-700 border border-teal-200/60">
          ĐD
        </span>
      );
    case 'pharmacist':
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-3xs font-mono font-semibold bg-amber-50 text-amber-800 border border-amber-200/60">
          DS
        </span>
      );
    case 'director':
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-3xs font-mono font-semibold bg-slate-100 text-slate-700 border border-slate-200">
          GĐ
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-3xs font-mono font-medium text-slate-600 bg-slate-100">
          {role || 'NV'}
        </span>
      );
  }
}

interface TelemetryLiveStreamTableProps {
  events: TelemetryEventItem[];
  onSelectEvent: (event: TelemetryEventItem) => void;
}

export const TelemetryLiveStreamTable: React.FC<TelemetryLiveStreamTableProps> = ({
  events,
  onSelectEvent,
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

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchPaginatedTelemetry({
        page,
        pageSize,
        eventType: typeFilter,
        modelName: modelFilter,
        userRole: roleFilter,
        q: debouncedSearch,
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

  const clientFilteredEvents = useMemo(() => {
    return events.filter((ev) => {
      const matchRole = roleFilter === 'all' || ev.user_role.toLowerCase() === roleFilter.toLowerCase();
      const matchType = typeFilter === 'all' || ev.event_type === typeFilter;
      const matchModel = modelFilter === 'all' || ev.model_name === modelFilter;
      const matchSearch =
        !debouncedSearch.trim() ||
        ev.query.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        ev.id.toLowerCase().includes(debouncedSearch.toLowerCase());
      return matchRole && matchType && matchModel && matchSearch;
    });
  }, [events, roleFilter, typeFilter, modelFilter, debouncedSearch]);

  const displayItems: TelemetryEventItem[] = paginatedData
    ? paginatedData.items
    : clientFilteredEvents.slice((page - 1) * pageSize, page * pageSize);
  const totalItems: number = paginatedData ? paginatedData.total_items : clientFilteredEvents.length;
  const totalPages: number = paginatedData
    ? paginatedData.total_pages
    : Math.max(1, Math.ceil(clientFilteredEvents.length / pageSize));

  const hasActiveFilters =
    typeFilter !== 'all' || roleFilter !== 'all' || modelFilter !== 'all' || Boolean(searchQuery.trim());

  const resetFilters = () => {
    setTypeFilter('all');
    setRoleFilter('all');
    setModelFilter('all');
    setSearchQuery('');
    setPage(1);
  };

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
      'Trạng Thái',
    ];

    const rows = displayItems.map((ev) => [
      `"${ev.timestamp || ''}"`,
      `"${ev.created_at_date || ''}"`,
      `"${ev.created_at_full || `${ev.timestamp} ${ev.created_at_date || ''}`}"`,
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
      `"${ev.status || ''}"`,
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

  const formatTokenSummary = (ev: TelemetryEventItem) => {
    if (ev.usage_source === 'provider') {
      return `${(ev.total_tokens || ev.tokens || 0).toLocaleString()} tok`;
    }
    if (ev.usage_source === 'estimated' || ev.usage_source === 'mixed') {
      return 'Ước tính';
    }
    if (ev.cache_hit_count) {
      return 'Cache · 0';
    }
    return '—';
  };

  return (
    <section
      aria-label="Nhật ký tương tác trực tiếp"
      className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden flex flex-col"
    >
      {/* 1. Header */}
      <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-slate-900 tracking-tight">
              Nhật ký tương tác trực tiếp &amp; Chi tiết Token
            </h2>
            {isLoading && <RefreshCw className="w-3.5 h-3.5 text-teal-600 animate-spin" />}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Theo dõi {totalItems.toLocaleString('vi-VN')} lượt truy vấn cùng chi tiết token và model thực thi
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-2xs font-mono text-slate-500 tabular-nums">
            {totalItems.toLocaleString('vi-VN')} sự kiện
          </span>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={displayItems.length === 0}
            className="h-9 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-medium inline-flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title="Xuất danh sách sự kiện ra tệp CSV để đối soát"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Xuất CSV</span>
          </button>
        </div>
      </div>

      {/* 2. Search & Filters */}
      <div className="px-5 sm:px-6 py-3 bg-slate-50/70 border-b border-slate-200/80 flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm câu hỏi, mã sự kiện..."
            className="w-full h-9 pl-9 pr-8 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-600 transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer p-0.5 rounded"
              aria-label="Xóa từ khóa tìm kiếm"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setPage(1);
          }}
          aria-label="Lọc theo loại cơ chế"
          className="h-9 bg-white border border-slate-200 rounded-xl px-3 text-xs text-slate-700 focus:border-teal-600 focus:outline-none cursor-pointer"
        >
          <option value="all">Mọi cơ chế</option>
          <option value="ADAPTIVE_RAG">Adaptive RAG</option>
          <option value="VISION_OCR_BHYT">OCR BHYT</option>
          <option value="MULTIMODAL_CLINICAL_VISION">Ảnh Thị Giác</option>
          <option value="CACHE_HIT">Cache</option>
          <option value="DDI_BLOCKED">Chặn DDI</option>
          <option value="GUARDRAIL_BLOCKED">Guardrail</option>
        </select>

        <select
          value={modelFilter}
          onChange={(e) => {
            setModelFilter(e.target.value);
            setPage(1);
          }}
          aria-label="Lọc theo model AI"
          className="h-9 bg-white border border-slate-200 rounded-xl px-3 text-xs text-slate-700 focus:border-teal-600 focus:outline-none cursor-pointer"
        >
          <option value="all">Mọi model</option>
          <option value="gemini-3.5-flash-lite">gemini-3.5-flash-lite</option>
          <option value="gemini-flash-lite-latest">gemini-flash-lite-latest</option>
          <option value="gemini-3.8-flash">gemini-3.8-flash</option>
          <option value="gemini-flash-latest">gemini-flash-latest</option>
          <option value="clinical-cache-engine">clinical-cache-engine</option>
          <option value="safety-ddi-matrix">safety-ddi-matrix</option>
          <option value="clinical-guardrail-v2">clinical-guardrail-v2</option>
        </select>

        <select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setPage(1);
          }}
          aria-label="Lọc theo vai trò người dùng"
          className="h-9 bg-white border border-slate-200 rounded-xl px-3 text-xs text-slate-700 focus:border-teal-600 focus:outline-none cursor-pointer"
        >
          <option value="all">Mọi vai trò</option>
          <option value="doctor">Bác sĩ</option>
          <option value="nurse">Điều dưỡng</option>
          <option value="pharmacist">Dược sĩ</option>
        </select>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={resetFilters}
            className="h-9 px-3 rounded-xl text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 inline-flex items-center gap-1.5 transition cursor-pointer font-medium"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Đặt lại</span>
          </button>
        )}
      </div>

      {/* 3A. Desktop Table (clean 11px uppercase headers, zero clipping at 1440px & 1280px) */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 font-semibold text-2xs uppercase tracking-wider">
              <th className="py-2.5 pl-4 sm:pl-5 pr-3 whitespace-nowrap">Thời gian</th>
              <th className="py-2.5 px-2.5 whitespace-nowrap">Cơ chế</th>
              <th className="py-2.5 px-2.5 whitespace-nowrap">Model</th>
              <th className="py-2.5 px-2.5 w-full">Nội dung truy vấn</th>
              <th className="py-2.5 px-2.5 text-right whitespace-nowrap">Token</th>
              <th className="py-2.5 px-2.5 whitespace-nowrap">Vai trò</th>
              <th className="py-2.5 px-2.5 text-right whitespace-nowrap">Độ trễ</th>
              <th className="py-2.5 pl-2.5 pr-4 sm:pr-5 text-right whitespace-nowrap">Chi tiết</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {displayItems.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-500 text-xs">
                  {isLoading
                    ? 'Đang đồng bộ nhật ký...'
                    : hasActiveFilters
                    ? 'Không tìm thấy sự kiện nào khớp với bộ lọc hiện tại.'
                    : 'Chưa có lượt truy vấn nào được ghi nhận.'}
                </td>
              </tr>
            ) : (
              displayItems.map((ev, i) => (
                <tr
                  key={ev.id || i}
                  onClick={() => onSelectEvent(ev)}
                  className="hover:bg-teal-50/50 cursor-pointer transition-colors group"
                  title="Nhấn để xem chi tiết truy vấn & phân bổ token"
                >
                  <td
                    className="py-2.5 pl-4 sm:pl-5 pr-3 whitespace-nowrap"
                    title={ev.created_at_full || `${ev.timestamp}${ev.created_at_date ? ` · ${ev.created_at_date}` : ''}`}
                  >
                    <div className="font-mono text-xs font-medium text-slate-800 tabular-nums">
                      {ev.timestamp}
                    </div>
                    {ev.created_at_date && (
                      <div className="font-mono text-3xs text-slate-400 tabular-nums">
                        {ev.created_at_date}
                      </div>
                    )}
                  </td>

                  <td className="py-2.5 px-2.5 whitespace-nowrap">
                    {renderEventTypeBadge(ev.event_type)}
                  </td>

                  <td className="py-2.5 px-2.5 whitespace-nowrap">
                    <span
                      className="font-mono text-2xs text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded max-w-[150px] inline-block truncate align-bottom"
                      title={`Model: ${ev.model_name || 'unknown'} · Nguồn: ${ev.provider || 'Hệ thống'}`}
                    >
                      {ev.model_name || 'unknown'}
                    </span>
                  </td>

                  <td className="py-2.5 px-2.5 text-slate-800 max-w-[320px] xl:max-w-none">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {ev.has_image && (
                        <ImageIcon
                          className="w-3.5 h-3.5 text-slate-400 shrink-0"
                          aria-label="Kèm hình ảnh"
                        />
                      )}
                      <span className="truncate font-medium text-slate-800">{ev.query}</span>
                    </div>
                  </td>

                  <td className="py-2.5 px-2.5 text-right whitespace-nowrap">
                    <div className="font-mono font-medium text-slate-800 text-xs tabular-nums">
                      {formatTokenSummary(ev)}
                    </div>
                    {ev.usage_source === 'provider' && (
                      <div className="text-3xs text-slate-400 font-mono tabular-nums">
                        {ev.prompt_tokens || 0}↑ · {ev.completion_tokens || 0}↓
                      </div>
                    )}
                  </td>

                  <td className="py-2.5 px-2.5 whitespace-nowrap">
                    {renderUserRoleBadge(ev.user_role)}
                  </td>

                  <td className="py-2.5 px-2.5 text-right font-mono text-xs whitespace-nowrap tabular-nums">
                    <span className={ev.latency_ms > 1000 ? 'text-amber-700 font-semibold' : 'text-slate-600'}>
                      {ev.latency_ms} ms
                    </span>
                  </td>

                  <td className="py-2.5 pl-2.5 pr-4 sm:pr-5 text-right whitespace-nowrap">
                    <span className="text-2xs text-slate-500 group-hover:text-teal-700 font-medium inline-flex items-center gap-0.5 transition-colors">
                      Xem
                      <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 3B. Mobile Card List (zero horizontal overflow on 390px) */}
      <div className="md:hidden divide-y divide-slate-100">
        {displayItems.length === 0 ? (
          <div className="py-10 px-4 text-center text-slate-500 text-xs">
            {isLoading
              ? 'Đang đồng bộ nhật ký...'
              : hasActiveFilters
              ? 'Không tìm thấy sự kiện nào khớp với bộ lọc.'
              : 'Chưa có lượt truy vấn nào được ghi nhận.'}
          </div>
        ) : (
          displayItems.map((ev, i) => (
            <button
              key={ev.id || i}
              type="button"
              onClick={() => onSelectEvent(ev)}
              className="w-full text-left p-3.5 hover:bg-teal-50/40 transition-colors flex flex-col gap-2 cursor-pointer"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  {renderEventTypeBadge(ev.event_type)}
                  {renderUserRoleBadge(ev.user_role)}
                </div>
                <span className="text-3xs font-mono text-slate-500 tabular-nums shrink-0">
                  {ev.timestamp} · {ev.latency_ms}ms
                </span>
              </div>
              <p className="text-xs font-medium text-slate-800 line-clamp-2 leading-relaxed">
                {ev.query}
              </p>
              <div className="flex items-center justify-between text-3xs font-mono text-slate-500">
                <span className="truncate max-w-[180px]">{ev.model_name || 'unknown'}</span>
                <span>{formatTokenSummary(ev)}</span>
              </div>
            </button>
          ))
        )}
      </div>

      {/* 4. Pagination Footer */}
      <div className="px-4 sm:px-5 py-3 border-t border-slate-200/80 bg-slate-50/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
        <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
          <span>
            Hiển thị{' '}
            <strong className="text-slate-800 font-mono tabular-nums">
              {totalItems === 0 ? 0 : (page - 1) * pageSize + 1}
            </strong>
            –
            <strong className="text-slate-800 font-mono tabular-nums">
              {Math.min(page * pageSize, totalItems)}
            </strong>{' '}
            / <strong className="text-slate-800 font-mono tabular-nums">{totalItems.toLocaleString('vi-VN')}</strong> sự kiện
          </span>

          <div className="flex items-center gap-1.5 sm:ml-2 sm:border-l border-slate-200 sm:pl-3">
            <span className="text-slate-500">Mỗi trang:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              aria-label="Chọn số dòng trên một trang"
              className="h-7 bg-white border border-slate-200 rounded-md px-1.5 text-xs font-medium text-slate-800 focus:border-teal-600 focus:outline-none cursor-pointer"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPage(1)}
            disabled={page <= 1 || isLoading}
            className="w-7 h-7 flex items-center justify-center rounded-md border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-35 disabled:cursor-not-allowed transition cursor-pointer"
            title="Về trang đầu"
          >
            <ChevronsLeft className="w-3.5 h-3.5 text-slate-700" />
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || isLoading}
            className="w-7 h-7 flex items-center justify-center rounded-md border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-35 disabled:cursor-not-allowed transition cursor-pointer"
            title="Trang trước"
          >
            <ChevronLeft className="w-3.5 h-3.5 text-slate-700" />
          </button>
          <span className="px-2.5 h-7 inline-flex items-center font-mono font-medium text-slate-700 bg-white rounded-md border border-slate-200 text-2xs tabular-nums">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || isLoading}
            className="w-7 h-7 flex items-center justify-center rounded-md border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-35 disabled:cursor-not-allowed transition cursor-pointer"
            title="Trang sau"
          >
            <ChevronRight className="w-3.5 h-3.5 text-slate-700" />
          </button>
          <button
            type="button"
            onClick={() => setPage(totalPages)}
            disabled={page >= totalPages || isLoading}
            className="w-7 h-7 flex items-center justify-center rounded-md border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-35 disabled:cursor-not-allowed transition cursor-pointer"
            title="Đến trang cuối"
          >
            <ChevronsRight className="w-3.5 h-3.5 text-slate-700" />
          </button>
        </div>
      </div>
    </section>
  );
};
