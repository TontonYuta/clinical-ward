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
      <div>Mã đơn thuốc: {order.id}</div>
    </header>
    <section>
      <p><b>Họ tên:</b> {order.patientName}</p>
      <p><b>Số định danh cá nhân/CCCD/căn cước/hộ chiếu (nếu có):</b> {order.patientCccd || '—'}</p>
      <p><b>Ngày sinh:</b> {order.patientDob || '—'}　 <b>Cân nặng (bắt buộc với trẻ dưới 72 tháng):</b> {order.patientWeight ?? '—'}　 <b>Giới tính:</b> {order.patientGender || '—'}</p>
      <p><b>Mã số bảo hiểm y tế (nếu có):</b> {order.patientInsuranceId || '—'}</p>
      <p><b>Nơi cư trú:</b> {order.patientAddress || '—'}</p>
      <p><b>Chẩn đoán:</b> {order.diagnosisIcd10 ? `[${order.diagnosisIcd10}] ` : ''}{order.diagnosisText}</p>
    </section>
    <section>
      <b>Thuốc điều trị:</b>
      <ol className="rx-print-medicines">
        {order.items.map((item, index) => <li key={item.id || index}>
          <b>{item.medicationName}</b>{item.activeIngredient ? ` (${item.activeIngredient})` : ''}
          <div>Liều dùng mỗi lần: {item.dosage || '—'}</div>
          <div>Số lần dùng / khoảng cách giữa các lần dùng: {item.frequency || '—'}</div>
          <div>Đường dùng: {item.route || '—'}; thời điểm / cách dùng: {item.instructions || '—'}</div>
          <div>Số lượng: {formatPrescriptionQuantity(item.quantity, item.isNarcotic)} {item.unit || ''}; thời gian dùng: {item.durationDays ?? order.daysPrescribed ?? '—'} ngày</div>
        </li>)}
      </ol>
    </section>
    <section><b>Lời dặn:</b> {order.clinicalNotes || '—'}</section>
    <footer>
      <p>Khám bệnh lại xin mang theo đơn này.</p>
      <p>Điện thoại liên hệ: {order.patientPhone || '—'}　 Người đưa trẻ đến khám (nếu dưới 72 tháng): {order.guardianName || '—'}</p>
      <div className="rx-print-signature">Ngày {order.prescribedAt || '—'}<br/>Bác sỹ/Y sỹ khám bệnh<br/>(Ký, ghi rõ họ tên)<br/>{order.status === 'signed' && order.digitalSignature ? `Đã ký: ${order.doctorName}` : 'BẢN NHÁP - CHƯA KÝ'}<br/>{order.status === 'signed' && order.digitalSignature ? order.doctorName : ''}</div>
    </footer>
  </article>
);
