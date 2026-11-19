/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Bàn Làm Việc Hồ Sơ Nhân Sự & Thông Tin Cá Nhân Lâm Sàng - Chuẩn Workstation Bệnh Viện
 * Bố cục Trái - Phải phẳng, rộng tối đa (Max màn hình), thoáng mắt, có ảnh Avatar & Thẻ nhân viên RFID
 */

import React, { useState, useEffect, useRef } from 'react';
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
  Camera,
  Trash2,
  QrCode,
  FileBadge,
  Sparkles,
  Phone,
  Mail,
  GraduationCap,
  CalendarCheck,
} from 'lucide-react';
import { UserProfile } from '../../types/clinical';
import { useModalDismiss } from '../../hooks/useModalDismiss';

type UserProfileTab = 'overview' | 'clinical_scope' | 'security_badge';

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

const ACTION_DESCRIPTIONS: Record<string, { label: string; legal: string; desc: string }> = {
  PRESCRIBE_MEDICATION: {
    label: 'Kê đơn thuốc điện tử CPOE',
    legal: 'Thông tư 26/2025/TT-BYT',
    desc: 'Kê đơn thuốc điều trị ngoại trú và nội trú, ký số đơn thuốc điện tử liên thông đơn thuốc quốc gia.',
  },
  APPROVE_PRESCRIPTION: {
    label: 'Duyệt y lệnh & Đơn thuốc lâm sàng',
    legal: 'Thông tư 22/2011/TT-BYT',
    desc: 'Thẩm định tương tác thuốc, liều dùng, cảnh báo DDI và phê duyệt xuất kho cho khoa phòng.',
  },
  DISPENSE_OUTPATIENT: {
    label: 'Cấp phát thuốc bệnh nhân ngoại trú',
    legal: 'Quy chế Bệnh viện BYT',
    desc: 'Kiểm tra mã đơn, cấp phát theo danh mục BHYT và viện phí, hướng dẫn sử dụng thuốc.',
  },
  BORROW_EMERGENCY: {
    label: 'Mượn cơ số thuốc cấp cứu tủ trực',
    legal: 'Thông tư 22/2011/TT-BYT',
    desc: 'Lấy thuốc cấp cứu trong ca trực đêm, tự động ghi sổ nợ vỏ thuốc và kích hoạt quy trình hoàn trả.',
  },
  SETTLE_DEBT: {
    label: 'Thu hồi & Quyết toán nợ vỏ thuốc',
    legal: 'Thông tư 22/2011/TT-BYT',
    desc: 'Xác nhận thu hồi vỏ thuốc từ điều dưỡng ca trực và đối soát cơ số tủ trực khoa phòng.',
  },
  RETURN_AMPOULE: {
    label: 'Bàn giao vỏ ống thuốc đã dùng',
    legal: 'Thông tư 20/2017/TT-BYT',
    desc: 'Bàn giao vỏ ống thuốc hướng thần, gây nghiện vào khay bảo mật để chuẩn bị hội đồng tiêu hủy.',
  },
  DESTROY_AMPOULES: {
    label: 'Hội đồng tiêu hủy vỏ ống Morphin',
    legal: 'Thông tư 20/2017/TT-BYT',
    desc: 'Tham gia hội đồng 3 bên độc lập, lập biên bản tiêu hủy và niêm phong chứng từ lưu trữ 02 năm.',
  },
  CREATE_INCIDENT: {
    label: 'Báo sự cố thiết bị y tế buồng bệnh',
    legal: 'Nghị định 04/2025/NĐ-CP',
    desc: 'Ghi nhận hư hỏng, cảnh báo an toàn loại D/C, gắn biển ngừng sử dụng và điều phối kỹ sư sửa chữa.',
  },
  HANDOVER_EQUIPMENT: {
    label: 'Bàn giao & Nghiệm thu trang thiết bị',
    legal: 'Nghị định 98/2021/NĐ-CP',
    desc: 'Ký biên bản nghiệm thu sửa chữa, thử an toàn điện IEC 60601-1 trước khi đưa vào bệnh nhân.',
  },
  DISPATCH_FEFO: {
    label: 'Xuất kho theo hạn dùng FEFO',
    legal: 'Thông tư 36/2018/TT-BYT (GSP)',
    desc: 'Ưu tiên xuất lô thuốc có hạn dùng gần nhất trước, chống quá hạn và thất thoát dược phẩm.',
  },
  RESTOCK_MEDICATION: {
    label: 'Nhập kho & Cấp bù cơ số định mức',
    legal: 'Quy định Kho Dược BV',
    desc: 'Cấp bù danh mục thuốc định mức cho tủ trực cấp cứu khoa lâm sàng theo tuần/tháng.',
  },
  TRANSFER_ASSET: {
    label: 'Điều chuyển tài sản trang thiết bị',
    legal: 'Nghị định 151/2017/NĐ-CP',
    desc: 'Lập lệnh điều chuyển máy thở, máy monitor giữa các khoa phòng cấp cứu trong bệnh viện.',
  },
  LIQUIDATE_ASSET: {
    label: 'Đề xuất thanh lý tài sản hư hỏng',
    legal: 'Nghị định 151/2017/NĐ-CP',
    desc: 'Kiểm kê tài sản cuối năm 31/12 và lập hồ sơ thanh lý thiết bị hết niên hạn sử dụng.',
  },
  RESTORE_POWER: {
    label: 'Khôi phục điện tủ lạnh vắc xin',
    legal: 'Thông tư 36/2018/TT-BYT',
    desc: 'Xử lý báo động mất điện dây chuyền lạnh 2-8°C, kích hoạt máy phát và ghi log nhiệt độ.',
  },
  RELEASE_VACCINE_QUARANTINE: {
    label: 'Giải phóng vắc xin khỏi cách ly',
    legal: 'Quy chuẩn Chuỗi Lạnh BYT',
    desc: 'Đánh giá an toàn vắc xin sau sự cố nhiệt độ và cho phép đưa trở lại sử dụng lâm sàng.',
  },
  SWITCH_ROLE: {
    label: 'Chuyển giao quyền hạn ca trực',
    legal: 'Quy chế Ca Trực BV',
    desc: 'Bàn giao ca trực lâm sàng cho kíp trực kế tiếp, ghi nhận bàn giao hồ sơ người bệnh.',
  },
};

