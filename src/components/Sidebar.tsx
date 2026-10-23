/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Cross,
  FileText,
  Boxes,
  ThermometerSnowflake,
  Wrench,
  Building2,
  ClipboardList,
  Scale,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Shield,
  Lock,
  Printer,
  X
} from 'lucide-react';
import { DashboardTab } from './RightPane/Dashboard';
import { UserRole } from '../types/clinical';
import { USER_PROFILES } from '../data/initialData';

export interface SidebarProps {
  currentTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  currentUserRole: UserRole;
  onSelectUserRole?: (role: UserRole) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onCloseMobile?: () => void;
  debtCount: number;
  urgentTicketsCount: number;
  nearExpiryAndLowStockCount: number;
  coldChainTemp: number;
  isColdAlarm: boolean;
  misallocatedAssetsCount: number;
  onOpenLegalDocs: () => void;
  onOpenAuditTrail: () => void;
  onOpenUserGuide: () => void;
  onOpenPrintableForms?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  currentUserRole,
  onSelectUserRole,
  isCollapsed,
  onToggleCollapse,
  onCloseMobile,
  debtCount,
  urgentTicketsCount,
  nearExpiryAndLowStockCount,
  coldChainTemp,
  isColdAlarm,
  misallocatedAssetsCount,
  onOpenLegalDocs,
  onOpenAuditTrail,
  onOpenUserGuide,
  onOpenPrintableForms,
}) => {
  const currentProfile = USER_PROFILES[currentUserRole] || USER_PROFILES.nurse;
  const allowedTabs = currentProfile.allowedTabs || ['debt'];

  return (
    <aside
      className={`h-full flex flex-col shrink-0 bg-white border-r border-slate-200/90 z-30 transition-all duration-200 select-none ${
        isCollapsed ? 'w-16' : 'w-72 max-w-[85vw] md:w-70'
      }`}
    >
      {/* 1. Header: Branding (Clean & Full Title - No Truncation) */}
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

      {/* 2. Navigation Modules List (Filtered strictly by RBAC) */}
      <div
        data-testid="clinical-nav-tabs"
        className="flex-1 overflow-y-auto px-2.5 py-3.5 space-y-4 scrollbar-none"
      >
        {/* Group 1: Phân Hệ Dược Lâm Sàng */}
        {(allowedTabs.includes('debt') || allowedTabs.includes('fefo') || allowedTabs.includes('coldchain')) && (
          <div>
            {!isCollapsed && (
              <div className="px-2.5 pb-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                Dược Lâm Sàng
              </div>
            )}
            <div className="space-y-1">
            {/* Tab: Sổ nợ tủ trực */}
            {allowedTabs.includes('debt') ? (
              <button
                onClick={() => {
                  onTabChange('debt');
                  onCloseMobile?.();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[15px] transition cursor-pointer ${
                  currentTab === 'debt'
                    ? 'bg-teal-50 text-teal-950 font-bold border border-teal-200/80 shadow-2xs'
                    : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900 font-medium'
                } ${isCollapsed ? 'justify-center px-0' : ''}`}
                title="Sổ nợ tủ trực cấp cứu (TT 22 & TT 20)"
              >
                <FileText
                  className={`w-5 h-5 shrink-0 ${
                    currentTab === 'debt' ? 'text-teal-700' : 'text-slate-400'
                  }`}
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
            ) : null}

            {/* Tab: Kho Dược FEFO */}
            {allowedTabs.includes('fefo') ? (
              <button
                onClick={() => {
                  onTabChange('fefo');
                  onCloseMobile?.();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[15px] transition cursor-pointer ${
                  currentTab === 'fefo'
                    ? 'bg-teal-50 text-teal-950 font-bold border border-teal-200/80 shadow-2xs'
                    : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900 font-medium'
                } ${isCollapsed ? 'justify-center px-0' : ''}`}
                title="Kho Dược - Hạn dùng FEFO & Định mức (TT 36 GSP)"
              >
                <Boxes
                  className={`w-5 h-5 shrink-0 ${
                    currentTab === 'fefo' ? 'text-teal-700' : 'text-slate-400'
                  }`}
                />
                {!isCollapsed && (
                  <>
                    <span className="flex-1 text-left truncate">Kho Dược &amp; Hạn Dùng</span>
                    {nearExpiryAndLowStockCount > 0 && (
                      <span className="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-rose-50 text-rose-800 border border-rose-200/80 tabular-nums">
                        {nearExpiryAndLowStockCount}
                      </span>
                    )}
                  </>
                )}
              </button>
            ) : null}

            {/* Tab: Chuỗi lạnh vắc xin */}
            {/* ========================================================================= */}
            {/* [DEMO FOCUS - BẢO VỆ ĐỒ ÁN 2]:                                             */}
            {/* Tạm ẩn tab "Chuỗi lạnh vắc xin" để tập trung sâu vào nghiệp vụ Tủ trực    */}
            {/* cấp cứu & Kho Dược FEFO theo phản hồi của Giảng viên hướng dẫn.           */}
            {/* Để kích hoạt lại: Bỏ comment khối mã dưới đây.                             */}
            {/* ========================================================================= */}
            {/*
            {allowedTabs.includes('coldchain') ? (
              <button
                onClick={() => {
                  onTabChange('coldchain');
                  onCloseMobile?.();
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer ${
                  currentTab === 'coldchain'
                    ? isColdAlarm
                      ? 'bg-rose-50 text-rose-900 border border-rose-300 font-bold'
                      : 'bg-teal-50 text-teal-900 font-bold border border-teal-200/80 shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                } ${isCollapsed ? 'justify-center px-0' : ''}`}
                title="Giám sát chuỗi lạnh vắc xin GSP (Datalogger)"
              >
                <ThermometerSnowflake
                  className={`w-4.5 h-4.5 shrink-0 ${
                    isColdAlarm
                      ? 'text-rose-600'
                      : currentTab === 'coldchain'
                      ? 'text-teal-700'
                      : 'text-slate-400'
                  }`}
                />
                {!isCollapsed && (
                  <>
                    <span className="flex-1 text-left truncate">Chuỗi lạnh vắc xin</span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-xs font-mono font-bold tabular-nums ${
                        isColdAlarm
                          ? 'bg-rose-600 text-white'
                          : 'bg-slate-100 text-slate-700 border border-slate-200/80'
                      }`}
                    >
                      {coldChainTemp.toFixed(1)}°C
                    </span>
                  </>
                )}
              </button>
            ) : null}
            */}
          </div>
        </div>
        )}

        {/* Group 2: Phân Hệ Thiết Bị & Tài Sản */}
        {(allowedTabs.includes('equipment') || allowedTabs.includes('asset_audit')) && (
          <div>
            {!isCollapsed && (
              <div className="px-2.5 pb-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                Thiết Bị &amp; Tài Sản
              </div>
            )}
            <div className="space-y-1">
              {/* Tab: Sự cố & Kiểm định */}
              {allowedTabs.includes('equipment') ? (
                <button
                  onClick={() => {
                    onTabChange('equipment');
                    onCloseMobile?.();
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[15px] transition cursor-pointer ${
                    currentTab === 'equipment'
                      ? 'bg-teal-50 text-teal-950 font-bold border border-teal-200/80 shadow-2xs'
                      : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900 font-medium'
                  } ${isCollapsed ? 'justify-center px-0' : ''}`}
                  title="Sự cố & Kiểm định trang thiết bị y tế (NĐ 98/2021)"
                >
                  <Wrench
                    className={`w-5 h-5 shrink-0 ${
                      currentTab === 'equipment' ? 'text-teal-700' : 'text-slate-400'
                    }`}
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
              ) : null}

              {/* Tab: Kiểm kê tài sản công */}
              {/* ========================================================================= */}
              {/* [DEMO FOCUS - BẢO VỆ ĐỒ ÁN 2]:                                             */}
              {/* Tạm ẩn tab "Kiểm kê tài sản công" (NĐ 151) vì thuộc thẩm quyền Kế toán,    */}
              {/* giúp bài thuyết trình tập trung 100% vào Bác sĩ / Điều dưỡng buồng bệnh. */}
              {/* Để kích hoạt lại: Bỏ comment khối mã dưới đây.                             */}
              {/* ========================================================================= */}
              {/*
              {allowedTabs.includes('asset_audit') ? (
                <button
                  onClick={() => {
                    onTabChange('asset_audit');
                    onCloseMobile?.();
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer ${
                    currentTab === 'asset_audit'
                      ? 'bg-teal-50 text-teal-900 font-bold border border-teal-200/80 shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                  } ${isCollapsed ? 'justify-center px-0' : ''}`}
                  title="Kiểm kê & Quản lý tài sản công 31/12 (NĐ 151/2017)"
                >
                  <Building2
                    className={`w-4.5 h-4.5 shrink-0 ${
                      currentTab === 'asset_audit' ? 'text-teal-700' : 'text-slate-400'
                    }`}
                  />
                  {!isCollapsed && (
                    <>
                      <span className="flex-1 text-left truncate">Kiểm kê tài sản</span>
                      {misallocatedAssetsCount > 0 && (
                        <span className="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200/80 tabular-nums">
                          {misallocatedAssetsCount}
                        </span>
                      )}
                    </>
                  )}
                </button>
              ) : null}
              */}
            </div>
          </div>
        )}

        {/* Group 3: Tiện Ích Pháp Lý & Kiểm Toán */}
        <div>
          {!isCollapsed && (
            <div className="px-2.5 pb-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
              Quản Trị &amp; Pháp Lý
            </div>
          )}
          <div className="space-y-1">
            <button
              onClick={() => {
                onOpenAuditTrail();
                onCloseMobile?.();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[15px] font-medium text-slate-700 hover:bg-slate-100/80 hover:text-slate-900 transition cursor-pointer ${
                isCollapsed ? 'justify-center px-0' : ''
              }`}
              title="Nhật Ký Kiểm Toán Lâm Sàng (NĐ 130)"
            >
              <ClipboardList className="w-5 h-5 text-teal-700 shrink-0" />
              {!isCollapsed && <span className="flex-1 text-left truncate">Nhật Ký Kiểm Toán</span>}
            </button>

            <button
              onClick={() => {
                onOpenLegalDocs();
                onCloseMobile?.();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[15px] font-medium text-slate-700 hover:bg-slate-100/80 hover:text-slate-900 transition cursor-pointer ${
                isCollapsed ? 'justify-center px-0' : ''
              }`}
              title="Căn Cứ Pháp Lý & Quy Định Bộ Y Tế (Docs)"
            >
              <Scale className="w-5 h-5 text-teal-700 shrink-0" />
              {!isCollapsed && <span className="flex-1 text-left truncate">Căn Cứ Pháp Lý</span>}
            </button>

            <button
              onClick={() => {
                onOpenUserGuide();
                onCloseMobile?.();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[15px] font-medium text-slate-700 hover:bg-slate-100/80 hover:text-slate-900 transition cursor-pointer ${
                isCollapsed ? 'justify-center px-0' : ''
              }`}
              title="Tài Liệu Hướng Dẫn Sử Dụng Chi Tiết (HDSD)"
            >
              <BookOpen className="w-5 h-5 text-teal-700 shrink-0" />
              {!isCollapsed && <span className="flex-1 text-left truncate">Hướng Dẫn Sử Dụng</span>}
            </button>

            <button
              onClick={() => {
                onOpenPrintableForms?.();
                onCloseMobile?.();
              }}
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
      </div>

      {/* 3. Footer: Hospital Standard & Ward Compliance (Single Source of Role in Top Header) */}
      <div className="border-t border-slate-200/80 p-3 shrink-0 bg-slate-50/70">
        {!isCollapsed ? (
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium px-1">
            <span className="truncate">Chuẩn BYT: TT 22 &amp; NĐ 98</span>
            <span className="font-mono text-teal-700 font-bold bg-teal-50 px-2 py-0.5 rounded border border-teal-200/60">GSP 2026</span>
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
    </aside>
  );
};
