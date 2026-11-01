import React from 'react';
import { PrescriptionOrder } from '../../../../types/cpoe';

export function formatPrescriptionQuantity(quantity: number, isNarcotic = false): string {
  const formatted = Number.isInteger(quantity) && quantity < 10 ? `0${quantity}` : String(quantity);
  return isNarcotic ? `${formatted} (${quantity} bằng số)` : formatted;
}

export const PrescriptionPrintDocument: React.FC<{ order: PrescriptionOrder }> = ({ order }) => (
  <article id="prescription-print-document" className="prescription-print-document" lang="vi">
    <header className="rx-print-header">
      <strong>{order.department || 'Cơ sở khám bệnh, chữa bệnh'}</strong>
      <h1>ĐƠN THUỐC</h1>
      <span>{order.status === 'signed' && order.digitalSignature ? 'BẢN ĐƠN ĐÃ KÝ' : 'BẢN NHÁP - CHƯA KÝ'}</span>
      <div>Mã đơn nội bộ: {order.id}</div>
    </header>
    <section>
      <p><b>Họ tên:</b> {order.patientName}</p>
      <p><b>Số định danh/CCCD/hộ chiếu (nếu có):</b> {order.patientCccd || '—'}</p>
      <p><b>Ngày sinh:</b> {order.patientDob || '—'}　 <b>Giới tính:</b> {order.patientGender || '—'}　 <b>Cân nặng:</b> {order.patientWeight ?? '—'}</p>
      <p><b>Nơi cư trú:</b> {order.patientAddress || '—'}</p>
      <p><b>Chẩn đoán:</b> {order.diagnosisIcd10 ? `[${order.diagnosisIcd10}] ` : ''}{order.diagnosisText}</p>
    </section>
    <section>
      <b>Thuốc điều trị:</b>
      <ol className="rx-print-medicines">
        {order.items.map((item, index) => <li key={item.id || index}>
          <b>{item.medicationName}</b>{item.activeIngredient ? ` (${item.activeIngredient})` : ''}
          <div>Liều mỗi lần: {item.dosage || '—'}; số lần: {item.frequency || '—'}; đường dùng: {item.route || '—'}; thời điểm/lời dặn: {item.instructions || '—'}</div>
          <div>Số lượng: {formatPrescriptionQuantity(item.quantity, item.isNarcotic)} {item.unit || ''}; số ngày sử dụng: {item.durationDays ?? order.daysPrescribed ?? '—'}</div>
        </li>)}
      </ol>
    </section>
    <section><b>Lời dặn:</b> {order.clinicalNotes || '—'}</section>
    <footer>
      <p>Khám bệnh lại xin mang theo đơn này.</p>
      <p>Điện thoại liên hệ: {order.patientPhone || '—'}　 Người đưa trẻ đến khám (nếu dưới 72 tháng): {order.guardianName || '—'}</p>
      <div className="rx-print-signature">Ngày kê: {order.prescribedAt || '—'}<br/>Bác sĩ/Y sĩ khám bệnh<br/>{order.status === 'signed' && order.digitalSignature ? `Đã ký: ${order.doctorName}` : 'Chưa ký'}<br/>{order.status === 'signed' && order.digitalSignature ? order.doctorName : ''}</div>
    </footer>
  </article>
);
