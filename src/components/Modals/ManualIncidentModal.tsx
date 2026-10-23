/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, AlertTriangle, Wrench, Shield, PlusCircle } from 'lucide-react';
import { EquipmentTicket, DeviceRiskClass, UrgencyLevel } from '../../types/clinical';
import { clinicalAudio } from '../../utils/audio';

interface ManualIncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmIncident: (newTicket: Omit<EquipmentTicket, 'id' | 'code' | 'reportTime' | 'status'>) => void;
  isAudioMuted: boolean;
}

const COMMON_DEVICES = [
  {
    deviceName: 'Máy thở cao cấp Dräger Savina 300',
    deviceModel: 'Savina 300 Select',
    serialNumber: 'SAV-VN-2022-108',
    riskClass: 'D' as DeviceRiskClass,
    defaultLocation: 'Khoa Hồi Sức Tích Cực (ICU) - Buồng 04',
    commonIssue: 'Báo lỗi cảm biến áp lực turbine khí thở O2 FiO2',
    urgency: 'urgent' as UrgencyLevel
  },
  {
    deviceName: 'Monitor theo dõi bệnh nhân Mindray ePM 12M',
    deviceModel: 'ePM 12M Pro',
    serialNumber: 'MND-VN-2023-412',
    riskClass: 'C' as DeviceRiskClass,
    defaultLocation: 'Khoa Cấp Cứu A9 - Giường 02',
    commonIssue: 'Đầu dò SpO2 bị chập chờn, không hiển thị sóng mạch',
    urgency: 'urgent' as UrgencyLevel
  },
  {
    deviceName: 'Máy sốc tim 2 pha Zoll R Series Plus',
    deviceModel: 'R Series ALS',
    serialNumber: 'ZOL-VN-2021-089',
    riskClass: 'D' as DeviceRiskClass,
    defaultLocation: 'Khoa Cấp Cứu A9 - Xe Tiêm Cấp Cứu',
    commonIssue: 'Bản cực sốc tim ngoài lồng ngực báo tiếp xúc kém',
    urgency: 'urgent' as UrgencyLevel
  },
  {
    deviceName: 'Bơm tiêm điện B.Braun Perfusor Space',
    deviceModel: 'Perfusor Space Gen 2',
    serialNumber: 'BBR-VN-2022-771',
    riskClass: 'C' as DeviceRiskClass,
    defaultLocation: 'Phòng Mổ 02 - Gây Mê Hồi Sức',
    commonIssue: 'Báo động áp lực đường tiêm giả tạo dù dây thông suốt',
    urgency: 'normal' as UrgencyLevel
  }
];

