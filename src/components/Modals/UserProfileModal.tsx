/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Form Thông Tin Cá Nhân Tối Giản, Khổ Rộng Thoáng & Thuần Việt (<130 LOC)
 */

import React, { useState, useEffect, useRef } from 'react';
import { X, Camera, Trash2, CheckCircle2 } from 'lucide-react';
import { UserProfile } from '../../types/clinical';
import { useModalDismiss } from '../../hooks/useModalDismiss';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
}

const TAB_LABELS: Record<string, string> = {
  overview: 'Tổng quan khoa phòng',
  cpoe: 'Kê đơn thuốc',
  bhyt_audit: 'Giám định bảo hiểm',
  fefo: 'Kho dược bệnh viện',
  documents: 'Kho tài liệu văn bản',
  debt: 'Sổ nợ vỏ thuốc',
  coldchain: 'Chuỗi lạnh vắc xin',
  equipment: 'Trang thiết bị y tế',
  asset_audit: 'Kiểm kê tài sản',
};

const CLEAN_ROLE_RESPONSIBILITIES: Record<string, string> = {
  doctor:
    'Kê đơn thuốc điều trị nội trú hằng ngày, theo dõi chỉ định điều trị, tra cứu thuốc tủ trực và thiết bị buồng bệnh.',
  pharmacist:
    'Duyệt đơn thuốc lâm sàng, cấp bù cơ số thuốc tủ trực cấp cứu, điều phối xuất thuốc theo hạn dùng, giám sát chuỗi lạnh bảo quản vắc xin và quản lý vỏ thuốc đặc biệt.',
  nurse:
    'Thực hiện y lệnh thuốc và chỉ định điều trị của bác sĩ, theo dõi người bệnh và kiểm tra cơ số thuốc tủ trực cấp cứu khoa phòng.',
  biomedical_engineer:
    'Tiếp nhận sửa chữa máy móc y tế, quản lý lý lịch thiết bị, kiểm tra an toàn điện buồng bệnh và kiểm kê tài sản trang thiết bị định kỳ.',
  director:
    'Lãnh đạo trực điều hành toàn viện, phê duyệt chỉ định chuyên môn cấp bách và điều phối hoạt động cấp cứu bệnh viện.',
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

  const responsibilitiesText =
    CLEAN_ROLE_RESPONSIBILITIES[profile.role] ||
    profile.responsibilities
      .replace(/CPOE/gi, 'thuốc')
      .replace(/FEFO/gi, 'hạn dùng')
      .replace(/\(TT\s*[^\)]+\)/gi, '')
      .trim();

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
        // storage fallback
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
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-8 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-100"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full sm:max-w-4xl xl:max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-100">
        {/* Header Tối Giản Rộng Thoáng */}
        <div className="h-16 px-6 sm:px-8 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">Thông tin cá nhân</h2>
            <p className="text-xs text-slate-400">Hồ sơ nhân viên &amp; vai trò ca trực</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 -mr-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            aria-label="Đóng cửa sổ"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Thân Form Khổ Rộng Rất Thoáng */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-7">
          {/* Khối Avatar & Định danh chính */}
          <div className="flex items-center gap-5 sm:gap-6 pb-7 border-b border-slate-100">
            <div className="relative shrink-0">
              {customAvatar ? (
                <img
                  src={customAvatar}
                  alt={profile.name}
                  className="w-20 h-20 sm:w-22 sm:h-22 rounded-full object-cover border border-slate-200 shadow-xs"
                />
              ) : (
                <div className="w-20 h-20 sm:w-22 sm:h-22 rounded-full bg-teal-700 text-white flex items-center justify-center font-bold text-2xl shadow-xs">
                  {initials}
                </div>
              )}
              <label
                htmlFor="staff-avatar-upload"
                className="absolute bottom-0 right-0 p-2 bg-white border border-slate-200 text-slate-600 rounded-full shadow-xs hover:text-slate-900 cursor-pointer transition active:scale-95"
                title="Thay ảnh đại diện"
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

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="text-xl sm:text-2xl font-bold text-slate-900">{profile.name}</h3>
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Đang trong ca trực
                </span>
              </div>
              <p className="text-sm font-semibold text-teal-700 mt-1">{profile.roleName}</p>
              <p className="text-xs text-slate-500 mt-0.5">{profile.department}</p>

              {customAvatar && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  className="mt-2 text-xs text-rose-600 hover:text-rose-700 font-medium inline-flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Xóa ảnh
                </button>
              )}
            </div>
          </div>

          {/* Lưới Thông Tin Cơ Bản Khổ Rộng 3 Cột */}
          <div className="space-y-4 pb-7 border-b border-slate-100">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Thông tin chi tiết
            </h4>
            <dl className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-5 gap-x-8 text-sm">
              <div>
                <dt className="text-xs text-slate-400">Họ và tên</dt>
                <dd className="text-sm font-bold text-slate-900 mt-0.5">{profile.name}</dd>
              </div>

              <div>
                <dt className="text-xs text-slate-400">Vai trò / Chức danh</dt>
                <dd className="text-sm font-semibold text-slate-800 mt-0.5">{profile.roleName}</dd>
              </div>

              <div>
                <dt className="text-xs text-slate-400">Khoa / Phòng ban</dt>
                <dd className="text-sm font-semibold text-slate-800 mt-0.5">{profile.department}</dd>
              </div>

              <div>
                <dt className="text-xs text-slate-400">Chứng chỉ hành nghề (CCHN)</dt>
                <dd className="text-sm font-semibold text-slate-800 font-mono mt-0.5">
                  {profile.practiceCertificate || 'Đang cập nhật'}
                </dd>
              </div>

              <div>
                <dt className="text-xs text-slate-400">Mã thẻ nhân viên / RFID</dt>
                <dd className="text-sm font-semibold text-slate-800 font-mono mt-0.5">
                  {profile.rfidCardId || 'RFID-TEMP-0000'}
                </dd>
              </div>

              <div>
                <dt className="text-xs text-slate-400">Xác thực mã PIN</dt>
                <dd className="text-sm font-medium text-slate-600 font-mono mt-0.5">
                  •••••• <span className="text-xs text-slate-400 font-sans font-normal">(Đã kích hoạt)</span>
                </dd>
              </div>
            </dl>
          </div>

          {/* Trách Nhiệm Ca Trực (Ngôn ngữ tự nhiên, không từ viết tắt) */}
          <div className="space-y-2 pb-7 border-b border-slate-100">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Trách nhiệm ca trực
            </h4>
            <p className="text-sm text-slate-700 leading-relaxed">
              {responsibilitiesText}
            </p>
          </div>

          {/* Phân Hệ Được Phân Quyền (Không từ viết tắt) */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Phân hệ được cấp quyền ({profile.allowedTabs.length})
            </h4>
            <div className="flex flex-wrap gap-2.5">
              {profile.allowedTabs.map((tabKey) => (
                <span
                  key={tabKey}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-100 text-slate-800 text-xs font-medium"
                >
                  {TAB_LABELS[tabKey] || tabKey}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="h-16 px-6 sm:px-8 border-t border-slate-100 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold transition cursor-pointer active:scale-95 shadow-xs"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
