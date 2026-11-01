/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Mẫu In Đơn Thuốc A4 Chuẩn 100% Theo Thông Tư 26/2025/TT-BYT (Phụ lục I, II, III) (<=200 LOC)
 */

import React from 'react';
import { PrescriptionOrder, resolveTt26FormType, getTt26FormMetadata } from '../../../../types/cpoe';

export function formatPrescriptionQuantity(quantity: number, isNarcotic = false): string {
  const formatted = Number.isInteger(quantity) && quantity < 10 ? `0${quantity}` : String(quantity);
  return isNarcotic ? `${formatted} (${quantity} bằng số)` : formatted;
}

export const PrescriptionPrintDocument: React.FC<{ order: PrescriptionOrder }> = ({ order }) => {
  const formType = resolveTt26FormType(order);
  const meta = getTt26FormMetadata(formType);
  const isNarcoticForm = formType === 'PL2_NARCOTIC';
  const isPsychotropicForm = formType === 'PL3_PSYCHOTROPIC';

  const defaultFacility = {
    name: order.facilityName || 'BỆNH VIỆN ĐA KHOA LÂM SÀNG',
    address: order.facilityAddress || 'Số 01 Đường Y Học, Phường Lâm Sàng, Quận Y Tế',
    phone: order.facilityPhone || '024.3825.9999',
  };

  return (
    <article id="prescription-print-document" className="prescription-print-document" lang="vi">
      {/* 1. Header Cơ sở KBCB & Mã đơn thuốc 14 ký tự TT26 */}
      <header className="rx-print-header border-b border-black pb-2 mb-3">
        <div className="flex justify-between items-start text-xs text-left">
          <div className="space-y-0.5">
            <div className="font-bold uppercase tracking-tight text-sm">{defaultFacility.name}</div>
            <div>Khoa/Phòng: {order.department || 'Khoa Điều Trị Nội Trú'} {order.roomBed ? `· ${order.roomBed}` : ''}</div>
            <div>Địa chỉ: {defaultFacility.address}</div>
            <div>Điện thoại: {defaultFacility.phone}</div>
          </div>
          <div className="text-right space-y-0.5 font-mono">
            <div className="text-xs font-bold">MÃ ĐƠN: {order.id}</div>
            <div className="text-2xs text-slate-700">
              {order.status === 'signed' && order.digitalSignature ? '✓ ĐÃ KÝ SỐ ĐIỆN TỬ' : 'BẢN NHÁP - CHƯA KÝ'}
            </div>
            {order.isChronicDisease && (
              <div className="text-2xs font-semibold uppercase">[Kê đơn mạn tính 90 ngày - PL VII]</div>
            )}
          </div>
        </div>

        {/* Tiêu đề Đơn thuốc chuẩn Thông tư 26/2025/TT-BYT */}
        <div className="mt-3 text-center">
          <h1 className="text-xl font-bold uppercase tracking-wide m-0">{meta.title}</h1>
          <div className="text-2xs italic text-slate-700 mt-0.5">
            ({meta.appendix} ban hành kèm theo Thông tư số 26/2025/TT-BYT ngày 31/12/2024 của Bộ trưởng Bộ Y tế)
          </div>
        </div>
      </header>

      {/* 2. Thông tin hành chính Người bệnh (Chuẩn Điều 6 & Phụ lục TT26) */}
      <section className="text-xs space-y-1 my-3 text-left leading-relaxed">
        <div className="grid grid-cols-12 gap-2">
          <div className="col-span-8">
            <b>Họ tên người bệnh:</b> <span className="uppercase font-bold text-sm">{order.patientName}</span>
          </div>
          <div className="col-span-4">
            <b>Mã người bệnh:</b> <span className="font-mono">{order.patientId}</span>
          </div>
        </div>

        <div>
          <b>Số định danh cá nhân/số CCCD/hộ chiếu (nếu có):</b>{' '}
          <span className="font-mono font-semibold">{order.patientCccd || '—'}</span>
        </div>

        <div className="grid grid-cols-12 gap-2">
          <div className="col-span-4">
            <b>Ngày sinh:</b> {order.patientDob || '—'}
          </div>
          <div className="col-span-5">
            <b>Cân nặng (bắt buộc với trẻ &lt; 72 tháng):</b> {order.patientWeight ? `${order.patientWeight} kg` : '—'}
          </div>
          <div className="col-span-3">
            <b>Giới tính:</b> {order.patientGender || '—'}
          </div>
        </div>

        <div>
          <b>Mã số bảo hiểm y tế (nếu có):</b> <span className="font-mono">{order.patientInsuranceId || '—'}</span>
        </div>

        <div>
          <b>Nơi thường trú / nơi tạm trú / nơi ở hiện tại:</b> {order.patientAddress || 'Theo hồ sơ bệnh án cơ sở KBCB'}
        </div>

        <div>
          <b>Chẩn đoán:</b>{' '}
          <span className="font-semibold">
            {order.diagnosisIcd10 ? `[${order.diagnosisIcd10}] ` : ''}
            {order.diagnosisText}
          </span>
        </div>

        {/* Chuyên biệt cho Đơn thuốc "N" (Phụ lục II): Các đợt điều trị */}
        {isNarcoticForm && (
          <div className="border border-black p-2 my-1.5 space-y-0.5 bg-slate-50/50">
            <div className="font-bold uppercase text-2xs">Phân bổ các đợt điều trị (Thông tư 26/2025/TT-BYT):</div>
            <div className="grid grid-cols-3 gap-2 text-2xs">
              <div><b>Đợt 1:</b> {order.treatmentBatch1 || 'Từ ngày kê đơn đến hết 10 ngày'}</div>
              <div><b>Đợt 2:</b> {order.treatmentBatch2 || 'Đợt kế tiếp (trước 1-3 ngày)'}</div>
              <div><b>Đợt 3:</b> {order.treatmentBatch3 || 'Đợt kế tiếp (trước 1-3 ngày)'}</div>
            </div>
          </div>
        )}
      </section>

      {/* 3. Danh mục thuốc điều trị (Có số TT, Tên INN + Biệt dược, liều, cách dùng) */}
      <section className="my-3 text-left">
        <div className="font-bold text-xs uppercase mb-1.5 border-b border-slate-400 pb-0.5">Thuốc điều trị:</div>
        <ol className="list-decimal pl-5 text-xs space-y-2 leading-relaxed">
          {order.items.map((item, index) => (
            <li key={item.id || index} className="pl-1">
              <div className="flex justify-between items-baseline">
                <span className="font-bold">
                  {item.medicationName}
                  {item.activeIngredient ? ` (${item.activeIngredient})` : ''}
                </span>
                <span className="font-bold text-xs shrink-0 ml-2 font-mono">
                  Số lượng: {formatPrescriptionQuantity(item.quantity, item.isNarcotic || isNarcoticForm)} {item.unit || ''}
                </span>
              </div>
              <div className="text-2xs text-slate-800 space-y-0.5 mt-0.5">
                <div>- Liều dùng: {item.dosage || 'Theo chỉ định'} · Số lần/khoảng cách: {item.frequency || 'Trong ngày'}</div>
                <div>- Đường dùng: {item.route || 'Uống'} · Cách dùng / thời điểm: {item.instructions || 'Uống sau bữa ăn'}</div>
                {item.durationDays && <div>- Thời gian dùng: {item.durationDays} ngày</div>}
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* 4. Lời dặn của Bác sĩ / Y sĩ khám bệnh */}
      <section className="my-2.5 text-xs text-left border-t border-slate-300 pt-1.5">
        <b>Lời dặn:</b>{' '}
        <span>
          {order.clinicalNotes ||
            'Thực hiện chế độ dinh dưỡng, nghỉ ngơi hợp lý. Tuân thủ đúng thời gian và liều lượng thuốc. Tái khám ngay khi có diễn biến bất thường.'}
        </span>
      </section>

      {/* 5. Chân trang & Chữ ký chuẩn TT 26/2025/TT-BYT */}
      <footer className="mt-4 pt-2 border-t border-black text-xs text-left">
        <div className="grid grid-cols-12 gap-3 items-start">
          {/* Cột trái: Ghi chú bắt buộc TT26 & Người nhận thuốc cho đơn N/H */}
          <div className="col-span-7 space-y-1 text-2xs leading-relaxed">
            <div>- Khám bệnh lại xin mang theo đơn này.</div>
            <div>- Số điện thoại liên hệ: <b>{order.patientPhone || defaultFacility.phone}</b></div>
            <div>- Họ và tên người đưa trẻ đến khám (đối với trẻ &lt; 72 tháng): {order.guardianName || '—'}</div>
            {(isNarcoticForm || isPsychotropicForm) && (
              <div className="border-t border-dashed border-slate-400 pt-1 mt-1">
                <b>Số định danh cá nhân/số CCCD/hộ chiếu người nhận thuốc (Đơn {meta.code}):</b>
                <div className="font-mono mt-0.5">{order.receiverCccd || order.patientCccd || '...................................................'}</div>
              </div>
            )}
          </div>

          {/* Cột phải: Chữ ký bác sĩ khám bệnh */}
          <div className="col-span-5 text-center">
            <div className="text-2xs italic">
              Ngày {order.prescribedAt ? order.prescribedAt.slice(0, 10) : '..... tháng ..... năm 20.....'}
            </div>
            <div className="font-bold text-xs uppercase mt-0.5">Bác sỹ / Y sỹ khám bệnh</div>
            <div className="text-2xs italic text-slate-600">(Ký, ghi rõ họ tên)</div>
            <div className="min-h-14 flex items-center justify-center py-2">
              {order.status === 'signed' && order.digitalSignature ? (
                <div className="border border-emerald-600 bg-emerald-50 text-emerald-900 px-2 py-1 text-3xs font-mono rounded">
                  ✓ KÝ SỐ TT 26 BỞI: {order.doctorName}
                </div>
              ) : (
                <div className="text-3xs text-slate-400 italic font-mono">[Chữ ký chuyên môn]</div>
              )}
            </div>
            <div className="font-bold text-xs">{order.doctorName || 'BS. Trần Văn Hùng'}</div>
            {order.doctorCertificate && (
              <div className="text-3xs text-slate-600 font-mono">CCHN: {order.doctorCertificate}</div>
            )}
          </div>
        </div>
      </footer>
    </article>
  );
};
