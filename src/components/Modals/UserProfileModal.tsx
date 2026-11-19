/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Modal Hiển Thị Form Thông Tin Cá Nhân & Hồ Sơ Nhân Sự Ca Trực Chuẩn Y Tế (<180 LOC)
 */

import React from 'react';
import {
  X,
  UserRound,
  ShieldCheck,
  Building2,
  Award,
  CreditCard,
  Stethoscope,
  CheckCircle2,
  Lock,
  Layers,
  KeyRound,
} from 'lucide-react';
import { UserProfile } from '../../types/clinical';
import { useModalDismiss } from '../../hooks/useModalDismiss';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
}

const TAB_LABELS: Record<string, string> = {
  overview: 'Tổng quan khoa phòng',
  cpoe: 'Kê đơn điện tử CPOE',
  bhyt_audit: 'Giám định danh mục BHYT',
  fefo: 'Kho dược & Hạn dùng FEFO',
  documents: 'Kho tài liệu & Thông tư',
  debt: 'Sổ nợ vỏ tủ trực TT 22',
  coldchain: 'Chuỗi lạnh vắc xin TT 36',
  equipment: 'Trang thiết bị y tế NĐ 98',
  asset_audit: 'Kiểm kê tài sản NĐ 151',
};

const ACTION_LABELS: Record<string, string> = {
  PRESCRIBE_MEDICATION: 'Kê đơn thuốc CPOE',
  APPROVE_PRESCRIPTION: 'Duyệt đơn thuốc',
  DISPENSE_OUTPATIENT: 'Phát thuốc ngoại trú',
  BORROW_EMERGENCY: 'Mượn cơ số cấp cứu',
  SETTLE_DEBT: 'Thu hồi nợ vỏ',
  RETURN_AMPOULE: 'Bàn giao vỏ ống',
  DESTROY_AMPOULES: 'Tiêu hủy Morphin',
  CREATE_INCIDENT: 'Báo sự cố thiết bị',
  HANDOVER_EQUIPMENT: 'Bàn giao thiết bị',
  DISPATCH_FEFO: 'Xuất kho FEFO',
  RESTOCK_MEDICATION: 'Nhập kho & Cấp bù',
  TRANSFER_ASSET: 'Điều chuyển tài sản',
  LIQUIDATE_ASSET: 'Thanh lý tài sản',
  RESTORE_POWER: 'Khôi phục điện',
  RELEASE_VACCINE_QUARANTINE: 'Giải phóng vắc xin',
  SWITCH_ROLE: 'Chuyển đổi ca trực',
};

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  profile,
}) => {
  useModalDismiss(isOpen, onClose);

  if (!isOpen) return null;

  const initials = profile.name
    .split(' ')
    .slice(-2)
    .map((p) => p[0])
    .join('');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-profile-title"
        className="bg-white rounded-none sm:rounded-xl shadow-2xl border-0 sm:border border-slate-200 w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* Header chuẩn đồng bộ với hệ thống modal của ứng dụng */}
        <div className="h-14 sm:h-16 px-4 sm:px-6 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-teal-50 text-teal-700 border border-teal-200 flex items-center justify-center shrink-0">
              <UserRound className="w-4 h-4 sm:w-5 sm:h-5 text-teal-700" />
            </div>
            <div className="min-w-0">
              <h2
                id="user-profile-title"
                className="text-sm sm:text-base font-bold tracking-tight text-slate-900 truncate"
              >
                Hồ Sơ Nhân Sự &amp; Thông Tin Cá Nhân
              </h2>
              <p className="text-xs text-slate-500 truncate">
                Định danh nhân viên y tế &amp; thẩm quyền ca trực lâm sàng
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer flex items-center justify-center shrink-0 active:scale-95"
            title="Đóng cửa sổ"
            aria-label="Đóng cửa sổ"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nội dung form thông tin cá nhân */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto flex-1">
          {/* Card tóm tắt định danh nhân sự */}
          <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <div className="relative shrink-0">
              <div className="w-12 h-12 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-base shadow-xs">
                {initials}
              </div>
              <span
                className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white"
                title="Đang hoạt động trong ca trực"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                  {profile.name}
                </h3>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full shrink-0">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Đang trong ca trực
                </span>
              </div>
              <p className="text-xs font-semibold text-teal-700 mt-0.5">
                {profile.roleName}
              </p>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{profile.department}</span>
              </div>
            </div>
          </div>

          {/* Nhóm 1: Các trường thông tin định danh & chứng chỉ hành nghề */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-teal-600" />
              Thông tin định danh &amp; Chứng chỉ chuyên môn
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Chứng chỉ hành nghề y tế (CCHN)
                </label>
                <div className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 flex items-center justify-between">
                  <span className="font-mono text-slate-900">
                    {profile.practiceCertificate || 'Đang cập nhật'}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
                    <ShieldCheck className="w-3 h-3 text-teal-600" />
                    BYT
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Mã thẻ RFID / Thẻ nhân viên
                </label>
                <div className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 flex items-center justify-between">
                  <span className="font-mono text-slate-900">
                    {profile.rfidCardId || 'RFID-TEMP-0000'}
                  </span>
                  <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Khoa / Đơn vị công tác
                </label>
                <div className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 truncate">
                  {profile.department}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Xác thực mã PIN ký điện tử
                </label>
                <div className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 flex items-center justify-between">
                  <span className="font-mono tracking-widest text-slate-600">
                    ••••••
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-semibold">
                    <Lock className="w-3 h-3" />
                    Đã bảo mật
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Nhóm 2: Trách nhiệm & Nhiệm vụ chuyên môn trong ca */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Stethoscope className="w-3.5 h-3.5 text-teal-600" />
              Nhiệm vụ &amp; Trách nhiệm chuyên môn ca trực
            </h4>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-700 leading-relaxed">
              {profile.responsibilities}
            </div>
          </div>

          {/* Nhóm 3: Thẩm quyền nghiệp vụ lâm sàng (RBAC Actions) */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-teal-600" />
              Quyền hạn thao tác lâm sàng (RBAC)
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {profile.allowedActions.map((act) => (
                <span
                  key={act}
                  className="px-2 py-1 rounded-md bg-teal-50 text-teal-800 text-xs font-medium border border-teal-200"
                >
                  {ACTION_LABELS[act] || act}
                </span>
              ))}
            </div>
          </div>

          {/* Nhóm 4: Phân hệ được phân quyền thao tác */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-teal-600" />
              Phân hệ được cấp phép truy cập
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {profile.allowedTabs.map((tabKey) => (
                <span
                  key={tabKey}
                  className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200"
                >
                  {TAB_LABELS[tabKey] || tabKey}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="h-14 px-4 sm:px-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">
            Xác thực theo chuẩn hồ sơ nhân sự lâm sàng
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition shadow-xs cursor-pointer active:scale-95 ml-auto"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
