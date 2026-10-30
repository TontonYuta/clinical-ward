/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Modal Dặn Dò Bác Sĩ & Lên Lịch Nhắc Uống Thuốc qua Google Apps Script (<=200 LOC)
 */

import React, { useState } from 'react';
import { X, Mail, Clock, Send, Printer, Settings, CheckCircle2, AlertCircle, Loader2, Eye, Phone } from 'lucide-react';
import { PrescriptionOrder } from '../../types/cpoe';
import { PatientPrescriptionAdvice, ScheduledMedication } from '../../types/medicationSchedule';
import {
  sendMedicationAdviceEmail,
  generateMedicationHtmlEmail,
  printMedicationAdvice,
  getStoredGasWebhookUrl,
  setStoredGasWebhookUrl,
  buildDefaultTimeSlots
} from '../../services/prescriptionAdviceService';
import { AdviceMedTable } from './PrescriptionAdvice/AdviceMedTable';
import { findPatientByNameOrQuery, INITIAL_PATIENTS } from '../../services/patientService';

interface PrescriptionAdviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: PrescriptionOrder | null;
}

export const PrescriptionAdviceModal: React.FC<PrescriptionAdviceModalProps> = ({
  isOpen,
  onClose,
  order
}) => {
  if (!isOpen || !order) return null;

  const matchedPatient = findPatientByNameOrQuery(order.patientName.toLowerCase(), INITIAL_PATIENTS);
  const [patientEmail, setPatientEmail] = useState(order.patientEmail || matchedPatient?.email || '');
  const [patientPhone, setPatientPhone] = useState(order.patientPhone || matchedPatient?.phone || '');
  const [generalAdvice, setGeneralAdvice] = useState('');
  const [gasUrl, setGasUrl] = useState(getStoredGasWebhookUrl());
  const [showConfig, setShowConfig] = useState(false);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [msg, setMsg] = useState('');
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(false);

  const initialMeds: ScheduledMedication[] = (order.items || []).map((it, i) => ({
    id: `sched-${i}`, medicationName: it.medicationName, activeIngredient: it.activeIngredient,
    dosage: it.dosage, route: it.route || 'Đường uống', durationDays: order.daysPrescribed || 7,
    specialInstructions: it.instructions || undefined, timeSlots: buildDefaultTimeSlots(it.frequency)
  }));

  const advicePayload: PatientPrescriptionAdvice = {
    id: `ADV-${order.id.replace('RX-', '')}`, prescriptionId: order.id,
    patientName: order.patientName, patientEmail, patientPhone: patientPhone || undefined, diagnosis: `${order.diagnosisIcd10} - ${order.diagnosisText}`,
    doctorName: order.doctorName, doctorHospital: 'Bệnh Viện Đa Khoa Lâm Sàng', department: order.department,
    createdAt: new Date().toISOString(), startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + (order.daysPrescribed || 7) * 86400000).toISOString().split('T')[0],
    generalDoctorAdvice: generalAdvice, medications: initialMeds, notificationStatus: 'idle', gasWebhookUrl: gasUrl
  };

  const handleSend = async () => {
    if (!emailEnabled && !smsEnabled) { setStatus('error'); setMsg('Chọn ít nhất một kênh thông báo.'); return; }
    setStatus('loading');
    setMsg('Đang gửi lịch dặn dò...');
    try {
      if (gasUrl) setStoredGasWebhookUrl(gasUrl);
      const res = await sendMedicationAdviceEmail({ ...advicePayload, patientPhone: smsEnabled ? patientPhone : undefined }, { sendEmail: emailEnabled, sendSms: smsEnabled });
      setStatus(res.success ? 'success' : 'error');
      setMsg(res.message);
    } catch (err: any) {
      setStatus('error');
      setMsg(err.message || 'Lỗi kết nối');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden text-xs">
        {/* Header */}
        <div className="px-4 py-3 bg-teal-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-teal-300" />
            <h3 className="font-bold text-sm">Dặn dò & Lên lịch nhắc uống thuốc hàng ngày</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-teal-800 text-teal-200 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body scrollable */}
        <div className="p-4 overflow-y-auto space-y-3.5 flex-1 text-slate-700">
          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex justify-between gap-2 text-2xs">
            <div>
              <span className="text-slate-400">Bệnh nhân: </span>
              <strong className="text-slate-900 text-xs">{order.patientName} ({order.patientGender})</strong>
              <p className="text-slate-500">Mã: {order.patientId} • Bệnh: {order.diagnosisText}</p>
            </div>
            <div className="text-right">
              <span className="text-slate-400">BS: </span>
              <strong className="text-slate-900 text-xs">{order.doctorName}</strong>
              <p className="text-slate-500">Khoa: {order.department} • Đơn: {order.id}</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-800 flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-teal-700" />
              <span>Email bệnh nhân nhận lịch:</span>
              </label>
              <button
                type="button"
                onClick={() => setShowConfig(!showConfig)}
                className="text-[11px] text-teal-700 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Settings className="w-3 h-3" />
                <span>{showConfig ? 'Đóng cấu hình' : 'Cấu hình Google Script'}</span>
              </button>
            </div>
            <input
              type="email"
              required={emailEnabled}
              disabled={!emailEnabled}
              value={patientEmail}
              onChange={(e) => setPatientEmail(e.target.value)}
              placeholder="nhap-email-benh-nhan@example.com"
              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-slate-900 text-xs focus:ring-1 focus:ring-teal-700 focus:outline-hidden"
            />
            <label className="flex items-center gap-2 text-sm font-medium text-slate-800 py-1">
              <input type="checkbox" checked={emailEnabled} onChange={e => setEmailEnabled(e.target.checked)} /> Gửi qua email
            </label>
            <label className="flex items-center gap-2 font-semibold text-slate-800 pt-2">
              <input type="checkbox" checked={smsEnabled} onChange={e => setSmsEnabled(e.target.checked)} />
              <Phone className="w-3.5 h-3.5 text-slate-600" />
              <span>Gửi SMS song song (tùy chọn):</span>
            </label>
            <input
              type="tel" inputMode="tel" autoComplete="tel"
              value={patientPhone} onChange={(e) => setPatientPhone(e.target.value)}
              placeholder="Ví dụ: 09xxxxxxxx"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 text-sm focus:ring-1 focus:ring-slate-500 focus:outline-hidden"
            />
            {smsEnabled && <p className="text-xs text-slate-700 bg-slate-50 p-2 rounded">SMS được gửi qua backend khi Twilio đã cấu hình. Trạng thái chỉ thành công sau khi nhà cung cấp xác nhận.</p>}
            {showConfig && (
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1 mt-1 text-[11px]">
                <span className="font-semibold text-slate-800 block">Google Apps Script Web App URL:</span>
                <input
                  type="url"
                  value={gasUrl}
                  onChange={(e) => setGasUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                  className="w-full px-2.5 py-1 rounded border border-slate-300 text-xs text-slate-800 font-mono"
                />
              </div>
            )}
          </div>

          <div>
            <h4 className="font-bold text-slate-900 mb-1.5">Lịch cữ uống thuốc trong ngày (Tự động thiết lập):</h4>
            <AdviceMedTable meds={initialMeds} />
          </div>

          <div>
            <label className="font-semibold text-slate-800 block mb-1">Lời dặn dò của bác sĩ:</label>
            <textarea
              rows={2}
              value={generalAdvice}
              onChange={(e) => setGeneralAdvice(e.target.value)}
              placeholder="Nhập lời dặn dò của bác sĩ (uống nhiều nước, kiêng khem, tái khám...)"
              className="w-full p-2.5 rounded-lg border border-slate-300 text-xs text-slate-900 leading-relaxed focus:ring-1 focus:ring-teal-700 focus:outline-hidden"
            />
          </div>

          {showEmailPreview && (
            <div className="border border-slate-300 rounded-lg p-3 bg-slate-50 space-y-2">
              <span className="font-bold text-slate-800 block text-xs">Bản xem trước Email gửi bệnh nhân:</span>
              <div
                className="bg-white p-3 rounded border border-slate-200 text-xs overflow-x-auto max-h-56"
                dangerouslySetInnerHTML={{ __html: generateMedicationHtmlEmail(advicePayload) }}
              />
            </div>
          )}

          {msg && (
            <div className={`p-2.5 rounded-lg border flex items-center gap-2 text-xs ${
              status === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
              status === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-blue-50 border-blue-200 text-blue-800'
            }`}>
              {status === 'loading' && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
              {status === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
              {status === 'error' && <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
              <span>{msg}</span>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => printMedicationAdvice(advicePayload)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-semibold cursor-pointer">
              <Printer className="w-3.5 h-3.5" />
              <span>In phiếu dặn dò</span>
            </button>
            <button type="button" onClick={() => setShowEmailPreview(!showEmailPreview)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-semibold cursor-pointer">
              <Eye className="w-3.5 h-3.5 text-slate-500" />
              <span>{showEmailPreview ? 'Ẩn Email' : 'Xem Email'}</span>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-md border border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer">
              Đóng
            </button>
            <button type="button" onClick={handleSend} disabled={status === 'loading' || (!emailEnabled && !smsEnabled) || (emailEnabled && !patientEmail) || (smsEnabled && !patientPhone) || (emailEnabled && !gasUrl)} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm cursor-pointer disabled:opacity-60">
              {status === 'loading' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>{smsEnabled ? 'Gửi thông báo' : 'Gửi Email Bệnh Nhân'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
