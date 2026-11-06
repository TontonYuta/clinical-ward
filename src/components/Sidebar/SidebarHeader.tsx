/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Cross, X, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

interface SidebarHeaderProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onCloseMobile?: () => void;
}

export const SidebarHeader: React.FC<SidebarHeaderProps> = ({
  isCollapsed,
  onToggleCollapse,
  onCloseMobile,
}) => {
  return (
    <div className="relative h-14 flex items-center border-b border-slate-200/80 shrink-0">
      <div className={`flex h-full items-center ${isCollapsed ? 'w-full justify-center' : 'flex-1 min-w-0'}`}>
        <button
          type="button"
          onClick={onToggleCollapse}
          className={`relative flex h-14 w-14 shrink-0 items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 cursor-pointer ${isCollapsed ? 'group/brand hover:bg-slate-100' : ''}`}
          title={isCollapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
          aria-label={isCollapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 via-sky-500 to-teal-500 text-white shadow-md shadow-sky-500/25 ring-1 ring-sky-300/40 transition-all duration-200 group-hover/brand:scale-105">
            <Cross className="h-5 w-5 text-white fill-white" />
          </span>
          {isCollapsed && (
            <span className="absolute inset-0 flex items-center justify-center text-slate-700 opacity-0 transition-opacity group-hover/brand:opacity-100 group-focus-visible/brand:opacity-100">
              <PanelLeftOpen className="h-5 w-5" />
            </span>
          )}
        </button>
        {!isCollapsed && (
          <>
            <span className="min-w-0 flex-1 truncate pr-2 text-sm font-semibold tracking-tight text-slate-900">Kho Y Tế Lâm Sàng</span>
            <button
              type="button"
              onClick={onToggleCollapse}
              className="mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 cursor-pointer"
              title="Thu gọn menu"
              aria-label="Thu gọn menu"
            >
              <PanelLeftClose className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      {onCloseMobile && (
        <button
          onClick={onCloseMobile}
          className="md:hidden p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer absolute right-2 top-3"
          title="Đóng menu"
        >
          <X className="w-5 h-5" />
        </button>
      )}
    </div>
  );
};
