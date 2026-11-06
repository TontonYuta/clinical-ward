/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Phiếu Theo Dõi Thực Hiện Y Lệnh Thuốc Của Điều Dưỡng (Nursing MAR - Medication Administration Record)
 * Tuân thủ Thông tư 23/2011/TT-BYT & Thông tư 07/2011/TT-BYT (Quy chế sử dụng thuốc trong cơ sở có giường bệnh nội trú)
 */

import { ClinicalNote } from '../../../ui/ClinicalNote';
import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  UserCheck,
  ShieldCheck,
  FileCheck,
  Stethoscope,
} from 'lucide-react';
import {
  PrescriptionOrder,
  NursingMarSlot,
  NursingMedicationAdministration,
} from '../../../../types/cpoe';

interface NursingMarViewProps {
  order: PrescriptionOrder;
  currentNurseName?: string;
}

export const NursingMarView: React.FC<NursingMarViewProps> = ({
  order,
  currentNurseName = 'ĐD. Hoàng Thị Lan',
}) => {
  const safeItems = Array.isArray(order.items) ? order.items : [];

  // Khởi tạo trạng thái thực hiện y lệnh của từng thuốc theo 4 cữ trong ngày
  const [administrations, setAdministrations] = useState<NursingMedicationAdministration[]>(() => {
    return safeItems.map((it, idx) => ({
      orderItemId: it.id || `mar-${idx}`,
      medicationName: it.medicationName,
      dosage: it.dosage || 'Chưa ghi nhận',
      route: it.route || 'Chưa ghi nhận',
      slots: [
        { slotId: 'morning', slotLabel: 'Sáng (08:00)', scheduledTime: '08:00', status: 'pending' },
        { slotId: 'noon', slotLabel: 'Trưa (12:00)', scheduledTime: '12:00', status: 'pending' },
        {
          slotId: 'afternoon',
          slotLabel: 'Chiều (16:00)',
          scheduledTime: '16:00',
          status: 'pending',
        },
        { slotId: 'evening', slotLabel: 'Tối (20:00)', scheduledTime: '20:00', status: 'pending' },
      ],
    }));
  });

  const handleToggleSlot = (itemIdx: number, slotIdx: number) => {
    setAdministrations((prev) => {
      const next = [...prev];
      const targetItem = { ...next[itemIdx] };
      const targetSlots = [...targetItem.slots];
      const currentSlot = targetSlots[slotIdx];

      if (currentSlot.status === 'pending') {
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        targetSlots[slotIdx] = {
          ...currentSlot,
          status: 'completed',
          administeredBy: currentNurseName,
          administeredAt: timeStr,
          notes: `Đã thực hiện y lệnh bởi ${currentNurseName}`,
        };
      } else if (currentSlot.status === 'completed') {
        targetSlots[slotIdx] = {
          ...currentSlot,
          status: 'skipped',
          administeredBy: currentNurseName,
          notes: 'Hoãn y lệnh: BN đi làm chẩn đoán hình ảnh (báo bác sĩ)',
        };
      } else {
        targetSlots[slotIdx] = {
          ...currentSlot,
          status: 'pending',
          administeredBy: undefined,
          administeredAt: undefined,
          notes: 'Chờ thực hiện',
        };
      }

      targetItem.slots = targetSlots;
      next[itemIdx] = targetItem;
      return next;
    });
  };

  const totalDoses = administrations.reduce((acc, curr) => acc + curr.slots.length, 0);
  const completedDoses = administrations.reduce(
    (acc, curr) => acc + curr.slots.filter((s) => s.status === 'completed').length,
    0,
  );
  const progressPercent = totalDoses > 0 ? Math.round((completedDoses / totalDoses) * 100) : 0;

  return (
    <div className="p-4 sm:p-6 space-y-5 bg-white text-slate-900">
      <ClinicalNote severity="info" title="Phiếu mô phỏng">
        Các cữ giờ là khung minh họa. Thao tác chỉ lưu trong phiên, chưa đồng bộ hồ sơ thực hiện
        thuốc.
      </ClinicalNote>
      {/* Banner phân hệ điều dưỡng nội trú */}
      <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-emerald-700" />
            <h3 className="text-sm font-bold text-emerald-950 uppercase tracking-wide">
              Tiến độ dùng thuốc
            </h3>
            <span className="text-3xs font-mono font-bold bg-emerald-200/70 text-emerald-900 px-2 py-0.5 rounded">
              TT 23/2011/TT-BYT &amp; TT 07/2011/TT-BYT
            </span>
          </div>
          <p className="text-xs text-emerald-900 leading-relaxed">
            Áp dụng cho <b>Người bệnh nội trú</b> tại {order.department || 'Khoa Điều Trị Nội Trú'}.
            Bác sĩ ra y lệnh điều trị hàng ngày, Điều dưỡng trực tiếp đối chiếu 5 đúng (Đúng người
            bệnh, Đúng thuốc, Đúng liều, Đúng đường dùng, Đúng thời gian) và ký xác nhận theo giờ.
          </p>
        </div>

        <div className="bg-white px-3.5 py-2 rounded-lg border border-emerald-300 shadow-2xs shrink-0 text-right">
          <div className="text-2xs text-slate-500">Tiến độ thực hiện y lệnh trong ngày:</div>
          <div className="text-base font-bold text-emerald-900 font-mono">
            {completedDoses}/{totalDoses} cữ ({progressPercent}%)
          </div>
        </div>
      </div>

      {/* Thông tin xác nhận y lệnh Bác sĩ & Điều dưỡng phụ trách ca trực */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50 p-3.5 rounded-lg border border-slate-200">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-slate-900">
            <Stethoscope className="w-3.5 h-3.5 text-teal-700" />
            <span>Bác sĩ điều trị ra y lệnh:</span>
          </div>
          <div className="text-slate-800 font-semibold pl-5">
            {order.doctorName || 'BS. Trần Văn Hùng'}
            {order.doctorCertificate && (
              <span className="font-mono text-slate-500 font-normal ml-1">
                (CCHN: {order.doctorCertificate})
              </span>
            )}
          </div>
          <div className="text-2xs text-slate-500 pl-5">
            Y lệnh ký số lúc: {order.prescribedAt || '07:30 ngày hôm nay'}
          </div>
        </div>

        <div className="space-y-1 sm:border-l sm:border-slate-200 sm:pl-4">
          <div className="flex items-center gap-1.5 font-bold text-slate-900">
            <UserCheck className="w-3.5 h-3.5 text-emerald-700" />
            <span>Điều dưỡng trực tiếp thực hiện:</span>
          </div>
          <div className="text-slate-800 font-semibold pl-5">
            {currentNurseName}{' '}
            <span className="font-mono text-2xs text-emerald-700 font-bold bg-emerald-100 px-1.5 py-0.5 rounded">
              Ca trực ngày
            </span>
          </div>
          <div className="text-2xs text-slate-500 pl-5">
            Khoa: {order.department || 'Khoa Nội'} · Phòng/Giường: {order.roomBed || 'P204 - G08'}
          </div>
        </div>
      </div>

      {/* Bảng công khai thuốc và theo dõi thực hiện cữ thuốc theo giờ */}
      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-200 flex justify-between items-center text-xs font-bold text-slate-800 uppercase">
          <span>
            Bảng Theo Dõi Thực Hiện Thuốc Theo Giờ (Click vào ô để đổi trạng thái thực hiện)
          </span>
          <span className="text-2xs font-normal text-slate-500 lowercase italic">
            Quy tắc 5 đúng Điều 9 Thông tư 23/2011/TT-BYT
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                <th className="p-3 w-1/4">Thuốc điều trị, Liều &amp; Đường dùng</th>
                <th className="p-3 text-center w-[18%]">Cữ Sáng (08:00)</th>
                <th className="p-3 text-center w-[18%]">Cữ Trưa (12:00)</th>
                <th className="p-3 text-center w-[18%]">Cữ Chiều (16:00)</th>
                <th className="p-3 text-center w-[18%]">Cữ Tối (20:00)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-800">
              {administrations.map((item, itemIdx) => (
                <tr key={item.orderItemId} className="hover:bg-slate-50/70 transition-colors">
                  <td className="p-3 align-top">
                    <div className="font-bold text-slate-900 text-xs sm:text-sm">
                      {item.medicationName}
                    </div>
                    <div className="text-2xs text-slate-600 mt-0.5">
                      Liều: <span className="font-semibold">{item.dosage}</span> · Đường:{' '}
                      <span className="font-semibold">{item.route}</span>
                    </div>
                  </td>

                  {item.slots.map((slot, slotIdx) => {
                    const isCompleted = slot.status === 'completed';
                    const isSkipped = slot.status === 'skipped';
                    const isPending = slot.status === 'pending';

                    return (
                      <td
                        key={slot.slotId}
                        className="p-2.5 align-top text-center border-l border-slate-100"
                      >
                        <button
                          type="button"
                          onClick={() => handleToggleSlot(itemIdx, slotIdx)}
                          title="Bấm để chuyển trạng thái: Đã thực hiện -> Hoãn y lệnh -> Chờ"
                          className={`w-full p-2 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between min-h-[72px] ${
                            isCompleted
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-950 hover:bg-emerald-100/70'
                              : isSkipped
                                ? 'bg-rose-50 border-rose-300 text-rose-950 hover:bg-rose-100/70'
                                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50 border-dashed'
                          }`}
                        >
                          <div className="flex items-center justify-between text-2xs font-bold">
                            <span className="font-mono">{slot.scheduledTime}</span>
                            {isCompleted && (
                              <span className="flex items-center gap-0.5 text-emerald-700">
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                <span>Đã dùng</span>
                              </span>
                            )}
                            {isSkipped && (
                              <span className="flex items-center gap-0.5 text-rose-700">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                <span>Hoãn</span>
                              </span>
                            )}
                            {isPending && (
                              <span className="flex items-center gap-0.5 text-slate-400">
                                <Clock className="w-3.5 h-3.5 shrink-0" />
                                <span>Chờ</span>
                              </span>
                            )}
                          </div>

                          <div className="text-3xs text-slate-600 mt-1 line-clamp-2">
                            {slot.notes}
                          </div>

                          {slot.administeredBy && (
                            <div className="text-3xs font-semibold text-slate-800 mt-1 border-t border-slate-200/60 pt-0.5 flex justify-between">
                              <span className="truncate">{slot.administeredBy}</span>
                              <span className="font-mono text-slate-500">
                                {slot.administeredAt}
                              </span>
                            </div>
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Chú giải và Quy định pháp lý bắt buộc */}
      <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-2xs text-slate-600 space-y-1 leading-relaxed">
        <div className="font-bold text-slate-800 uppercase flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-teal-700" />
          <span>Quy chế Pháp lý Điều dưỡng thực hiện thuốc nội trú:</span>
        </div>
        <div>
          1. <b>Thông tư 23/2011/TT-BYT (Điều 9, 10):</b> Điều dưỡng thực hiện thuốc phải đối chiếu
          5 đúng; sau khi người bệnh dùng thuốc xong phải ký tên và ghi rõ thời điểm thực hiện vào
          Phiếu theo dõi thực hiện y lệnh.
        </div>
        <div>
          2. <b>Thông tư 07/2011/TT-BYT (Điều 6):</b> Nghiêm cấm Điều dưỡng tự ý thay đổi thuốc, tự
          ý tăng giảm liều hoặc tự ngưng y lệnh khi chưa có chỉ định của Bác sĩ điều trị.
        </div>
      </div>
    </div>
  );
};
