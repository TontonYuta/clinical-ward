/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Modal Dặn Dò Bác Sĩ & Lên Lịch Nhắc Uống Thuốc qua Google Apps Script (<=200 LOC)
 */

import React, { useState } from 'react';
import { X, Mail, Clock, Send, Printer, Settings, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { PrescriptionOrder } from '../../types/cpoe';
import { PatientPrescriptionAdvice, ScheduledMedication } from '../../types/medicationSchedule';
import {
  sendMedicationAdviceEmail,
  generateMedicationHtmlEmail,
  getStoredGasWebhookUrl,
  setStoredGasWebhookUrl,
  buildDefaultTimeSlots
} from '../../services/prescriptionAdviceService';
import { AdviceMedTable } from './PrescriptionAdvice/AdviceMedTable';

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

  const [patientEmail, setPatientEmail] = useState('benhnhan@example.com');
  const [generalAdvice, setGeneralAdvice] = useState(
    'Uống thuốc đúng giờ theo cữ. Uống đủ 2 lít nước/ngày. Tránh rượu bia, thức ăn chua cay. Tái khám sau khi hết đơn thuốc.'
  );
  const [gasUrl, setGasUrl] = useState(getStoredGasWebhookUrl());
  const [showConfig, setShowConfig] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  const initialMeds: ScheduledMedication[] = (order.items || []).map((it, i) => ({
    id: `sched-${i}`, medicationName: it.medicationName, activeIngredient: it.activeIngredient,
    dosage: it.dosage, route: it.route || 'Đường uống', durationDays: order.daysPrescribed || 7,
    specialInstructions: it.instructions || undefined, timeSlots: buildDefaultTimeSlots(it.frequency)
  }));

  const advicePayload: PatientPrescriptionAdvice = {
    id: `ADV-${order.id.replace('RX-', '')}`, prescriptionId: order.id,
    patientName: order.patientName, patientEmail, diagnosis: `${order.diagnosisIcd10} - ${order.diagnosisText}`,
    doctorName: order.doctorName, doctorHospital: 'Bệnh Viện Đa Khoa Lâm Sàng', department: order.department,
    createdAt: new Date().toISOString(), startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + (order.daysPrescribed || 7) * 86400000).toISOString().split('T')[0],
    generalDoctorAdvice: generalAdvice, medications: initialMeds, notificationStatus: 'idle', gasWebhookUrl: gasUrl
  };

  const handleSend = async () => {
    setStatus('loading');
    setMsg('Đang gửi dữ liệu đến Google Apps Script Webhook...');
    try {
      if (gasUrl) setStoredGasWebhookUrl(gasUrl);
      const res = await sendMedicationAdviceEmail(advicePayload);
      setStatus(res.success ? 'success' : 'error');
      setMsg(res.message);
    } catch (err: any) {
      setStatus('error');
      setMsg(err.message || 'Lỗi kết nối');
    }
  };

  const handlePrint = () => {
    const html = generateMedicationHtmlEmail(advicePayload);
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(`<html><head><title>Phiếu dặn dò - ${order.patientName}</title></head><body>${html}</body></html>`);
      w.document.close();
      w.print();
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
              value={patientEmail}
              onChange={(e) => setPatientEmail(e.target.value)}
              placeholder="nhap-email-benh-nhan@example.com"
              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-slate-900 text-xs focus:ring-1 focus:ring-teal-700 focus:outline-hidden"
            />
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
              className="w-full p-2.5 rounded-lg border border-slate-300 text-xs text-slate-900 leading-relaxed focus:ring-1 focus:ring-teal-700 focus:outline-hidden"
            />
          </div>

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
          <button type="button" onClick={handlePrint} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-semibold cursor-pointer">
            <Printer className="w-3.5 h-3.5" />
            <span>In phiếu dặn dò</span>
          </button>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-md border border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer">
              Đóng
            </button>
            <button type="button" onClick={handleSend} disabled={status === 'loading' || !patientEmail} className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-teal-800 hover:bg-teal-900 text-white font-bold cursor-pointer disabled:opacity-60">
              {status === 'loading' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>Gửi Email Bệnh Nhân</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
