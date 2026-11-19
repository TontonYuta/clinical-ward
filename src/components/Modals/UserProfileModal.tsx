/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Bàn Làm Việc Hồ Sơ Nhân Sự & Thông Tin Cá Nhân - Chuẩn Workstation Bệnh Viện
 * Bố cục Trái - Phải phẳng, rộng thoáng, cân đối hài hòa, có khối Avatar & Thẻ định danh ca trực
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Camera,
  Trash2,
  CheckCircle2,
  ShieldCheck,
  Building2,
  CreditCard,
  Lock,
  Stethoscope,
  KeyRound,
  Layers,
  Sparkles,
  Phone,
  Mail,
  GraduationCap,
  CalendarCheck,
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
  bhyt_audit: 'Giám định BHYT',
  fefo: 'Kho dược & Hạn dùng FEFO',
  documents: 'Kho tài liệu & Thông tư',
  debt: 'Sổ nợ vỏ tủ trực TT 22',
  coldchain: 'Chuỗi lạnh vắc xin TT 36',
  equipment: 'Trang thiết bị y tế NĐ 98',
  asset_audit: 'Kiểm kê tài sản NĐ 151',
};

const ACTION_LABELS: Record<string, string> = {
  PRESCRIBE_MEDICATION: 'Kê đơn điện tử CPOE (TT 26)',
  APPROVE_PRESCRIPTION: 'Duyệt đơn thuốc lâm sàng',
  DISPENSE_OUTPATIENT: 'Cấp phát thuốc ngoại trú',
  BORROW_EMERGENCY: 'Mượn thuốc cấp cứu (TT 22)',
  SETTLE_DEBT: 'Thu hồi & Quyết toán vỏ thuốc',
  RETURN_AMPOULE: 'Bàn giao vỏ ống đã dùng',
  DESTROY_AMPOULES: 'Tiêu hủy Morphin (TT 20)',
  CREATE_INCIDENT: 'Báo sự cố thiết bị (NĐ 04)',
  HANDOVER_EQUIPMENT: 'Bàn giao & Nghiệm thu TBYT',
  DISPATCH_FEFO: 'Xuất kho theo hạn dùng FEFO',
  RESTOCK_MEDICATION: 'Nhập kho & Cấp bù cơ số',
  TRANSFER_ASSET: 'Điều chuyển tài sản viện',
  LIQUIDATE_ASSET: 'Thanh lý tài sản hư hỏng',
  RESTORE_POWER: 'Khôi phục điện chuỗi lạnh',
  RELEASE_VACCINE_QUARANTINE: 'Giải phóng vắc xin an toàn',
  SWITCH_ROLE: 'Chuyển giao quyền ca trực',
};

const ROLE_METADATA: Record<
  string,
  { degree: string; email: string; phone: string; shiftType: string }
