/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Modal Chi Tiết Sinh Phẩm & Vắc Xin GSP (Thông tư 36/2018/TT-BYT & WHO PQS)
 */

import React from 'react';
import { X, ShieldCheck, Thermometer, AlertTriangle, Snowflake, SunMedium, Building2, Calendar, FileText } from 'lucide-react';
import { VaccineBatchItem } from '../../types/clinical';
import { useModalDismiss } from '../../hooks/useModalDismiss';

interface VaccineDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  vaccine: VaccineBatchItem | null;
  isQuarantined?: boolean;
  onOpenPrintForm?: (formType: 'COLD_CHAIN_INCIDENT_REPORT') => void;
}

export const VaccineDetailModal: React.FC<VaccineDetailModalProps> = ({
  isOpen,
  onClose,
  vaccine,
  isQuarantined = false,
  onOpenPrintForm,
}) => {
  useModalDismiss(isOpen, onClose);

  if (!isOpen || !vaccine) return null;

  const effectivelyQuarantined = isQuarantined || vaccine.status === 'quarantined';

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="vaccine-detail-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="bg-white w-full max-w-2xl rounded-xl border border-slate-200 shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center shrink-0 text-teal-700">
              <Thermometer className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-sm sm:text-base truncate">
                  {vaccine.name}
                </h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-2xs font-bold border shrink-0 ${
                    effectivelyQuarantined
                      ? 'bg-amber-50 text-amber-900 border-amber-300'
                      : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  }`}
                >
                  {effectivelyQuarantined ? 'Đang Biệt Trữ' : 'Sẵn Sàng Tiêm'}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                Lô: {vaccine.batchNumber} · Hạn dùng: {vaccine.expiryDate}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            data-testid="vaccine-modal-close-btn"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs sm:text-sm">
          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <span className="text-2xs font-semibold text-slate-500 block">Cơ số tồn kho</span>
              <span className="font-mono font-bold text-slate-900 text-sm mt-0.5 block">
                {vaccine.quantity.toLocaleString()} {vaccine.unit}
              </span>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <span className="text-2xs font-semibold text-slate-500 block">Chỉ thị VVM</span>
              <span className="font-bold text-emerald-700 text-sm mt-0.5 flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block border border-emerald-600" />
                Cấp 1 (Đạt)
              </span>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <span className="text-2xs font-semibold text-slate-500 block">Nhiệt độ GSP</span>
              <span className="font-mono font-bold text-teal-800 text-sm mt-0.5 block">
                2°C – 8°C
              </span>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <span className="text-2xs font-semibold text-slate-500 block">Số đăng ký DAV</span>
              <span className="font-mono font-semibold text-slate-800 text-xs mt-0.5 block truncate">
                {vaccine.registrationNumber}
              </span>
            </div>
          </div>

          {/* Clinical Specifications */}
          <div className="border border-slate-200 rounded-lg p-3.5 space-y-2.5">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-teal-700" />
              Thông số Dược lý & Chuỗi lạnh GSP (TT 36/2018/TT-BYT)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-slate-600">
              <div>
                <span className="text-slate-400 block text-2xs">Tên hoạt chất / Thành phần:</span>
                <span className="font-medium text-slate-800">{vaccine.genericName}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-2xs">Nhà sản xuất / Quốc gia:</span>
                <span className="font-medium text-slate-800">{vaccine.manufacturer} ({vaccine.country})</span>
              </div>
              <div>
                <span className="text-slate-400 block text-2xs">Mã định danh Quốc gia:</span>
                <span className="font-mono text-slate-800">{vaccine.nationalCode}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-2xs">Quy chế bảo quản:</span>
                <span className="font-medium text-slate-800">{vaccine.storageCondition}</span>
              </div>
            </div>
          </div>

          {/* Safety Warning Flags */}
          <div className="flex flex-wrap gap-2">
            {vaccine.isFreezeSensitive && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-900 border border-blue-200">
                <Snowflake className="w-3.5 h-3.5 text-blue-600" />
                Nhạy cảm nhiệt đông (Lắc Shake Test nếu nghi đông đá)
              </span>
            )}
            {vaccine.isLightSensitive && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-900 border border-amber-200">
                <SunMedium className="w-3.5 h-3.5 text-amber-600" />
                Nhạy cảm ánh sáng (Bảo quản bao bì kín)
              </span>
            )}
          </div>

          {/* Clinical Notes */}
          {vaccine.notes && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-700 leading-relaxed">
              <strong className="text-slate-900 font-semibold block mb-1">Ghi chú lâm sàng & Sử dụng:</strong>
              {vaccine.notes}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            onClick={() => onOpenPrintForm?.('COLD_CHAIN_INCIDENT_REPORT')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-100 transition cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-slate-500" />
            <span>Biên bản GSP</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
