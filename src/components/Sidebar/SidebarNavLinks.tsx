/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { FileText, Boxes, Wrench, Stethoscope } from 'lucide-react';
import { DashboardTab } from '../RightPane/Dashboard';

interface SidebarNavLinksProps {
  currentTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  allowedTabs: string[];
  isCollapsed: boolean;
  onCloseMobile?: () => void;
  debtCount: number;
  urgentTicketsCount: number;
  nearExpiryAndLowStockCount: number;
}

export const SidebarNavLinks: React.FC<SidebarNavLinksProps> = ({
  currentTab,
  onTabChange,
  allowedTabs,
  isCollapsed,
  onCloseMobile,
  debtCount,
  urgentTicketsCount,
  nearExpiryAndLowStockCount,
}) => {
  const handleSelectTab = (tab: DashboardTab) => {
    onTabChange(tab);
    onCloseMobile?.();
  };

  return (
    <>
      {/* Phân Hệ Dược Lâm Sàng */}
      {(allowedTabs.includes('cpoe') || allowedTabs.includes('debt') || allowedTabs.includes('fefo')) && (
        <div>
          {!isCollapsed && (
            <div className="px-2.5 pb-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
              Dược Lâm Sàng
            </div>
          )}
          <div className="space-y-1">
            {allowedTabs.includes('cpoe') && (
              <button
                onClick={() => handleSelectTab('cpoe')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[15px] transition cursor-pointer ${
                  currentTab === 'cpoe'
                    ? 'bg-teal-50 text-teal-950 font-bold border border-teal-200/80 shadow-2xs'
                    : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900 font-medium'
                } ${isCollapsed ? 'justify-center px-0' : ''}`}
                title="Chỉ định Y lệnh & Kê đơn điện tử (TT 26/2025/TT-BYT)"
              >
                <Stethoscope
                  className={`w-5 h-5 shrink-0 ${currentTab === 'cpoe' ? 'text-teal-700' : 'text-slate-400'}`}
                />
                {!isCollapsed && <span className="flex-1 text-left truncate">Chỉ Định &amp; Kê Đơn CPOE</span>}
              </button>
            )}

            {allowedTabs.includes('debt') && (
              <button
                onClick={() => handleSelectTab('debt')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[15px] transition cursor-pointer ${
                  currentTab === 'debt'
                    ? 'bg-teal-50 text-teal-950 font-bold border border-teal-200/80 shadow-2xs'
                    : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900 font-medium'
                } ${isCollapsed ? 'justify-center px-0' : ''}`}
                title="Sổ nợ tủ trực cấp cứu (TT 22 & TT 20)"
              >
                <FileText
                  className={`w-5 h-5 shrink-0 ${currentTab === 'debt' ? 'text-teal-700' : 'text-slate-400'}`}
                />
                {!isCollapsed && (
                  <>
                    <span className="flex-1 text-left truncate">Sổ nợ tủ trực</span>
                    {debtCount > 0 && (
                      <span className="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200/80 tabular-nums">
                        {debtCount}
                      </span>
                    )}
                  </>
                )}
              </button>
            )}

            {allowedTabs.includes('fefo') && (
              <button
                onClick={() => handleSelectTab('fefo')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[15px] transition cursor-pointer ${
                  currentTab === 'fefo'
                    ? 'bg-teal-50 text-teal-950 font-bold border border-teal-200/80 shadow-2xs'
                    : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900 font-medium'
                } ${isCollapsed ? 'justify-center px-0' : ''}`}
                title="Kho Dược - Hạn dùng FEFO & Định mức (TT 36 GSP)"
              >
                <Boxes
                  className={`w-5 h-5 shrink-0 ${currentTab === 'fefo' ? 'text-teal-700' : 'text-slate-400'}`}
                />
                {!isCollapsed && (
                  <>
                    <span className="flex-1 text-left truncate">Kho Dược &amp; Tủ Trực</span>
                    {nearExpiryAndLowStockCount > 0 && (
                      <span className="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-rose-50 text-rose-800 border border-rose-200/80 tabular-nums">
                        {nearExpiryAndLowStockCount}
                      </span>
                    )}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Phân Hệ Thiết Bị & Kỹ Thuật */}
      {allowedTabs.includes('equipment') && (
        <div>
          {!isCollapsed && (
            <div className="px-2.5 pb-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
              Thiết Bị &amp; Tài Sản
            </div>
          )}
          <div className="space-y-1">
            <button
              onClick={() => handleSelectTab('equipment')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[15px] transition cursor-pointer ${
                currentTab === 'equipment'
                  ? 'bg-teal-50 text-teal-950 font-bold border border-teal-200/80 shadow-2xs'
                  : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900 font-medium'
              } ${isCollapsed ? 'justify-center px-0' : ''}`}
              title="Sự cố & Kiểm định trang thiết bị y tế (NĐ 04/2025 & NĐ 98/2021)"
            >
              <Wrench
                className={`w-5 h-5 shrink-0 ${currentTab === 'equipment' ? 'text-teal-700' : 'text-slate-400'}`}
              />
              {!isCollapsed && (
                <>
                  <span className="flex-1 text-left truncate">Sự cố &amp; Kiểm định</span>
                  {urgentTicketsCount > 0 && (
                    <span className="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-rose-50 text-rose-800 border border-rose-200/80 tabular-nums">
                      {urgentTicketsCount}
                    </span>
                  )}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