> = {
  doctor: {
    degree: 'Bác sĩ Chuyên khoa I / Bác sĩ Nội trú',
    email: 'hung.tran@benhvien.gov.vn',
    phone: 'Ext. 109 (Phòng trực ICU)',
    shiftType: 'Ca trực lâm sàng 24/7 (Kíp A)',
  },
  pharmacist: {
    degree: 'Dược sĩ Chuyên khoa I / Dược lâm sàng',
    email: 'ngoc.nguyen@benhvien.gov.vn',
    phone: 'Ext. 214 (Kho Dược Trung tâm)',
    shiftType: 'Ca trực dược chính & cấp phát',
  },
  nurse: {
    degree: 'Cử nhân Điều dưỡng Hồi sức cấp cứu',
    email: 'thu.le@benhvien.gov.vn',
    phone: 'Ext. 102 (Bàn điều dưỡng A9)',
    shiftType: 'Ca trực điều dưỡng hành chính & lâm sàng',
  },
  biomedical_engineer: {
    degree: 'Kỹ sư Điện tử Y sinh / BME Specialist',
    email: 'nam.dang@benhvien.gov.vn',
    phone: 'Ext. 305 (Phòng Vật tư - TBYT)',
    shiftType: 'Ca trực kỹ thuật & an toàn thiết bị',
  },
  director: {
    degree: 'Tiến sĩ Y khoa / Giám đốc Bệnh viện',
    email: 'an.nguyen@benhvien.gov.vn',
    phone: 'Ext. 001 (Văn phòng Ban Giám Đốc)',
    shiftType: 'Lãnh đạo trực điều hành toàn viện',
  },
};

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  profile,
}) => {
  useModalDismiss(isOpen, onClose);
  const [customAvatar, setCustomAvatar] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    try {
      const saved = localStorage.getItem(`staff_custom_avatar_${profile.role}`);
      setCustomAvatar(saved || null);
    } catch {
      setCustomAvatar(null);
    }
  }, [isOpen, profile.role]);

  if (!isOpen) return null;

  const initials = profile.name
    .split(' ')
    .slice(-2)
    .map((p) => p[0])
    .join('');

  const meta = ROLE_METADATA[profile.role] || ROLE_METADATA.doctor;

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Vui lòng chọn ảnh dung lượng dưới 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setCustomAvatar(result);
      try {
        localStorage.setItem(`staff_custom_avatar_${profile.role}`, result);
      } catch {
        // quota fallback
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    setCustomAvatar(null);
    try {
      localStorage.removeItem(`staff_custom_avatar_${profile.role}`);
    } catch {
      // ignore
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="user-profile-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-100"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-none sm:rounded-xl shadow-2xl border-0 sm:border border-slate-300 w-full sm:max-w-5xl xl:max-w-6xl h-[100dvh] sm:h-[88vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-100">
        {/* Header Chuẩn Workstation Giống DavDrugDetailModal */}
        <div className="px-5 py-3.5 bg-white border-b border-slate-200 flex items-center justify-between gap-4 shrink-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-sans tabular-nums text-xs font-bold text-slate-800 bg-slate-100 border border-slate-300 px-2.5 py-0.5 rounded-md">
                CCHN: {profile.practiceCertificate || '009125/BYT-CCHN'}
              </span>
              <span className="font-mono text-xs font-bold text-teal-800 bg-teal-50 border border-teal-200 px-2.5 py-0.5 rounded-md">
                {profile.rfidCardId || 'RFID-DOC-1109'}
              </span>
              <h2 className="text-lg sm:text-xl font-bold text-slate-950 tracking-tight truncate">
                {profile.name}{' '}
                <span className="text-sm font-normal text-slate-500">
                  ({profile.roleName})
                </span>
              </h2>
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
              <span>
                Khoa phòng:{' '}
                <strong className="text-slate-800 font-semibold">
                  {profile.department}
                </strong>
              </span>
              <span className="text-slate-300">·</span>
              <span className="text-slate-600 font-medium">{meta.shiftType}</span>
              <span className="text-slate-300">·</span>
              <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Đang trong ca trực
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={onClose}
              data-testid="btn-close-profile-modal"
              aria-label="Đóng cửa sổ"
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Nội Dung Workstation: Bố Cục Trái - Phải Chuẩn Y Tế */}
        <div className="grid grid-cols-1 lg:grid-cols-12 min-h-0 flex-1 overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-slate-200 bg-white">
          {/* CỘT TRÁI (LỚN): Thông tin hành chính, Trách nhiệm & Thẩm quyền */}
          <div className="lg:col-span-7 xl:col-span-8 p-6 sm:p-7 overflow-y-auto space-y-6">
            {/* 1. Lưới Thông Tin Hành Chính & Định Danh */}
            <div className="space-y-3 pb-5 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Thông Tin Hành Chính &amp; Định Danh Y Tế
                </h3>
                <span className="text-2xs font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Đã Chuẩn Hóa CSDL Y Tế
                </span>
              </div>

              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-3.5 gap-x-6 text-xs">
                <div>
                  <dt className="text-slate-500 font-medium">Họ và tên đầy đủ</dt>
                  <dd className="text-sm font-bold text-slate-950 mt-0.5">{profile.name}</dd>
                </div>

                <div>
                  <dt className="text-slate-500 font-medium">Chức danh chuyên môn</dt>
                  <dd className="text-sm font-semibold text-teal-700 mt-0.5">{profile.roleName}</dd>
                </div>

                <div>
                  <dt className="text-slate-500 font-medium">Khoa / Phòng ban</dt>
                  <dd className="text-sm font-semibold text-slate-900 mt-0.5 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{profile.department}</span>
                  </dd>
                </div>

                <div>
                  <dt className="text-slate-500 font-medium">Chứng chỉ hành nghề (CCHN)</dt>
                  <dd className="text-sm font-bold text-slate-900 font-mono mt-0.5 flex items-center gap-1">
                    <span>{profile.practiceCertificate || '009125/BYT-CCHN'}</span>
                  </dd>
                </div>

                <div>
                  <dt className="text-slate-500 font-medium">Học hàm / Học vị</dt>
                  <dd className="text-sm font-medium text-slate-800 mt-0.5 flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{meta.degree}</span>
                  </dd>
                </div>

                <div>
                  <dt className="text-slate-500 font-medium">Mã thẻ RFID / Nhân viên</dt>
                  <dd className="text-sm font-bold text-slate-900 font-mono mt-0.5 flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{profile.rfidCardId || 'RFID-TEMP-0000'}</span>
                  </dd>
                </div>

                <div>
                  <dt className="text-slate-500 font-medium">Email công vụ</dt>
                  <dd className="text-sm font-medium text-slate-800 mt-0.5 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{meta.email}</span>
                  </dd>
                </div>

                <div>
                  <dt className="text-slate-500 font-medium">Điện thoại nội bộ / Máy nhánh</dt>
                  <dd className="text-sm font-medium text-slate-800 mt-0.5 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{meta.phone}</span>
                  </dd>
                </div>
              </dl>
            </div>

            {/* 2. Trách Nhiệm Chuyên Môn Ca Trực */}
            <div className="space-y-2.5 pb-5 border-b border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Stethoscope className="w-4 h-4 text-teal-700" />
                Nhiệm Vụ &amp; Trách Nhiệm Chuyên Môn Ca Trực
              </h3>
              <p className="text-sm text-slate-700 leading-relaxed bg-slate-50/70 p-3.5 rounded-lg border border-slate-200/80">
                {profile.responsibilities}
              </p>
            </div>

            {/* 3. Phân Quyền Thao Tác Lâm Sàng (RBAC) */}
            <div className="space-y-3 pb-5 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4 text-teal-700" />
                  Quyền Hạn Thao Tác Lâm Sàng Được Cấp Phép ({profile.allowedActions.length})
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {profile.allowedActions.map((act) => (
                  <div
                    key={act}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 font-medium"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="truncate">{ACTION_LABELS[act] || act}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 4. Phân Hệ Vận Hành Được Phân Quyền */}
            <div className="space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-teal-700" />
                Phân Hệ Vận Hành Truy Cập ({profile.allowedTabs.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {profile.allowedTabs.map((tabKey) => (
                  <span
                    key={tabKey}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-800 text-xs font-medium border border-slate-200 flex items-center gap-1.5"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-600" />
                    {TAB_LABELS[tabKey] || tabKey}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* CỘT PHẢI (SIDEBAR): Avatar, Thẻ Nhân Viên & Thông Số Ca Trực */}
          <div className="lg:col-span-5 xl:col-span-4 p-5 sm:p-6 bg-slate-50/70 border-t lg:border-t-0 lg:border-l border-slate-200 overflow-y-auto space-y-5">
            {/* Khối Avatar & Đổi ảnh */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3.5 text-center">
              <div className="relative inline-block mx-auto">
                {customAvatar ? (
                  <img
                    src={customAvatar}
                    alt={profile.name}
                    className="w-24 h-24 rounded-2xl object-cover border-2 border-slate-200 shadow-xs"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-950 text-white flex flex-col items-center justify-center font-bold text-2xl shadow-xs border-2 border-slate-200">
                    <span>{initials}</span>
                    <span className="text-[10px] font-normal tracking-wider text-slate-400 uppercase mt-0.5">
                      STAFF
                    </span>
                  </div>
                )}

                <label
                  htmlFor="staff-avatar-upload"
                  className="absolute -bottom-1.5 -right-1.5 p-1.5 bg-slate-900 text-white rounded-lg shadow-md hover:bg-slate-800 cursor-pointer transition active:scale-95"
                  title="Thay ảnh đại diện"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <input
                    ref={fileInputRef}
                    id="staff-avatar-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                </label>
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-900">{profile.name}</h3>
                <p className="text-xs font-semibold text-teal-700 mt-0.5">{profile.roleName}</p>
                <p className="text-xs text-slate-500 mt-0.5">{profile.department}</p>
              </div>

              {customAvatar && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  className="text-xs text-rose-600 hover:text-rose-800 font-medium inline-flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  Xóa ảnh tải lên
                </button>
              )}
            </div>

            {/* Thông Tin Xác Thực Ca Trực */}
            <div className="space-y-2.5 pb-5 border-b border-slate-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Xác Thực Ca Trực &amp; Ký Số
              </h3>
              <dl className="space-y-2.5 text-xs">
                <div className="p-3 bg-white rounded-lg border border-slate-200 flex items-center justify-between">
                  <div>
                    <dt className="text-slate-500">Mã PIN ký số điện tử</dt>
                    <dd className="font-mono font-bold text-slate-900 text-sm mt-0.5">••••••</dd>
                  </div>
                  <span className="text-2xs font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    Đã bảo mật
                  </span>
                </div>

                <div className="p-3 bg-white rounded-lg border border-slate-200 flex items-center justify-between">
                  <div>
                    <dt className="text-slate-500">Thẻ thông minh RFID</dt>
                    <dd className="font-mono font-bold text-slate-900 text-sm mt-0.5">
                      {profile.rfidCardId || 'RFID-TEMP-0000'}
                    </dd>
                  </div>
                  <span className="text-2xs font-semibold px-2 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200 flex items-center gap-1">
                    <CreditCard className="w-3 h-3" />
                    Sẵn sàng
                  </span>
                </div>

                <div className="p-3 bg-white rounded-lg border border-slate-200 flex items-center justify-between">
                  <div>
                    <dt className="text-slate-500">Chứng thư số CPOE (TT 26)</dt>
                    <dd className="font-semibold text-slate-800 text-xs mt-0.5">Đã liên kết Cloud CA</dd>
                  </div>
                  <Sparkles className="w-4 h-4 text-teal-600" />
                </div>
              </dl>
            </div>

            {/* Lịch Phân Công Ca Trực */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Phân Công Ca Trực
              </h3>
              <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1.5 text-xs">
                <div className="flex items-center gap-2 text-slate-900 font-semibold">
                  <CalendarCheck className="w-4 h-4 text-teal-600" />
                  <span>{meta.shiftType}</span>
                </div>
                <p className="text-slate-500 text-[11px] leading-relaxed">
                  Trực vận hành lâm sàng, thực hiện y lệnh nội trú và quản lý cơ số cấp cứu bệnh viện.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Chuẩn Workstation */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 hidden sm:flex items-center gap-2">
            <span className="font-semibold text-slate-700">Hồ Sơ Nhân Sự Y Tế</span>
            <span>·</span>
            <span>Tiêu chuẩn Thông tư 26/2025/TT-BYT &amp; Cục Khám Chữa Bệnh</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition cursor-pointer shadow-xs active:scale-95 ml-auto"
          >
            Đóng cửa sổ
          </button>
        </div>
      </div>
    </div>
  );
};
