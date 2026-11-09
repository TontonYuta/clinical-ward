import React from 'react';
import { Activity, ExternalLink, RotateCcw, ShieldCheck, Radio } from 'lucide-react';

interface AdminHeaderProps {
  autoRefresh: boolean;
  onToggleAutoRefresh: () => void;
  onManualRefresh: () => void;
  isRefreshing: boolean;
  clinicalAppUrl?: string;
  lastUpdated?: string;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({
  autoRefresh,
  onToggleAutoRefresh,
  onManualRefresh,
  isRefreshing,
  clinicalAppUrl = typeof window !== 'undefined'
    ? (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? `${window.location.protocol}//${window.location.hostname}:3000`
        : 'https://clinical-ward.vercel.app')
    : 'http://localhost:3000',
  lastUpdated
}) => {
  return (
    <header className="h-15 bg-white border-b border-slate-200/80 px-4 sm:px-6 flex items-center justify-between shrink-0 shadow-2xs z-20">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-teal-800 text-white flex items-center justify-center shadow-xs">
          <Activity className="w-4.5 h-4.5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              Clinical AI Monitor
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Live
            </span>
          </div>
          <p className="text-xs text-slate-500 hidden sm:block">
            Giám sát vận hành AI, Token &amp; An toàn BHYT
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5 sm:gap-3">
        {lastUpdated && (
          <span className="text-2xs font-mono text-slate-400 hidden xl:inline">
            Cập nhật: {lastUpdated}
          </span>
        )}
        {/* Toggle Auto Refresh */}
        <button
          type="button"
          onClick={onToggleAutoRefresh}
          className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition cursor-pointer ${
            autoRefresh
              ? 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow-2xs'
              : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
          }`}
          title="Tự động cập nhật số liệu mỗi 10 giây"
        >
          <Radio className={`w-3.5 h-3.5 ${autoRefresh ? 'text-emerald-600 animate-pulse' : 'text-slate-400'}`} />
          <span>{autoRefresh ? 'Tự làm mới (10s)' : 'Tự làm mới: Tắt'}</span>
        </button>

        {/* Nút làm mới tức thì */}
        <button
          type="button"
          onClick={onManualRefresh}
          disabled={isRefreshing}
          className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition cursor-pointer disabled:opacity-50"
          title="Làm mới dữ liệu ngay lập tức"
        >
          <RotateCcw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-teal-700' : ''}`} />
        </button>

        {/* Liên kết sang Cổng Lâm Sàng Bác Sĩ */}
        <a
          href={clinicalAppUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 rounded-lg bg-teal-800 hover:bg-teal-900 text-white text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition cursor-pointer hover:shadow-xs active:scale-98"
          title="Chuyển sang ứng dụng khám chữa bệnh cho Bác sĩ & Điều dưỡng"
        >
          <span>Cổng Bác Sĩ</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </header>
  );
};
