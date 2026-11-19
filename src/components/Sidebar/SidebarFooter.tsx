/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Footer Sidebar: Nút người dùng tích hợp Thông tin cá nhân & Cấu hình (<100 LOC)
 */

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, UserRound, Sliders, LogOut } from 'lucide-react';
import { UserRole } from '../../types/clinical';
import type { AppFontScale, AppFontFamily } from '../../utils/storage/appStatePersistence';
import { SettingsModal } from '../Settings/SettingsModal';
import { UserProfileModal } from '../Modals/UserProfileModal';
import { USER_PROFILES } from '../../data/initialData';

interface SidebarFooterProps {
  isCollapsed: boolean;
  currentUserRole: UserRole;
  onSelectUserRole?: (role: UserRole) => void;
  onLogout?: () => Promise<void>;
  isAuthenticated: boolean;
  username?: string;
  fontScale: AppFontScale;
  onFontScaleChange: (scale: AppFontScale) => void;
  fontFamily?: AppFontFamily;
  onFontFamilyChange?: (font: AppFontFamily) => void;
  onCloseMobile?: () => void;
}

export const SidebarFooter: React.FC<SidebarFooterProps> = ({
  isCollapsed,
  currentUserRole,
  onLogout,
  isAuthenticated,
  username,
  fontScale,
  onFontScaleChange,
  fontFamily = 'inter',
  onFontFamilyChange = () => {},
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const profile = USER_PROFILES[currentUserRole] || USER_PROFILES.nurse;

  // Đóng menu khi click ra ngoài
  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  const handleLogout = () => {
    setIsMenuOpen(false);
    if (onLogout) {
      void onLogout();
    } else {
      sessionStorage.removeItem('clinical_active_role');
      sessionStorage.removeItem('clinical_active_username');
      window.location.reload();
    }
  };

  return (
    <div ref={menuRef} className="relative border-t border-slate-200 p-2 shrink-0">
      {/* Menu lựa chọn khi bấm vào Icon người dùng */}
      {isMenuOpen && (
        <div
          role="menu"
          aria-label="Tùy chọn tài khoản"
          className={`absolute bottom-full mb-2 ${
            isCollapsed ? 'left-14 w-64' : 'left-2 right-2'
          } rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150`}
        >
          {/* Header tóm tắt người dùng */}
          <div className="px-2.5 py-2 mb-1 border-b border-slate-100">
            <p className="text-xs font-bold text-slate-900 truncate">{profile.name}</p>
            <p className="text-[11px] font-medium text-slate-500 truncate">{profile.roleName}</p>
          </div>

          {/* Lựa chọn 1: Thông tin cá nhân */}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setIsMenuOpen(false);
              setIsProfileModalOpen(true);
            }}
            className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-teal-50 hover:text-teal-800 transition cursor-pointer"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 text-teal-700 shrink-0">
              <UserRound className="h-4 w-4" />
            </span>
            <span>Thông tin cá nhân</span>
          </button>

          {/* Lựa chọn 2: Cấu hình (Cỡ chữ / Hiển thị) */}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setIsMenuOpen(false);
              setIsSettingsOpen(true);
            }}
            className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition mt-0.5 cursor-pointer"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600 shrink-0">
              <Sliders className="h-4 w-4" />
            </span>
            <span>Cấu hình hiển thị</span>
          </button>

          {/* Lựa chọn 3: Đăng xuất */}
          <div className="mt-1 pt-1 border-t border-slate-100">
            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 transition cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>
      )}

      {/* Nút bấm Người dùng duy nhất ở Sidebar */}
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={isMenuOpen}
        onClick={() => setIsMenuOpen((prev) => !prev)}
        className={`flex min-h-11 w-full items-center gap-2.5 rounded-xl p-1.5 text-left hover:bg-slate-100 transition ${
          isCollapsed ? 'justify-center' : ''
        } ${isMenuOpen ? 'bg-slate-100' : ''}`}
        title={`${profile.name} · ${profile.roleName}`}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-700 shadow-xs">
          <UserRound className="h-4 w-4 text-slate-700" />
        </span>
        {!isCollapsed && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-slate-900">{profile.name}</span>
              <span className="block truncate text-xs text-slate-500">{profile.roleName}</span>
            </span>
            <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
          </>
        )}
      </button>

      {/* Modal Thông tin cá nhân chuyên biệt chuẩn UI */}
      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        profile={profile}
      />

      {/* Modal Cấu hình hiển thị (Cỡ chữ & Phông chữ) */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        fontScale={fontScale}
        onFontScaleChange={onFontScaleChange}
        fontFamily={fontFamily}
        onFontFamilyChange={onFontFamilyChange}
        isAuthenticated={isAuthenticated}
        username={username}
        roleLabel={profile.roleName}
        onLogout={onLogout}
      />
    </div>
  );
};
