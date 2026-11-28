import React, { useEffect, useRef, useState } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import type { ChatbotAvailability } from '../../services/api';

interface ServiceStatusBadgeProps {
  availabilityMode: ChatbotAvailability['mode'];
  availabilityInfo?: ChatbotAvailability | null;
  onRefresh?: () => Promise<void> | void;
  align?: 'left' | 'right';
  compact?: boolean;
}

type HealthLevel = 'ok' | 'warn' | 'err' | 'checking';

interface RowStatus {
  label: string;
  statusText: string;
  level: HealthLevel;
}

function dotClass(level: HealthLevel): string {
  switch (level) {
    case 'ok':
      return 'bg-emerald-500';
    case 'warn':
      return 'bg-amber-500';
    case 'err':
      return 'bg-rose-500';
    default:
      return 'bg-slate-300';
  }
}

function statusTextClass(level: HealthLevel): string {
  switch (level) {
    case 'ok':
      return 'text-emerald-700';
    case 'warn':
      return 'text-amber-700';
    case 'err':
      return 'text-rose-700';
    default:
      return 'text-slate-400';
  }
}

export const ServiceStatusBadge: React.FC<ServiceStatusBadgeProps> = ({
  availabilityMode,
  availabilityInfo,
  onRefresh,
  align = 'right',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen]);

  const isChecking = availabilityMode === 'checking' && !availabilityInfo;
  const llmState = availabilityInfo?.provider || (availabilityMode === 'online_ai' ? 'available' : 'unavailable');
  const webState = availabilityInfo?.web_search || 'unknown';
  const dbReady = availabilityInfo
    ? availabilityInfo.database === 'available' && availabilityInfo.backend === 'available'
    : availabilityMode !== 'checking';

  const llmLevel: HealthLevel = isChecking
    ? 'checking'
    : llmState === 'available'
    ? 'ok'
    : llmState === 'not_configured'
    ? 'warn'
    : 'err';

  const webLevel: HealthLevel = isChecking
    ? 'checking'
    : webState === 'available'
    ? 'ok'
    : webState === 'not_configured'
    ? 'warn'
    : webState === 'unavailable'
    ? 'err'
    : 'checking';

  const kbLevel: HealthLevel = isChecking ? 'checking' : dbReady ? 'ok' : 'err';

  const overallLevel: HealthLevel = isChecking
    ? 'checking'
    : llmLevel === 'ok' && webLevel === 'ok' && kbLevel === 'ok'
    ? 'ok'
    : kbLevel === 'err' || llmLevel === 'err'
    ? 'err'
    : 'warn';

  const rows: RowStatus[] = [
    {
      label: 'Mô hình AI (LLM)',
      statusText:
        llmLevel === 'ok'
          ? 'Hoạt động'
          : llmLevel === 'warn'
          ? 'Chưa cấu hình'
          : llmLevel === 'err'
          ? 'Gián đoạn'
          : 'Đang kiểm tra',
      level: llmLevel,
    },
    {
      label: 'Tìm kiếm Web (Serper)',
      statusText:
        webLevel === 'ok'
          ? 'Hoạt động'
          : webLevel === 'warn'
          ? 'Chưa bật'
          : webLevel === 'err'
          ? 'Lỗi kết nối'
          : 'Đang kiểm tra',
      level: webLevel,
    },
    {
      label: 'Kho Dược thư nội bộ',
      statusText: kbLevel === 'ok' ? 'Sẵn sàng' : kbLevel === 'err' ? 'Ngoại tuyến' : 'Đang kiểm tra',
      level: kbLevel,
    },
  ];

  const handleRefresh = async () => {
    if (!onRefresh || isRefreshing) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  const checkedTimeLabel = availabilityInfo?.checked_at
    ? new Date(availabilityInfo.checked_at).toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        data-testid="service-status-badge"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className={`relative p-1.5 rounded-lg transition cursor-pointer active:scale-95 ${
          isOpen
            ? 'bg-slate-100 text-slate-900'
            : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
        }`}
        title={`Trạng thái hệ thống · LLM: ${rows[0].statusText} · Web: ${rows[1].statusText}`}
        aria-label={`Trạng thái dịch vụ: LLM ${rows[0].statusText}, Tìm kiếm Web ${rows[1].statusText}`}
      >
        <Activity className="w-4 h-4" />
        <span
          className={`absolute top-1 right-1 w-2 h-2 rounded-full ring-2 ring-white ${dotClass(overallLevel)}`}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Trạng thái dịch vụ AI"
          data-testid="service-status-popover"
          className={`clinical-prose absolute top-full mt-1.5 z-50 w-64 rounded-xl bg-white border border-slate-200/90 shadow-lg p-3 text-left animate-in fade-in duration-150 ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
            <span className="text-[12px] font-semibold text-slate-800">Trạng thái dịch vụ</span>
            {onRefresh && (
              <button
                type="button"
                data-testid="service-status-refresh-btn"
                onClick={() => void handleRefresh()}
                disabled={isRefreshing}
                className="p-1 rounded-md text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer disabled:opacity-50"
                title="Kiểm tra lại"
                aria-label="Kiểm tra lại"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-teal-700' : ''}`} />
              </button>
            )}
          </div>

          <div className="space-y-2">
            {rows.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-2 text-[12.5px]">
                <span className="text-slate-700 truncate">{row.label}</span>
                <span className={`inline-flex items-center gap-1.5 text-[11.5px] font-medium shrink-0 ${statusTextClass(row.level)}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${dotClass(row.level)}`} />
                  <span>{row.statusText}</span>
                </span>
              </div>
            ))}
          </div>

          {checkedTimeLabel && (
            <div className="mt-2 pt-1.5 border-t border-slate-100 text-[10.5px] text-slate-400">
              Cập nhật {checkedTimeLabel}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