const ROLE_METADATA: Record<
  string,
  { degree: string; email: string; phone: string; shiftType: string; badgeTitle: string }
> = {
  doctor: {
    degree: 'Bác sĩ Chuyên khoa I / Bác sĩ Nội trú',
    email: 'hung.tran@benhvien.gov.vn',
    phone: 'Ext. 109 (Phòng trực ICU)',
    shiftType: 'Ca trực lâm sàng 24/7 (Kíp A)',
    badgeTitle: 'BÁC SĨ ĐIỀU TRỊ',
  },
  pharmacist: {
    degree: 'Dược sĩ Chuyên khoa I / Dược lâm sàng',
    email: 'ngoc.nguyen@benhvien.gov.vn',
    phone: 'Ext. 214 (Kho Dược Trung tâm)',
    shiftType: 'Ca trực dược chính & cấp phát (Kíp Dược)',
    badgeTitle: 'DƯỢC SĨ LÂM SÀNG',
  },
  nurse: {
    degree: 'Cử nhân Điều dưỡng Hồi sức cấp cứu',
    email: 'thu.le@benhvien.gov.vn',
    phone: 'Ext. 102 (Bàn điều dưỡng A9)',
    shiftType: 'Ca trực điều dưỡng hành chính & lâm sàng',
    badgeTitle: 'ĐIỀU DƯỠNG TRƯỞNG CA',
  },
  biomedical_engineer: {
    degree: 'Kỹ sư Điện tử Y sinh / BME Specialist',
    email: 'nam.dang@benhvien.gov.vn',
    phone: 'Ext. 305 (Phòng Vật tư - TBYT)',
    shiftType: 'Ca trực kỹ thuật & an toàn thiết bị',
    badgeTitle: 'KỸ SƯ TRANG THIẾT BỊ',
  },
  director: {
    degree: 'Tiến sĩ Y khoa / Giám đốc Bệnh viện',
    email: 'an.nguyen@benhvien.gov.vn',
    phone: 'Ext. 001 (Văn phòng Ban Giám Đốc)',
    shiftType: 'Lãnh đạo trực điều hành toàn viện',
    badgeTitle: 'BAN GIÁM ĐỐC BỆNH VIỆN',
  },
};

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  profile,
}) => {
  useModalDismiss(isOpen, onClose);
  const [activeTab, setActiveTab] = useState<UserProfileTab>('overview');
  const [customAvatar, setCustomAvatar] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load avatar từ localStorage khi mở modal
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
        // storage quota fallback
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

  const tabs: [UserProfileTab, string][] = [
    ['overview', 'Tổng quan nhân sự'],
    ['clinical_scope', 'Phạm vi chuyên môn & Thẩm quyền'],
    ['security_badge', 'Thẻ định danh RFID & Ký số'],
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="user-profile-workstation-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 md:p-6 bg-slate-900/50 backdrop-blur-xs"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-none sm:rounded-xl shadow-2xl border-0 sm:border border-slate-300 w-full sm:max-w-6xl xl:max-w-7xl h-[100dvh] sm:h-[90vh] flex flex-col overflow-hidden animate-in fade-in duration-100">
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

        {/* Thanh Tab Gạch Chân Chuẩn Workstation */}
        <div
          role="tablist"
          aria-label="Nhóm thông tin nhân sự"
          className="flex items-center gap-1 overflow-x-auto text-sm scrollbar-none border-b border-slate-200 px-5 bg-white shrink-0"
        >
          {tabs.map(([tab, label]) => {
            const isSelected = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => setActiveTab(tab)}
                className={`px-3.5 py-2.5 border-b-2 shrink-0 font-medium cursor-pointer transition-colors text-sm whitespace-nowrap ${
                  isSelected
                    ? 'border-slate-900 text-slate-950 font-semibold'
                    : 'border-transparent text-slate-600 hover:text-slate-950'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Nội Dung Workstation: Bố Cục Trái - Phải Chuẩn Y Tế Rộng Thoáng */}
        <div
          role="tabpanel"
          className="grid grid-cols-1 lg:grid-cols-12 min-h-0 flex-1 overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-slate-200"
        >
          {/* CỘT TRÁI (LỚN): Thông tin chi tiết, bố cục thoáng, không chữ dày */}
          <div className="lg:col-span-7 xl:col-span-8 p-6 sm:p-8 overflow-y-auto space-y-7 bg-white">
            {/* TAB 1: TỔNG QUAN NHÂN SỰ */}
            {activeTab === 'overview' && (
              <>
                {/* 1. Thông Tin Hành Chính & Định Danh */}
                <div className="space-y-4 pb-6 border-b border-slate-100">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                      <Award className="w-4 h-4 text-teal-700" />
                      Thông Tin Hành Chính &amp; Định Danh Y Tế
                    </h3>
                    <span className="text-2xs font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                      Đã Xác Thực CSDL Y Tế
                    </span>
                  </div>

                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8 text-sm">
                    <div>
                      <dt className="text-xs font-medium text-slate-500">Họ và tên đầy đủ</dt>
                      <dd className="text-base font-bold text-slate-950 mt-0.5">
                        {profile.name}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-xs font-medium text-slate-500">Chức danh / Vai trò</dt>
                      <dd className="text-base font-semibold text-teal-700 mt-0.5">
                        {profile.roleName}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-xs font-medium text-slate-500">
                        Chứng chỉ hành nghề (CCHN)
                      </dt>
                      <dd className="text-sm font-bold text-slate-900 font-mono mt-0.5 flex items-center gap-1.5">
                        <span>{profile.practiceCertificate || '009125/BYT-CCHN'}</span>
                        <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0" />
                      </dd>
                    </div>

                    <div>
                      <dt className="text-xs font-medium text-slate-500">Học hàm / Học vị</dt>
                      <dd className="text-sm font-semibold text-slate-800 mt-0.5">
                        {meta.degree}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-xs font-medium text-slate-500">Khoa / Đơn vị công tác</dt>
                      <dd className="text-sm font-semibold text-slate-900 mt-0.5 flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>{profile.department}</span>
                      </dd>
                    </div>

                    <div>
                      <dt className="text-xs font-medium text-slate-500">
                        Mã thẻ định danh RFID / NFC
                      </dt>
                      <dd className="text-sm font-bold text-slate-900 font-mono mt-0.5 flex items-center gap-1.5">
                        <CreditCard className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>{profile.rfidCardId || 'RFID-TEMP-0000'}</span>
                      </dd>
                    </div>

                    <div>
                      <dt className="text-xs font-medium text-slate-500">Email công vụ</dt>
                      <dd className="text-sm font-medium text-slate-800 mt-0.5 flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{meta.email}</span>
                      </dd>
                    </div>

                    <div>
                      <dt className="text-xs font-medium text-slate-500">Số máy nhánh trực</dt>
                      <dd className="text-sm font-medium text-slate-800 mt-0.5 flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{meta.phone}</span>
                      </dd>
                    </div>
                  </dl>
                </div>

                {/* 2. Trách Nhiệm Chuyên Môn Trong Ca Trực */}
                <div className="space-y-3 pb-6 border-b border-slate-100">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                    <Stethoscope className="w-4 h-4 text-teal-700" />
                    Nhiệm Vụ &amp; Trách Nhiệm Chuyên Môn Ca Trực
                  </h3>
                  <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-200">
                    {profile.responsibilities}
                  </p>
                </div>

                {/* 3. Phân Hệ Được Phân Quyền Vận Hành */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-teal-700" />
                      Phân Hệ Vận Hành Được Cấp Quyền Truy Cập ({profile.allowedTabs.length})
                    </h3>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
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
              </>
            )}

            {/* TAB 2: PHẠM VI CHUYÊN MÔN & THẨM QUYỀN RBAC */}
            {activeTab === 'clinical_scope' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Bảng Phân Quyền Nghiệp Vụ Lâm Sàng (RBAC Matrix)
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Được cấp quyền theo quy chế Bệnh viện &amp; Văn bản quy phạm Bộ Y Tế
                    </p>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded bg-teal-50 text-teal-800 border border-teal-200 font-mono">
                    {profile.allowedActions.length} Nghiệp vụ được duyệt
                  </span>
                </div>

                <div className="space-y-3">
                  {profile.allowedActions.map((actionKey) => {
                    const info = ACTION_DESCRIPTIONS[actionKey] || {
                      label: actionKey,
                      legal: 'Quy chế Bệnh viện',
                      desc: 'Thao tác nghiệp vụ lâm sàng theo phân công của lãnh đạo khoa.',
                    };
                    return (
                      <div
                        key={actionKey}
                        className="p-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50/70 transition"
                      >
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            {info.label}
                          </h4>
                          <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300">
                            {info.legal}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                          {info.desc}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 3: THẺ ĐỊNH DANH RFID & KÝ SỐ */}
            {activeTab === 'security_badge' && (
              <div className="space-y-6">
                <div className="pb-3 border-b border-slate-100">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Cơ Chế Xác Thực &amp; Chữ Ký Số Lâm Sàng
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Hạ tầng bảo mật ca trực theo tiêu chuẩn Cục Quản lý Khám chữa bệnh
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <Lock className="w-4 h-4 text-teal-600" />
                        Mã PIN Ký Số Lâm Sàng
                      </span>
                      <span className="text-2xs font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Đang bảo vệ
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">
                      Mã PIN 4–6 số dùng để ký xác nhận y lệnh khẩn cấp, xuất thuốc FEFO và lập biên bản tiêu hủy Morphin.
                    </p>
                    <div className="pt-2">
                      <span className="text-xs font-mono font-bold text-slate-800 bg-white px-2.5 py-1 rounded border border-slate-200">
                        PIN: •••••• (Đã mã hóa Argon2id)
                      </span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <QrCode className="w-4 h-4 text-teal-600" />
                        Thẻ Thông Minh RFID / NFC
                      </span>
                      <span className="text-2xs font-semibold px-2 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200">
                        Sẵn sàng quẹt
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">
                      Tích hợp đầu đọc RFID tại các tủ thuốc trực, kho dược và buồng bệnh nhân để điểm danh kíp trực.
                    </p>
                    <div className="pt-2">
                      <span className="text-xs font-mono font-bold text-slate-800 bg-white px-2.5 py-1 rounded border border-slate-200">
                        Card ID: {profile.rfidCardId || 'RFID-TEMP-0000'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <FileBadge className="w-4 h-4 text-teal-700" />
                    Chữ Ký Số CA &amp; Liên Thông Quốc Gia
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Tài khoản nhân sự đã được liên kết chứng thư số CA phục vụ ký đơn thuốc điện tử theo Thông tư 26/2025/TT-BYT, đồng bộ dữ liệu giám định bảo hiểm xã hội (BHYT) theo Quyết định 130/QĐ-BYT.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* CỘT PHẢI (SIDEBAR): Avatar lớn, Thẻ nhân viên trực quan & Thông số nhanh */}
          <div className="lg:col-span-5 xl:col-span-4 p-6 sm:p-8 bg-slate-50/70 border-t lg:border-t-0 lg:border-l border-slate-200 overflow-y-auto space-y-6">
            {/* 1. KHỐI AVATAR LỚN & THAY ẢNH */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex flex-col items-center text-center">
                <div className="relative group">
                  {customAvatar ? (
                    <img
                      src={customAvatar}
                      alt={profile.name}
                      className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover border-2 border-slate-200 shadow-md"
                    />
                  ) : (
                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-950 text-white flex flex-col items-center justify-center font-bold text-2xl shadow-md border-2 border-slate-200">
                      <span>{initials}</span>
                      <span className="text-[10px] font-normal tracking-widest text-slate-400 uppercase mt-0.5">
                        STAFF
                      </span>
                    </div>
                  )}

                  {/* Nút Upload Avatar */}
                  <label
                    htmlFor="staff-avatar-upload"
                    className="absolute -bottom-1.5 -right-1.5 p-2 bg-slate-900 text-white rounded-xl shadow-lg hover:bg-slate-800 cursor-pointer transition active:scale-95"
                    title="Tải ảnh đại diện mới"
                  >
                    <Camera className="w-4 h-4" />
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

                <div className="mt-3.5 space-y-0.5">
                  <h3 className="text-base font-bold text-slate-900">{profile.name}</h3>
                  <p className="text-xs font-semibold text-teal-700">{profile.roleName}</p>
                  <p className="text-xs text-slate-500">{profile.department}</p>
                </div>

                {customAvatar && (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    className="mt-2 text-[11px] text-rose-600 hover:text-rose-800 font-medium inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    Xóa ảnh tùy chỉnh
                  </button>
                )}
              </div>

              {/* Mô phỏng Thẻ Nhân Viên Y Tế Bệnh Viện (Smart Badge) */}
              <div className="pt-3 border-t border-slate-100">
                <div className="bg-gradient-to-b from-slate-900 to-slate-800 text-white p-3.5 rounded-xl shadow-xs space-y-2.5">
                  <div className="flex items-center justify-between text-[10px] tracking-wider text-slate-300 uppercase font-semibold">
                    <span>BỆNH VIỆN ĐA KHOA</span>
                    <span className="text-emerald-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      ACTIVE
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center shrink-0 text-white font-mono font-bold text-sm">
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-white truncate">{profile.name}</p>
                      <p className="text-[10px] text-slate-300 truncate">{meta.badgeTitle}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-white/10 text-[10px] font-mono text-slate-400">
                    <span>{profile.rfidCardId || 'RFID-TEMP-0000'}</span>
                    <span className="tracking-widest">||| |||| || |||</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. THỐNG SỐ VẬN HÀNH NHANH (QUICK METRICS) */}
            <div className="space-y-2.5 pb-5 border-b border-slate-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Thống Số Thẩm Quyền Ca Trực
              </h3>
              <dl className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <dt className="text-slate-500">Quyền hạn lâm sàng</dt>
                  <dd className="text-base font-bold text-slate-900 font-mono mt-0.5">
                    {profile.allowedActions.length} <span className="text-xs font-normal text-slate-500">quyền</span>
                  </dd>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <dt className="text-slate-500">Phân hệ truy cập</dt>
                  <dd className="text-base font-bold text-slate-900 font-mono mt-0.5">
                    {profile.allowedTabs.length} <span className="text-xs font-normal text-slate-500">phân hệ</span>
                  </dd>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <dt className="text-slate-500">Mức độ bảo mật</dt>
                  <dd className="text-xs font-bold text-emerald-700 mt-1 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Cấp 3 (Y tế)
                  </dd>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <dt className="text-slate-500">Chữ ký số CA</dt>
                  <dd className="text-xs font-bold text-teal-700 mt-1 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    Đã liên kết
                  </dd>
                </div>
              </dl>
            </div>

            {/* 3. THÔNG TIN CA TRỰC PHÂN CÔNG */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Lịch Trực Phân Công
              </h3>
              <div className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-2 text-xs">
                <div className="flex items-center gap-2 text-slate-800 font-semibold">
                  <CalendarCheck className="w-4 h-4 text-teal-600" />
                  <span>{meta.shiftType}</span>
                </div>
                <p className="text-slate-500 leading-relaxed text-[11px]">
                  Kíp trực thực hiện nhiệm vụ điều trị nội trú, kê đơn CPOE, giám sát kho dược và bảo đảm an toàn trang thiết bị bệnh viện 24/7.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Chuẩn Workstation */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 hidden sm:flex items-center gap-2">
            <span className="font-semibold text-slate-700">Hệ thống Hồ Sơ Nhân Sự Y Tế</span>
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
