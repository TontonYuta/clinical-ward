import React from 'react';
import { Activity, ExternalLink, RotateCcw, ShieldCheck, Radio, LogOut, LockKeyhole, LockKeyholeOpen, Menu } from 'lucide-react';

interface AdminHeaderProps {
  autoRefresh: boolean;
  onToggleAutoRefresh: () => void;
  onManualRefresh: () => void;
  isRefreshing: boolean;
  clinicalAppUrl?: string;
  lastUpdated?: string;
  authenticatedUsername?: string;
  authenticatedName?: string;
  onLogout?: () => Promise<void>;
  authEnabled: boolean;
  canConfigureAuth: boolean;
  onToggleAuth: () => void;
  onOpenMobileMenu?: () => void;
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
  lastUpdated,
  authenticatedUsername,
  authenticatedName,
  onLogout,
  authEnabled,
  canConfigureAuth,
  onToggleAuth,
  onOpenMobileMenu,
}) => {
  return (
    <header className="h-14 sm:h-15 bg-white border-b border-slate-200/80 px-3 sm:px-6 flex items-center justify-between shrink-0 shadow-2xs z-20">
      <div className="flex items-center gap-2 sm:gap-3">
        {onOpenMobileMenu && (
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="lg:hidden p-1.5 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
            aria-label="Mở menu quản trị"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <div className="h-8 w-8 sm:h-8.5 sm:w-8.5 rounded-lg bg-teal-800 text-white flex items-center justify-center shadow-xs shrink-0">
          <Activity className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
        </div>
        <div className="flex items-center gap-2.5">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xs sm:text-base font-bold text-slate-900 tracking-tight whitespace-nowrap">
                Clinical AI Monitor
              </h1>
              <span className="inline-flex items-center gap-1.5 text-2xs font-mono text-slate-500">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span className="hidden xs:inline">Live</span>
              </span>
            </div>
            <p className="text-2xs text-slate-500 hidden sm:block">
              Giám sát vận hành AI, Token &amp; An toàn BHYT
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2.5">
        {(authenticatedName || authenticatedUsername) && (
          <div className="hidden md:inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200/70 text-slate-800 text-xs font-medium">
            <div className="w-5 h-5 rounded-full bg-teal-800 text-white text-3xs font-bold flex items-center justify-center uppercase shrink-0">
              {(authenticatedName || authenticatedUsername || 'AD').slice(0, 2)}
            </div>
            <span className="truncate max-w-[150px] font-semibold">{authenticatedName || authenticatedUsername}</span>
          </div>
        )}
        {canConfigureAuth && (
          <button
            type="button"
            onClick={onToggleAuth}
            aria-pressed={authEnabled}
            className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
            title="Chỉ ẩn hoặc hiện form trên thiết bị này. API backend vẫn xác thực theo phiên."
          >
            {authEnabled ? <LockKeyhole className="h-3.5 w-3.5 text-slate-500" /> : <LockKeyholeOpen className="h-3.5 w-3.5 text-slate-400" />}
            <span className="hidden lg:inline">{authEnabled ? 'Form: Hiện' : 'Form: Ẩn'}</span>
          </button>
        )}
        {onLogout && (
          <button
            type="button"
            onClick={() => void onLogout()}
            className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition"
            title="Đăng xuất"
          >
            <LogOut className="h-3.5 w-3.5 text-slate-500" />
            <span className="hidden md:inline">Đăng xuất</span>
          </button>
        )}
        {lastUpdated && (
          <span className="text-2xs font-mono text-slate-400 hidden xl:inline">
            {lastUpdated}
          </span>
        )}

        {/* Toggle Auto Refresh */}
        <button
          type="button"
          onClick={onToggleAutoRefresh}
          className={`px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition cursor-pointer ${
            autoRefresh
              ? 'bg-slate-100 text-teal-800 border-slate-300 font-medium'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
          title="Tự động cập nhật số liệu mỗi 10 giây"
        >
          <Radio className={`w-3.5 h-3.5 shrink-0 ${autoRefresh ? 'text-teal-600' : 'text-slate-400'}`} />
          <span className="hidden sm:inline">{autoRefresh ? 'Tự làm mới (10s)' : 'Tự làm mới: Tắt'}</span>
        </button>

        {/* Nút làm mới tức thì */}
        <button
          type="button"
          onClick={onManualRefresh}
          disabled={isRefreshing}
          className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition cursor-pointer disabled:opacity-50"
          title="Làm mới dữ liệu ngay lập tức"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-teal-700' : ''}`} />
        </button>

        {/* Liên kết sang Cổng Lâm Sàng Bác Sĩ */}
        <a
          href={clinicalAppUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-all hover:shadow-xs active:scale-98 shrink-0"
          title="Chuyển sang ứng dụng khám chữa bệnh cho Bác sĩ & Điều dưỡng"
        >
          <span className="hidden sm:inline">Cổng Bác Sĩ</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </header>
  );
};
