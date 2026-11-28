import React, { useState, useRef, useEffect } from 'react';
import {
  Activity,
  ExternalLink,
  RotateCcw,
  Radio,
  LogOut,
  LockKeyhole,
  LockKeyholeOpen,
  Menu,
  ChevronDown,
} from 'lucide-react';

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
  const [accountOpen, setAccountOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!accountOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAccountOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [accountOpen]);

  const displayName = authenticatedName || authenticatedUsername || 'Quản trị viên';
  const initials = displayName.slice(0, 2).toUpperCase();
  const hasAccountMenu = Boolean(authenticatedName || authenticatedUsername || canConfigureAuth || onLogout);

  return (
    <header className="h-14 bg-white border-b border-slate-200/90 px-3 sm:px-5 flex items-center justify-between shrink-0 z-20">
      {/* Left: Brand & Status */}
      <div className="flex items-center gap-2.5 min-w-0">
        {onOpenMobileMenu && (
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="lg:hidden h-8 w-8 inline-flex items-center justify-center -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition cursor-pointer"
            aria-label="Mở menu quản trị"
          >
            <Menu className="w-4.5 h-4.5" />
          </button>
        )}
        <div className="h-8 w-8 rounded-lg bg-teal-800 text-white flex items-center justify-center shrink-0">
          <Activity className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-sm sm:text-[15px] font-semibold text-slate-900 tracking-tight whitespace-nowrap leading-tight">
              Clinical AI Monitor
            </h1>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/70 text-3xs font-medium text-emerald-700 leading-none">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="hidden xs:inline">Live</span>
            </span>
          </div>
          <p className="text-2xs text-slate-500 hidden sm:block truncate leading-tight mt-0.5">
            Giám sát vận hành AI, Token &amp; An toàn BHYT
          </p>
        </div>
      </div>

      {/* Right: Unified 32px Controls */}
      <div className="flex items-center gap-2">
        {lastUpdated && (
          <span
            className="hidden xl:inline-flex items-center text-2xs font-mono text-slate-500 tabular-nums px-1.5"
            title="Cập nhật gần nhất"
          >
            {lastUpdated}
          </span>
        )}

        {/* Segmented Auto-refresh + Manual refresh */}
        <div className="inline-flex items-center h-8 rounded-lg border border-slate-200 bg-white overflow-hidden">
          <button
            type="button"
            onClick={onToggleAutoRefresh}
            className={`h-full px-2.5 text-xs font-medium inline-flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
              autoRefresh
                ? 'bg-teal-50/80 text-teal-800 hover:bg-teal-50'
                : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
            title={autoRefresh ? 'Đang tự động làm mới mỗi 30 giây — bấm để tắt' : 'Bật tự động làm mới mỗi 30 giây'}
          >
            <Radio className={`w-3.5 h-3.5 shrink-0 ${autoRefresh ? 'text-teal-600' : 'text-slate-400'}`} />
            <span className="hidden sm:inline">{autoRefresh ? 'Tự làm mới · 30s' : 'Tự làm mới: Tắt'}</span>
          </button>
          <div className="w-px h-4 bg-slate-200" />
          <button
            type="button"
            onClick={onManualRefresh}
            disabled={isRefreshing}
            className="h-full w-8 inline-flex items-center justify-center text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition cursor-pointer disabled:opacity-50"
            title="Làm mới dữ liệu ngay"
            aria-label="Làm mới dữ liệu ngay"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-teal-700' : ''}`} />
          </button>
        </div>

        {/* Account & Auth Popover (replaces 3 separate clutter buttons) */}
        {hasAccountMenu && (
          <div className="relative hidden sm:block" ref={menuRef}>
            <button
              type="button"
              onClick={() => setAccountOpen((v) => !v)}
              aria-expanded={accountOpen}
              className="h-8 px-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium inline-flex items-center gap-1.5 transition cursor-pointer"
            >
              <span className="w-5 h-5 rounded-full bg-teal-800 text-white text-3xs font-semibold flex items-center justify-center shrink-0">
                {initials}
              </span>
              <span className="hidden md:inline max-w-[120px] truncate font-medium text-slate-800">
                {displayName}
              </span>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${accountOpen ? 'rotate-180' : ''}`} />
            </button>

            {accountOpen && (
              <div className="absolute right-0 mt-1.5 w-60 rounded-xl bg-white border border-slate-200 shadow-lg py-1.5 z-40">
                <div className="px-3 py-2 border-b border-slate-100">
                  <div className="text-xs font-semibold text-slate-900 truncate">{displayName}</div>
                  <div className="text-2xs text-slate-500 mt-0.5">Phiên quản trị hệ thống</div>
                </div>

                {canConfigureAuth && (
                  <button
                    type="button"
                    onClick={() => {
                      onToggleAuth();
                      setAccountOpen(false);
                    }}
                    aria-pressed={authEnabled}
                    className="w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center justify-between gap-2 transition cursor-pointer"
                    title="Chỉ ẩn hoặc hiện form đăng nhập trên thiết bị này. API backend vẫn xác thực theo phiên."
                  >
                    <span className="inline-flex items-center gap-2">
                      {authEnabled ? (
                        <LockKeyhole className="w-3.5 h-3.5 text-teal-700" />
                      ) : (
                        <LockKeyholeOpen className="w-3.5 h-3.5 text-slate-400" />
                      )}
                      <span>Form đăng nhập thiết bị</span>
                    </span>
                    <span className={`text-3xs font-mono font-semibold px-1.5 py-0.5 rounded ${
                      authEnabled ? 'bg-teal-50 text-teal-800' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {authEnabled ? 'Hiện' : 'Ẩn'}
                    </span>
                  </button>
                )}

                {onLogout && (
                  <button
                    type="button"
                    onClick={() => {
                      setAccountOpen(false);
                      void onLogout();
                    }}
                    className="w-full px-3 py-2 text-left text-xs text-rose-700 hover:bg-rose-50/70 flex items-center gap-2 transition cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Đăng xuất</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Primary CTA: Cổng Bác Sĩ */}
        <a
          href={clinicalAppUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="h-8 px-3 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium inline-flex items-center gap-1.5 transition active:scale-[0.98] shrink-0 whitespace-nowrap"
          title="Mở ứng dụng khám chữa bệnh cho Bác sĩ & Điều dưỡng"
        >
          <span className="hidden sm:inline">Cổng Bác Sĩ</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </header>
  );
};
