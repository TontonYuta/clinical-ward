/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Modal Hiển Thị Chi Tiết Hồ Sơ Nhân Sự & Thẩm Quyền Ca Trực (<150 LOC)
 */

import React, { useEffect } from 'react';
import { X, UserRound, ShieldCheck, Building2, Award, CreditCard, Stethoscope, CheckCircle2 } from 'lucide-react';
import { UserProfile } from '../../types/clinical';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
}

const TAB_LABELS: Record<string, string> = {
  overview: 'Tổng quan khoa phòng',
  cpoe: 'Kê đơn điện tử CPOE',
  bhyt_audit: 'Kiểm toán danh mục BHYT',
  fefo: 'Kho dược & Hạn dùng FEFO',
  documents: 'Kho tài liệu & Thông tư',
  debt: 'Tủ trực cấp cứu TT 22',
  coldchain: 'Dây chuyền lạnh TT 36',
  equipment: 'Trang thiết bị y tế NĐ 98',
  asset_audit: 'Kiểm kê tài sản NĐ 151',
};

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ isOpen, onClose, profile }) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const initials = profile.name
    .split(' ')
    .slice(-2)
    .map((p) => p[0])
    .join('');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header đồng bộ chuẩn Modal của hệ thống */}
        <div className="h-16 px-6 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center shrink-0">
              <UserRound className="w-5 h-5 text-blue-700" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-slate-900">
                Thông Tin Nhân Sự Lâm Sàng
              </h2>
              <p className="text-xs text-slate-500">
                Hồ sơ chức danh, khoa phòng &amp; thẩm quyền ca trực
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer flex items-center justify-center shrink-0 active:scale-95"
            title="Đóng cửa sổ"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nội dung hồ sơ nhân viên */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          {/* Card định danh chính */}
          <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="relative">
              <div className="w-14 h-14 rounded-full bg-blue-700 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                {initials}
              </div>
              <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white" title="Đang trong ca trực" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 truncate">{profile.name}</h3>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full shrink-0">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Đang hoạt động
                </span>
              </div>
              <p className="text-xs font-medium text-slate-600 mt-0.5">{profile.roleName}</p>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span className="truncate">{profile.department}</span>
              </div>
            </div>
          </div>

          {/* Chi tiết chứng chỉ & định danh */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                <Award className="w-3.5 h-3.5 text-blue-600" />
                Chứng chỉ hành nghề
              </div>
              <p className="text-sm font-bold text-slate-900 font-mono">
                {profile.practiceCertificate || 'Đang cập nhật'}
              </p>
              <p className="text-[11px] text-emerald-600 font-medium mt-0.5 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                Đã chuẩn hóa CSDL Y tế
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                Mã thẻ RFID / Nhân viên
              </div>
              <p className="text-sm font-bold text-slate-900 font-mono">
                {profile.rfidCardId || 'RFID-TEMP-0000'}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">Xác thực ca trực nội viện</p>
            </div>
          </div>

          {/* Trách nhiệm chuyên môn */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              <Stethoscope className="w-4 h-4 text-blue-600" />
              Nhiệm vụ &amp; Trách nhiệm chuyên môn ca trực
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              {profile.responsibilities}
            </p>
          </div>

          {/* Phân hệ được phép truy cập theo vai trò */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
              Phân hệ được phân quyền thao tác
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {profile.allowedTabs.map((tabKey) => (
                <span
                  key={tabKey}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200"
                >
                  {TAB_LABELS[tabKey] || tabKey}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="h-14 px-6 bg-slate-50 border-t border-slate-200 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition shadow-sm"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
