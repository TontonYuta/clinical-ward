/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Cross, X } from 'lucide-react';

interface SidebarHeaderProps {
  isCollapsed: boolean;
  onCloseMobile?: () => void;
}

export const SidebarHeader: React.FC<SidebarHeaderProps> = ({
  isCollapsed,
  onCloseMobile,
}) => {
  return (
    <div className="h-14 px-4 flex items-center justify-between border-b border-slate-200/80 shrink-0">
      {!isCollapsed ? (
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-teal-800 flex items-center justify-center text-white shadow-2xs shrink-0">
            <Cross className="w-5 h-5 text-emerald-300" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[15px] font-bold text-slate-900 tracking-tight whitespace-nowrap leading-tight">
              Kho Y Tế Lâm Sàng
            </span>
            <span className="text-xs text-slate-500 font-medium whitespace-nowrap mt-0.5">
              Bệnh Viện Đa Khoa
            </span>
          </div>
        </div>
      ) : (
        <div className="w-full flex justify-center">
          <div className="w-9 h-9 rounded-xl bg-teal-800 flex items-center justify-center text-white shadow-2xs">
            <Cross className="w-5 h-5 text-emerald-300" />
          </div>
        </div>
      )}

      {onCloseMobile && (
        <button
          onClick={onCloseMobile}
          className="md:hidden p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          title="Đóng menu"
        >
          <X className="w-5 h-5" />
        </button>
      )}
    </div>
  );
};
