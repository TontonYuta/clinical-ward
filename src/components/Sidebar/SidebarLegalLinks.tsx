/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ClipboardList, Scale, BookOpen, Printer } from 'lucide-react';

interface SidebarLegalLinksProps {
  isCollapsed: boolean;
  onCloseMobile?: () => void;
  onOpenAuditTrail: () => void;
  onOpenLegalDocs: () => void;
  onOpenUserGuide: () => void;
  onOpenPrintableForms?: () => void;
}

export const SidebarLegalLinks: React.FC<SidebarLegalLinksProps> = ({
  isCollapsed,
  onCloseMobile,
  onOpenAuditTrail,
  onOpenLegalDocs,
  onOpenUserGuide,
  onOpenPrintableForms,
}) => {
  const handleClick = (action: () => void) => {
    action();
    onCloseMobile?.();
  };

  return (
    <div>
      {!isCollapsed && (
        <div className="px-2.5 pb-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
          Quản trị &amp; pháp lý
        </div>
      )}
      <div className="space-y-1">
        <button
          onClick={() => handleClick(onOpenAuditTrail)}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[14px] sm:text-[15px] font-medium text-slate-700 hover:bg-slate-100/80 hover:text-slate-900 transition cursor-pointer ${
            isCollapsed ? 'justify-center px-0' : ''
          }`}
          title="Nhật ký kiểm toán lâm sàng và vết băm bảo mật (NĐ 130/2018)"
        >
          <ClipboardList className="w-5 h-5 text-teal-700 shrink-0" />
          {!isCollapsed && <span className="flex-1 text-left truncate">Nhật ký kiểm toán</span>}
        </button>

        <button
          onClick={() => handleClick(onOpenLegalDocs)}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[14px] sm:text-[15px] font-medium text-slate-700 hover:bg-slate-100/80 hover:text-slate-900 transition cursor-pointer ${
            isCollapsed ? 'justify-center px-0' : ''
          }`}
          title="Căn cứ pháp lý y tế & quy chế chuyên môn Bộ Y Tế"
        >
          <Scale className="w-5 h-5 text-teal-700 shrink-0" />
          {!isCollapsed && <span className="flex-1 text-left truncate">Căn cứ pháp lý y tế</span>}
        </button>

        <button
          onClick={() => handleClick(onOpenUserGuide)}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[14px] sm:text-[15px] font-medium text-slate-700 hover:bg-slate-100/80 hover:text-slate-900 transition cursor-pointer ${
            isCollapsed ? 'justify-center px-0' : ''
          }`}
          title="Hướng dẫn sử dụng và quy trình vận hành ca trực"
        >
          <BookOpen className="w-5 h-5 text-teal-700 shrink-0" />
          {!isCollapsed && <span className="flex-1 text-left truncate">Hướng dẫn vận hành</span>}
        </button>

        <button
          onClick={() => handleClick(() => onOpenPrintableForms?.())}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[14px] sm:text-[15px] font-medium text-slate-700 hover:bg-slate-100/80 hover:text-slate-900 transition cursor-pointer ${
            isCollapsed ? 'justify-center px-0' : ''
          }`}
          title="Xuất và in biểu mẫu hành chính y tế chuẩn A4 (TT 18, TT 26, NĐ 151, NĐ 98)"
        >
          <Printer className="w-5 h-5 text-teal-700 shrink-0" />
          {!isCollapsed && <span className="flex-1 text-left truncate">Biểu mẫu in A4</span>}
        </button>
      </div>
    </div>
  );
};
