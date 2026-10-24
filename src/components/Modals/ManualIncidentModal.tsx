/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Modal Báo Hỏng Thiết Bị Y Tế (Nghị định 04/2025/NĐ-CP & NĐ 98/2021)
 */

import React, { useState } from 'react';
import { X, AlertTriangle, Wrench, Shield, PlusCircle } from 'lucide-react';
import { EquipmentTicket, DeviceRiskClass, UrgencyLevel } from '../../types/clinical';
import { clinicalAudio } from '../../utils/audio';
import { COMMON_DEVICES } from '../../data/commonDevicesData';
import { useModalDismiss } from '../../hooks/useModalDismiss';

interface ManualIncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmIncident: (newTicket: Omit<EquipmentTicket, 'id' | 'code' | 'reportTime' | 'status'>) => void;
  isAudioMuted: boolean;
}

export const ManualIncidentModal: React.FC<ManualIncidentModalProps> = ({
  isOpen,
  onClose,
  onConfirmIncident,
  isAudioMuted,
}) => {
  useModalDismiss(isOpen, onClose);
  const [selectedPreset, setSelectedPreset] = useState<number | null>(0);
  const [deviceName, setDeviceName] = useState(COMMON_DEVICES[0].deviceName);
  const [deviceModel, setDeviceModel] = useState(COMMON_DEVICES[0].deviceModel);
  const [serialNumber, setSerialNumber] = useState(COMMON_DEVICES[0].serialNumber);
  const [riskClass, setRiskClass] = useState<DeviceRiskClass>(COMMON_DEVICES[0].riskClass);
  const [location, setLocation] = useState(COMMON_DEVICES[0].defaultLocation);
  const [accessoryIssue, setAccessoryIssue] = useState(COMMON_DEVICES[0].commonIssue);
  const [urgency, setUrgency] = useState<UrgencyLevel>(COMMON_DEVICES[0].urgency);
  const [assignedEngineer, setAssignedEngineer] = useState('KS. Đặng Văn Nam (Kỹ sư TBYT trực)');
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
      setValidationError('Vui lòng điền đầy đủ các thông tin bắt buộc.');
      return;
    }
    if (!isAudioMuted) clinicalAudio.playSuccessChime();

    onConfirmIncident({
      deviceName, deviceModel, serialNumber, riskClass, accessoryIssue, location, urgency, assignedEngineer,
      lastInspectionDate: '2026-05-10',
      nextInspectionDue: '2026-11-10',
      inspectionUnit: 'Viện Trang Thiết Bị Y Tế - Bộ Y Tế (NIEMET)',
      legalBasis: 'Nghị định 04/2025/NĐ-CP & NĐ 98/2021/NĐ-CP',
      actionLog: [`${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}: Báo hỏng khoa ${location}. Ghi nhận: '${accessoryIssue}'`],
    });
    onClose();
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4"
    >
      <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="h-14 px-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold">Báo hỏng thiết bị y tế</h2>
              <span className="text-[11px] text-slate-400 font-mono">Nghị định 04/2025/NĐ-CP &amp; NĐ 98/2021</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="p-4 sm:p-5 overflow-y-auto space-y-3.5 text-xs text-slate-700 flex-1">
          {validationError && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-900 flex items-center gap-1.5">
                Chọn nhanh thiết bị viện:
              </label>
              {selectedPreset !== null && (
                <button type="button" onClick={() => setSelectedPreset(null)} className="text-slate-400 hover:text-slate-600 underline">Xóa chọn</button>
              )}
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1">
              {COMMON_DEVICES.map((d, idx) => (
                <button
                  type="button"
                  key={idx}
                  onClick={() => handleSelectPreset(idx)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs shrink-0 border ${
                    selectedPreset === idx ? 'bg-rose-700 text-white font-semibold' : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <span>{d.deviceName}</span>
                  <span className={`text-[10px] px-1 rounded ${selectedPreset === idx ? 'bg-rose-800 text-white' : 'bg-rose-50 text-rose-700'}`}>Loại {d.riskClass}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-900 block mb-1">Tên thiết bị *:</label>
              <input type="text" value={deviceName} onChange={(e) => setDeviceName(e.target.value)} required className="w-full px-3 py-1.5 border rounded-md" />
            </div>
            <div>
              <label className="font-bold text-slate-900 block mb-1">Model &amp; Hãng:</label>
              <input type="text" value={deviceModel} onChange={(e) => setDeviceModel(e.target.value)} className="w-full px-3 py-1.5 border rounded-md" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="font-bold text-slate-900 block mb-1">Số Serial / Mã tài sản *:</label>
              <input type="text" value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} required className="w-full px-3 py-1.5 border rounded-md font-mono" />
            </div>
            <div>
              <label className="font-bold text-slate-900 block mb-1">Phân loại rủi ro (NĐ 04/2025):</label>
              <select value={riskClass} onChange={(e) => setRiskClass(e.target.value as DeviceRiskClass)} className="w-full px-2 py-1.5 border rounded-md font-bold">
                <option value="D">Loại D (Rất cao)</option>
                <option value="C">Loại C (Rủi ro cao)</option>
                <option value="B">Loại B (Trung bình)</option>
                <option value="A">Loại A (Thấp)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-900 block mb-1">Khoa / Buồng *:</label>
              <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} required className="w-full px-3 py-1.5 border rounded-md" />
            </div>
            <div>
              <label className="font-bold text-slate-900 block mb-1">Mức độ khẩn cấp:</label>
              <select value={urgency} onChange={(e) => setUrgency(e.target.value as UrgencyLevel)} className="w-full px-2 py-1.5 border rounded-md font-bold">
                <option value="urgent">Khẩn cấp (Trong 15p)</option>
                <option value="warning">Cảnh báo (Trong ca)</option>
                <option value="normal">Bình thường</option>
              </select>
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-900 block mb-1">Mô tả hiện tượng hư hỏng *:</label>
            <textarea rows={2} value={accessoryIssue} onChange={(e) => setAccessoryIssue(e.target.value)} required placeholder="Mô tả sự cố..." className="w-full px-3 py-1.5 border rounded-md resize-none" />
          </div>

          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-slate-700 text-[11px] flex items-start gap-2">
            <Wrench className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
            <div><strong>Quy trình kỹ thuật (NĐ 04/2025/NĐ-CP):</strong> Thử tải an toàn điện trước khi bàn giao lại cho khoa lâm sàng.</div>
          </div>

          <div className="pt-2 border-t flex items-center justify-between">
            <span className="text-slate-500 text-[11px] flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-teal-600" /> Sổ lý lịch máy &amp; nhật ký</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg border text-slate-700 hover:bg-slate-50">Hủy</button>
              <button type="submit" className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold flex items-center gap-1.5">
                <PlusCircle className="w-3.5 h-3.5" /> Gửi báo hỏng
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