export const ManualIncidentModal: React.FC<ManualIncidentModalProps> = ({
  isOpen,
  onClose,
  onConfirmIncident,
  isAudioMuted
}) => {
  const [selectedPreset, setSelectedPreset] = useState<number>(0);
  const [deviceName, setDeviceName] = useState<string>(COMMON_DEVICES[0].deviceName);
  const [deviceModel, setDeviceModel] = useState<string>(COMMON_DEVICES[0].deviceModel);
  const [serialNumber, setSerialNumber] = useState<string>(COMMON_DEVICES[0].serialNumber);
  const [riskClass, setRiskClass] = useState<DeviceRiskClass>(COMMON_DEVICES[0].riskClass);
  const [location, setLocation] = useState<string>(COMMON_DEVICES[0].defaultLocation);
  const [accessoryIssue, setAccessoryIssue] = useState<string>(COMMON_DEVICES[0].commonIssue);
  const [urgency, setUrgency] = useState<UrgencyLevel>(COMMON_DEVICES[0].urgency);
  const [assignedEngineer, setAssignedEngineer] = useState<string>('KS. Đặng Văn Nam (Kỹ sư TBYT trực)');
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSelectPreset = (idx: number) => {
    setSelectedPreset(idx);
    const d = COMMON_DEVICES[idx];
    setDeviceName(d.deviceName);
    setDeviceModel(d.deviceModel);
    setSerialNumber(d.serialNumber);
    setRiskClass(d.riskClass);
    setLocation(d.defaultLocation);
    setAccessoryIssue(d.commonIssue);
    setUrgency(d.urgency);
    setValidationError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceName.trim() || !serialNumber.trim() || !location.trim() || !accessoryIssue.trim()) {
      setValidationError('Vui lòng điền đầy đủ các thông tin sự cố (Tên máy, số serial, vị trí khoa phòng và mô tả hỏng hóc).');
      return;
    }

    if (!isAudioMuted) clinicalAudio.playSuccessChime();

    onConfirmIncident({
      deviceName,
      deviceModel,
      serialNumber,
      riskClass,
      accessoryIssue,
      location,
      urgency,
      assignedEngineer,
      lastInspectionDate: '2026-05-10',
      nextInspectionDue: '2026-11-10',
      inspectionUnit: 'Viện Trang Thiết Bị Y Tế - Bộ Y Tế (NIEMET)',
      legalBasis: 'Điều 34 Nghị định 98/2021/NĐ-CP & NĐ 07/2023',
      actionLog: [
        `${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}: Báo hỏng thủ công từ khoa ${location}. Ghi nhận sự cố '${accessoryIssue}'`
      ]
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="min-h-14 py-3 px-3.5 sm:px-5 bg-slate-900 text-white flex items-center justify-between shrink-0 gap-2">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30 shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-base font-bold truncate">Báo Hỏng Thiết Bị</h2>
              <span className="text-[11px] text-slate-400 font-mono truncate block">
                Nghị định 98/2021/NĐ-CP
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} noValidate className="p-5 overflow-y-auto space-y-4 text-xs text-slate-700 flex-1">
          {validationError && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Quick Preset Selector (Sleek Horizontal Pill Strip) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5">
                <span className="text-rose-600 font-bold">⚡</span> Chọn nhanh thiết bị viện:
              </label>
              {selectedPreset !== null && (
                <button
                  type="button"
                  onClick={() => setSelectedPreset(null)}
                  className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer underline"
                >
                  Xóa chọn
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1 -mx-1 px-1">
              {COMMON_DEVICES.map((d, idx) => {
                const isSelected = selectedPreset === idx;
                return (
                  <button
                    type="button"
                    key={idx}
                    onClick={() => handleSelectPreset(idx)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer shrink-0 border shadow-2xs whitespace-nowrap ${
                      isSelected
                        ? 'bg-rose-700 text-white border-rose-700 font-semibold shadow-xs'
                        : 'bg-slate-50 border-slate-200/90 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <span className="font-medium">{d.deviceName}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-medium ${
                        isSelected ? 'bg-rose-800 text-white' : 'bg-rose-50 text-rose-700 border border-rose-200/60'
                      }`}
                    >
                      Loại {d.riskClass}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Device Name & Model */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-slate-900 block">
                Tên thiết bị y tế <span className="text-rose-500">*</span>:
              </label>
              <input
                type="text"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                required
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:border-slate-800 focus:outline-hidden"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-900 block">Model &amp; Hãng:</label>
              <input
                type="text"
                value={deviceModel}
                onChange={(e) => setDeviceModel(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:border-slate-800 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Serial & Risk Class */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1 sm:col-span-2">
              <label className="font-bold text-slate-900 block">
                Số Serial / Mã định danh tài sản <span className="text-rose-500">*</span>:
              </label>
              <input
                type="text"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                required
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:border-slate-800 focus:outline-hidden font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-900 block">Phân loại rủi ro (NĐ 98):</label>
              <select
                value={riskClass}
                onChange={(e) => setRiskClass(e.target.value as DeviceRiskClass)}
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:border-slate-800 focus:outline-hidden font-bold"
              >
                <option value="D">Loại D (Rủi ro rất cao - Hồi sức/Máy thở)</option>
                <option value="C">Loại C (Rủi ro cao - Monitor/Bơm tiêm)</option>
                <option value="B">Loại B (Rủi ro trung bình)</option>
                <option value="A">Loại A (Rủi ro thấp)</option>
              </select>
            </div>
          </div>

          {/* Ward & Urgency */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-slate-900 block">
                Khoa / Buồng bệnh đặt thiết bị <span className="text-rose-500">*</span>:
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                required
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:border-slate-800 focus:outline-hidden"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-900 block">Mức độ khẩn cấp:</label>
              <select
                value={urgency}
                onChange={(e) => setUrgency(e.target.value as UrgencyLevel)}
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:border-slate-800 focus:outline-hidden font-bold"
              >
                <option value="urgent">Khẩn cấp (Cần cấp máy thay thế trong 15 phút)</option>
                <option value="warning">Cảnh báo (Xử lý trong ca trực)</option>
                <option value="normal">Bình thường (Bảo trì thông thường)</option>
              </select>
            </div>
          </div>

          {/* Issue Description */}
          <div className="space-y-1">
            <label className="font-bold text-slate-900 block">
              Mô tả chi tiết hiện tượng hư hỏng / Báo lỗi lâm sàng <span className="text-rose-500">*</span>:
            </label>
            <textarea
              rows={3}
              value={accessoryIssue}
              onChange={(e) => setAccessoryIssue(e.target.value)}
              required
              placeholder="VD: Máy thở turbine kêu to, áp lực Ppeak tụt đột ngột, sensor oxy báo sai số > 20%..."
              className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:border-slate-800 focus:outline-hidden resize-none"
            />
          </div>

          {/* Assigned Engineer */}
          <div className="space-y-1">
            <label className="font-bold text-slate-900 block">
              Kỹ sư TBYT tiếp nhận phân công:
            </label>
            <input
              type="text"
              value={assignedEngineer}
              onChange={(e) => setAssignedEngineer(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:border-slate-800 focus:outline-hidden font-medium"
            />
          </div>

          {/* Protocol Notice */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-700 text-[11px] flex items-start gap-2">
            <Wrench className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong>Quy trình kỹ thuật (Điều 34 Nghị định 98/2021/NĐ-CP):</strong> Sau khi tiếp nhận, Kỹ sư TBYT sẽ kiểm tra linh kiện, thay thế phụ kiện chuẩn CO/CQ và thực hiện <strong>Thử tải đo an toàn dòng rò điện lực</strong> trước khi ký biên bản bàn giao lại cho khoa lâm sàng.
            </div>
          </div>

          {/* Footer buttons */}
          <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
              <Shield className="w-3.5 h-3.5 text-teal-600" />
              <span>Ghi nhận sổ lý lịch máy &amp; Nhật ký kiểm toán</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5 active:scale-98"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Gửi Báo Hỏng Cho Kỹ Sư</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
