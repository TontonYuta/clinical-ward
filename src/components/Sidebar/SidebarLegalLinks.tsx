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
          Quản Trị &amp; Pháp Lý
        </div>
      )}
      <div className="space-y-1">
        <button
          onClick={() => handleClick(onOpenAuditTrail)}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[15px] font-medium text-slate-700 hover:bg-slate-100/80 hover:text-slate-900 transition cursor-pointer ${
            isCollapsed ? 'justify-center px-0' : ''
          }`}
          title="Nhật Ký Kiểm Toán Lâm Sàng (NĐ 130)"
        >
          <ClipboardList className="w-5 h-5 text-teal-700 shrink-0" />
          {!isCollapsed && <span className="flex-1 text-left truncate">Nhật Ký Kiểm Toán</span>}
        </button>

        <button
          onClick={() => handleClick(onOpenLegalDocs)}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[15px] font-medium text-slate-700 hover:bg-slate-100/80 hover:text-slate-900 transition cursor-pointer ${
            isCollapsed ? 'justify-center px-0' : ''
          }`}
          title="Căn Cứ Pháp Lý & Quy Định Bộ Y Tế (Docs)"
        >
          <Scale className="w-5 h-5 text-teal-700 shrink-0" />
          {!isCollapsed && <span className="flex-1 text-left truncate">Căn Cứ Pháp Lý</span>}
        </button>

        <button
          onClick={() => handleClick(onOpenUserGuide)}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[15px] font-medium text-slate-700 hover:bg-slate-100/80 hover:text-slate-900 transition cursor-pointer ${
            isCollapsed ? 'justify-center px-0' : ''
          }`}
          title="Tài Liệu Hướng Dẫn Sử Dụng Chi Tiết (HDSD)"
        >
          <BookOpen className="w-5 h-5 text-teal-700 shrink-0" />
          {!isCollapsed && <span className="flex-1 text-left truncate">Hướng Dẫn Sử Dụng</span>}
        </button>

        <button
          onClick={() => handleClick(() => onOpenPrintableForms?.())}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[15px] font-medium text-slate-700 hover:bg-slate-100/80 hover:text-slate-900 transition cursor-pointer ${
            isCollapsed ? 'justify-center px-0' : ''
          }`}
          title="Xuất &amp; In Biểu Mẫu Hành Chính Y Tế (TT 20, TT 22, NĐ 151, NĐ 98)"
        >
          <Printer className="w-5 h-5 text-teal-700 shrink-0" />
          {!isCollapsed && <span className="flex-1 text-left truncate">Biểu Mẫu Y Tế (A4)</span>}
        </button>
      </div>
    </div>
  );
};
