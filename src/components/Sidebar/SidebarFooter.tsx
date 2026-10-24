/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ChevronRight } from 'lucide-react';

interface SidebarFooterProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const SidebarFooter: React.FC<SidebarFooterProps> = ({
  isCollapsed,
  onToggleCollapse,
}) => {
  return (
    <div className="border-t border-slate-200/80 p-3 shrink-0 bg-slate-50/70">
      {!isCollapsed ? (
        <div className="flex items-center justify-between text-xs text-slate-500 font-medium px-1">
          <span className="truncate">Chuẩn BYT: TT 26 &amp; NĐ 04/2025</span>
          <span className="font-mono text-teal-700 font-bold bg-teal-50 px-2 py-0.5 rounded border border-teal-200/60">
            GSP 2026
          </span>
        </div>
      ) : (
        <div className="flex flex-col items-center">
          <button
            onClick={onToggleCollapse}
            className="w-9 h-9 rounded-lg bg-teal-50 text-teal-800 flex items-center justify-center hover:bg-teal-100 transition cursor-pointer"
            title="Mở rộng menu thanh bên"
          >
            <ChevronRight className="w-4.5 h-4.5" />
          </button>
        </div>
      )}
    </div>
  );
};
