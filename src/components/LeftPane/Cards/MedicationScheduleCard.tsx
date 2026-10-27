/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Thẻ Tác Tử Chatbot: Lịch Uống Thuốc & Dặn Dò Bác Sĩ (<=200 LOC)
 */

import React, { useState } from 'react';
import { Mail, Clock, CheckCircle2, AlertCircle, Eye, Printer, Loader2 } from 'lucide-react';
import { PatientPrescriptionAdvice } from '../../../types/medicationSchedule';
import { sendMedicationAdviceEmail, generateMedicationHtmlEmail } from '../../../services/prescriptionAdviceService';

interface MedicationScheduleCardProps {
  data: PatientPrescriptionAdvice;
  onSelectTab?: (tab: any) => void;
}

export const MedicationScheduleCard: React.FC<MedicationScheduleCardProps> = ({ data }) => {
  const [advice, setAdvice] = useState<PatientPrescriptionAdvice>(data);
  const [sendStatus, setSendStatus] = useState<'idle' | 'loading' | 'success' | 'error'>(
    data.notificationStatus || 'idle'
  );
  const [feedback, setFeedback] = useState<string>(data.feedbackMessage || '');
  const [showPreview, setShowPreview] = useState(false);

  const handleSendEmail = async () => {
    setSendStatus('loading');
    setFeedback('Đang kết nối Google Apps Script Webhook...');
    try {
      const res = await sendMedicationAdviceEmail(advice);
      if (res.success) {
        setSendStatus('success');
        setFeedback(res.message);
        setAdvice(prev => ({
          ...prev,
          notificationStatus: 'success',
          emailSentAt: res.timestamp,
          feedbackMessage: res.message
        }));
      } else {
        setSendStatus('error');
        setFeedback(res.message || 'Không thể gửi email nhắc nhở');
      }
    } catch (err: any) {
      setSendStatus('error');
      setFeedback(err.message || 'Lỗi khi gửi email');
    }
  };

  const handlePrint = () => {
    const html = generateMedicationHtmlEmail(advice);
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(`<html><head><title>Lịch Uống Thuốc - ${advice.patientName}</title></head><body>${html}</body></html>`);
      w.document.close();
      w.print();
    }
  };

  return (
    <div className="space-y-3 bg-white p-3 sm:p-3.5 rounded-lg border border-slate-200 text-xs shadow-2xs">
      {/* 1. Header Bệnh nhân & Email */}
      <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
        <div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-slate-900 text-sm">{advice.patientName}</span>
            <span className="px-1.5 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200 text-[10px] font-bold">
              {advice.diagnosis || 'Điều trị ngoại trú'}
            </span>
          </div>
          <p className="text-slate-500 text-[11px] mt-0.5 flex items-center gap-1">
            <Mail className="w-3 h-3 text-slate-400" />
            <span className="font-mono text-slate-700">{advice.patientEmail || 'Chưa cập nhật email'}</span>
            • BS: <strong className="text-slate-800">{advice.doctorName}</strong>
          </p>
        </div>
        <button
          type="button"
          onClick={handlePrint}
          className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-800 cursor-pointer border border-slate-200 shrink-0"
          title="In phiếu dặn dò uống thuốc"
        >
          <Printer className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 2. Bảng Thời Gian Biểu Uống Thuốc Hàng Ngày */}
      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-left text-[11px]">
          <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
            <tr>
              <th className="py-1.5 px-2.5">Thuốc</th>
              <th className="py-1.5 px-1.5 text-center bg-teal-50/60 text-teal-900">🌅 Sáng</th>
              <th className="py-1.5 px-1.5 text-center bg-amber-50/60 text-amber-900">☀️ Trưa</th>
              <th className="py-1.5 px-1.5 text-center bg-orange-50/60 text-orange-900">🌤️ Chiều</th>
              <th className="py-1.5 px-1.5 text-center bg-indigo-50/60 text-indigo-900">🌙 Tối</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {advice.medications.map((m, idx) => {
              const renderSlot = (key: string, color: string) => {
                const s = m.timeSlots.find(slot => slot.id === key || slot.label.toLowerCase().includes(key));
                if (!s) return <span className="text-slate-300">—</span>;
                return (
                  <span className={`font-bold ${color} block text-2xs`}>
                    {s.dosageText}
                    <span className="text-slate-400 font-normal block text-[9px]">{s.time}</span>
                  </span>
                );
              };
              return (
                <tr key={idx} className="hover:bg-slate-50/70">
                  <td className="py-2 px-2.5 max-w-[130px]">
                    <span className="font-bold text-slate-900 block truncate" title={m.medicationName}>{m.medicationName}</span>
                    <span className="text-[10px] text-slate-500 block truncate">{m.dosage} • {m.durationDays} ngày</span>
                  </td>
                  <td className="py-2 px-1 text-center font-mono">{renderSlot('morning', 'text-teal-800')}</td>
                  <td className="py-2 px-1 text-center font-mono">{renderSlot('noon', 'text-amber-800')}</td>
                  <td className="py-2 px-1 text-center font-mono">{renderSlot('afternoon', 'text-orange-800')}</td>
                  <td className="py-2 px-1 text-center font-mono">{renderSlot('evening', 'text-indigo-800')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 3. Lời Dặn Của Bác Sĩ */}
      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
        <span className="font-semibold text-slate-800 block mb-0.5">💡 Lời dặn của bác sĩ:</span>
        <p className="text-[11px] text-slate-600 leading-relaxed whitespace-pre-line">
          {advice.generalDoctorAdvice}
        </p>
      </div>

      {/* 4. Trạng Thái & Thao Tác Gửi Google Apps Script Webhook */}
      {feedback && (
        <div className={`p-2 rounded-md border flex items-center gap-1.5 text-[11px] ${
          sendStatus === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
          sendStatus === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800' :
          'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          {sendStatus === 'loading' && <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />}
          {sendStatus === 'success' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
          {sendStatus === 'error' && <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />}
          <span className="leading-tight">{feedback}</span>
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={handleSendEmail}
          disabled={sendStatus === 'loading'}
          className={`flex-1 inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-md text-xs font-bold transition cursor-pointer shadow-2xs active:scale-98 ${
            sendStatus === 'success'
              ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
              : 'bg-teal-800 hover:bg-teal-900 text-white'
          } disabled:opacity-60 disabled:cursor-not-allowed`}
        >
          {sendStatus === 'loading' ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Đang gửi mail...</span>
            </>
          ) : (
            <>
              <Mail className="w-3.5 h-3.5 text-teal-200" />
              <span>{sendStatus === 'success' ? 'Gửi lại Email nhắc thuốc' : 'Gửi Email qua Google Script'}</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => setShowPreview(!showPreview)}
          className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer shrink-0"
        >
          <Eye className="w-3.5 h-3.5 text-slate-500" />
          <span>{showPreview ? 'Ẩn xem trước' : 'Xem Email'}</span>
        </button>
      </div>

      {/* 5. Khung Xem Trước Email HTML Thu Nhỏ */}
      {showPreview && (
        <div className="border border-slate-200 rounded-lg p-2 bg-slate-50 max-h-56 overflow-y-auto">
          <div
            className="prose prose-xs max-w-none bg-white p-3 rounded border border-slate-200 text-slate-800"
            dangerouslySetInnerHTML={{ __html: generateMedicationHtmlEmail(advice) }}
          />
        </div>
      )}
    </div>
  );
};
