/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Thẻ Tác Tử Chatbot: Lịch Uống Thuốc & Dặn Dò Bác Sĩ (<=200 LOC)
 */

import React, { useState } from 'react';
import { Mail, Clock, CheckCircle2, AlertCircle, Eye, Printer, Loader2 } from 'lucide-react';
import { PatientPrescriptionAdvice } from '../../../types/medicationSchedule';
import {
  sendMedicationAdviceEmail,
  generateMedicationHtmlEmail,
  printMedicationAdvice
} from '../../../services/prescriptionAdviceService';
import { openPatientDetailModal } from '../../../services/patientService';

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
    printMedicationAdvice(advice);
  };

  return (
    <div className="space-y-3 bg-white p-3 sm:p-3.5 rounded-lg border border-slate-200 text-xs shadow-2xs">
      {/* 1. Header Bệnh nhân & Email */}
      <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
        <div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => openPatientDetailModal(advice.patientName)}
              className="font-bold text-slate-900 text-sm hover:text-teal-700 hover:underline cursor-pointer text-left"
              title="Nhấp để xem hồ sơ bệnh nhân"
            >
              {advice.patientName}
            </button>
            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300 text-[10px] font-medium">
              {advice.diagnosis || 'Điều trị ngoại trú'}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold">
              Đã lưu CSDL EHR
            </span>
          </div>
          <p className="text-slate-500 text-[11px] mt-0.5 flex items-center gap-1">
            <Mail className="w-3 h-3 text-slate-400" />
            <span className="font-mono text-slate-700">{advice.patientEmail || 'Chưa cập nhật email'}</span>
            • <strong className="text-slate-800">{advice.doctorName?.startsWith('BS') ? advice.doctorName : `BS. ${advice.doctorName}`}</strong>
          </p>
        </div>
        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white hover:bg-slate-100 text-slate-700 cursor-pointer border border-slate-300 text-2xs font-semibold shrink-0 shadow-2xs"
          title="In phiếu dặn dò uống thuốc"
        >
          <Printer className="w-3.5 h-3.5 text-slate-600" />
          <span>In phiếu</span>
        </button>
      </div>

      {/* 2. Bảng Thời Gian Biểu Uống Thuốc Hàng Ngày */}
      <div className="overflow-x-auto border border-slate-300 rounded">
        <table className="w-full text-left text-[11px] border-collapse">
          <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
            <tr>
              <th className="py-2 px-2.5 border-r border-slate-200">Tên thuốc & hàm lượng</th>
              <th className="py-2 px-1 text-center border-r border-slate-200 w-16">Sáng<br/><span className="text-[10px] text-slate-500 font-normal">07:00</span></th>
              <th className="py-2 px-1 text-center border-r border-slate-200 w-16">Trưa<br/><span className="text-[10px] text-slate-500 font-normal">11:30</span></th>
              <th className="py-2 px-1 text-center border-r border-slate-200 w-16">Chiều<br/><span className="text-[10px] text-slate-500 font-normal">18:00</span></th>
              <th className="py-2 px-1 text-center w-16">Tối<br/><span className="text-[10px] text-slate-500 font-normal">20:00</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-900">
            {advice.medications.map((m, idx) => {
              const renderSlot = (key: string) => {
                const s = m.timeSlots.find(slot => slot.id === key || slot.label.toLowerCase().includes(key));
                if (!s) return <span className="text-slate-300">—</span>;
                return (
                  <span className="block text-2xs">
                    <strong className="text-slate-900 font-bold font-mono">{s.dosageText}</strong>
                    <span className="text-slate-500 block text-[9px] leading-tight">{s.mealRelation || s.time}</span>
                  </span>
                );
              };
              return (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="py-2 px-2.5 border-r border-slate-200 max-w-[140px]">
                    <span className="font-bold text-slate-900 block truncate" title={m.medicationName}>{m.medicationName}</span>
                    <span className="text-[10px] text-slate-500 block">{m.dosage} • {m.durationDays} ngày</span>
                  </td>
                  <td className="py-2 px-1 text-center border-r border-slate-200">{renderSlot('morning')}</td>
                  <td className="py-2 px-1 text-center border-r border-slate-200">{renderSlot('noon')}</td>
                  <td className="py-2 px-1 text-center border-r border-slate-200">{renderSlot('afternoon')}</td>
                  <td className="py-2 px-1 text-center">{renderSlot('evening')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 3. Lời Dặn Của Bác Sĩ (chỉ hiện khi có nội dung) */}
      {advice.generalDoctorAdvice && advice.generalDoctorAdvice.trim() ? (
        <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
          <span className="font-bold text-slate-800 block mb-0.5">Lời dặn của bác sĩ:</span>
          <p className="text-[11px] text-slate-700 leading-relaxed whitespace-pre-line">
            {advice.generalDoctorAdvice}
          </p>
        </div>
      ) : null}

      {/* 4. Trạng Thái & Thao Tác Gửi Google Apps Script Webhook */}
      {feedback && (
        <div className={`p-2 rounded-md border flex items-center gap-1.5 text-[11px] ${
          sendStatus === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
          sendStatus === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800' :
          'bg-slate-50 border-slate-200 text-slate-800'
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
          className={`flex-1 inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded text-xs font-bold transition cursor-pointer shadow-2xs ${
            sendStatus === 'success'
              ? 'bg-slate-800 hover:bg-slate-900 text-white'
              : 'bg-slate-900 hover:bg-black text-white'
          } disabled:opacity-60 disabled:cursor-not-allowed`}
        >
          {sendStatus === 'loading' ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Đang gửi mail...</span>
            </>
          ) : (
            <>
              <Mail className="w-3.5 h-3.5 text-slate-300" />
              <span>{sendStatus === 'success' ? 'Gửi lại Email nhắc thuốc' : 'Gửi Email qua Google Script'}</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => setShowPreview(!showPreview)}
          className="inline-flex items-center gap-1 h-8 px-3 rounded border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-semibold cursor-pointer shrink-0 shadow-2xs"
        >
          <Eye className="w-3.5 h-3.5 text-slate-600" />
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
