/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Trình tạo mẫu HTML Email và Bản In Phiếu Dặn Dò Uống Thuốc (<=100 LOC)
 */

import { PatientPrescriptionAdvice } from '../types/medicationSchedule';

export function generateMedicationHtmlEmail(advice: PatientPrescriptionAdvice, forPrint = false): string {
  const rows = advice.medications.map((m, idx) => {
    const slot = (k: string) => {
      const s = m.timeSlots.find(sl => sl.id === k || sl.label.toLowerCase().includes(k));
      return s ? `<strong>${s.dosageText}</strong><br/><span style="font-size:11px;color:#475569;">${s.mealRelation || ''}</span>` : '—';
    };
    return `
      <tr style="border-bottom:1px solid #e2e8f0;background-color:${idx % 2 === 1 ? '#f8fafc' : '#ffffff'};">
        <td style="padding:8px 10px;font-weight:600;color:#0f172a;">${m.medicationName}</td>
        <td style="padding:8px 6px;text-align:center;">${slot('morning')}</td>
        <td style="padding:8px 6px;text-align:center;">${slot('noon')}</td>
        <td style="padding:8px 6px;text-align:center;">${slot('afternoon')}</td>
        <td style="padding:8px 6px;text-align:center;">${slot('evening')}</td>
      </tr>
    `;
  }).join('');

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;max-width:680px;margin:0 auto;background:#fff;border:1px solid #cbd5e1;border-radius:6px;overflow:hidden;color:#0f172a;line-height:1.4;">
      <div style="border-bottom:2px solid #0f172a;padding:14px 18px;text-align:center;background:#f8fafc;">
        <h2 style="margin:0;font-size:16px;letter-spacing:0.3px;color:#0f172a;">PHIẾU DẶN DÒ UỐNG THUỐC HÀNG NGÀY</h2>
        <p style="margin:3px 0 0;font-size:12px;color:#475569;">${advice.doctorHospital || 'Bệnh Viện Lâm Sàng'} • Bác sĩ: ${advice.doctorName}</p>
      </div>
      <div style="padding:16px 18px;">
        <div style="margin-bottom:12px;font-size:12px;border-bottom:1px dashed #cbd5e1;padding-bottom:10px;">
          <div><strong>Người bệnh:</strong> ${advice.patientName} ${advice.patientEmail ? `(${advice.patientEmail})` : ''} ${advice.patientPhone ? `• Điện thoại: ${advice.patientPhone}` : ''} • <strong>Chẩn đoán:</strong> ${advice.diagnosis || 'Điều trị ngoại trú'}</div>
          <div style="color:#475569;margin-top:2px;">Thời gian uống: ${advice.startDate} đến ${advice.endDate}</div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:12px;border:1px solid #cbd5e1;margin-bottom:14px;">
          <thead>
            <tr style="background:#f1f5f9;border-bottom:1px solid #cbd5e1;color:#0f172a;font-weight:700;">
              <th style="padding:8px 10px;text-align:left;width:32%;">Thuốc & Hàm lượng</th>
              <th style="padding:8px 6px;width:17%;text-align:center;">Sáng (07:00)</th>
              <th style="padding:8px 6px;width:17%;text-align:center;">Trưa (11:30)</th>
              <th style="padding:8px 6px;width:17%;text-align:center;">Chiều (18:00)</th>
              <th style="padding:8px 6px;width:17%;text-align:center;">Tối (20:00)</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        ${advice.generalDoctorAdvice ? `
        <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:10px 12px;border-radius:4px;font-size:12px;margin-bottom:12px;">
          <strong style="color:#0f172a;">Lời dặn của bác sĩ:</strong>
          <div style="color:#334155;margin-top:2px;white-space:pre-line;">${advice.generalDoctorAdvice}</div>
        </div>` : ''}
        <div style="font-size:11px;color:#64748b;text-align:center;border-top:1px solid #f1f5f9;padding-top:10px;">
          ${forPrint ? 'Quý người bệnh vui lòng mang theo phiếu này khi tái khám.' : 'Thông báo tự động từ Hệ thống Đơn thuốc Điện tử & Quản lý Dược Lâm sàng.'}
        </div>
      </div>
    </div>
  `;
}
