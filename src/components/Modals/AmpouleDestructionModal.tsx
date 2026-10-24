/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, ShieldAlert, CheckCircle2, FileSignature, AlertOctagon, Printer } from 'lucide-react';
import { DebtRecord } from '../../types/clinical';
import { clinicalAudio } from '../../utils/audio';
import { PrintableFormType } from './PrintableFormModal';

interface AmpouleDestructionModalProps {
  isOpen: boolean;
  onClose: () => void;
  returnedAmpoules: DebtRecord[];
  onDestroyConfirm: (ids: string[]) => void;
  onOpenPrintForm?: (formType: PrintableFormType) => void;
  isAudioMuted: boolean;
}

export const AmpouleDestructionModal: React.FC<AmpouleDestructionModalProps> = ({
  isOpen,
  onClose,
  returnedAmpoules,
  onDestroyConfirm,
  onOpenPrintForm,
  isAudioMuted,
}) => {
  const [method, setMethod] = useState('Nghiền nát thủy tinh thành bột vô hại');
  const [isSigned, setIsSigned] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!isAudioMuted) clinicalAudio.playSuccessChime();
    setIsSigned(true);
    setTimeout(() => {
      onDestroyConfirm(returnedAmpoules.map(a => a.id));
      onClose();
    }, 700);
  };

  const todayStr = new Date().toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="min-h-14 py-3 px-3.5 sm:px-5 bg-slate-900 text-white flex items-center justify-between shrink-0 gap-2">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-md bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30 shrink-0">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-base font-bold truncate">Tiêu Hủy Vỏ Ống Gây Nghiện</h2>
              <span className="text-[11px] text-slate-400 font-mono truncate block">
                Mẫu 16 · Thông tư 20/2017/TT-BYT
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer shrink-0"
            title="Đóng modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-3 sm:p-5 overflow-y-auto space-y-3.5 text-xs text-slate-700 flex-1">
          {/* Legal Notice */}
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/90 text-amber-900 text-xs flex items-start gap-2.5">
            <AlertOctagon className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="leading-relaxed text-[11.5px]">
              <strong>Quy định pháp lý bắt buộc:</strong> Vỏ ống thuốc gây nghiện (Morphin, Fentanyl) sau khi tiêm cho bệnh nhân phải được thu hồi 100% vào khay niêm phong. Hội đồng tiêu hủy phải gồm ít nhất 03 thành viên độc lập, lập biên bản và lưu hồ sơ tối thiểu <strong>02 năm</strong>.
            </div>
          </div>

          {/* Council Members - Responsive Layout */}
          <div className="bg-slate-50/90 p-2.5 sm:p-3.5 rounded-xl border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 block text-xs uppercase tracking-wider text-slate-500">
                Thành phần Hội đồng 3 bên bắt buộc:
              </span>
              <span className="text-[10px] bg-slate-200/80 text-slate-700 px-1.5 py-0.2 rounded font-mono font-medium">
                03 Thành viên
              </span>
            </div>

            {/* Mobile View: Compact Avatar Badges */}
            <div className="sm:hidden grid grid-cols-1 gap-1.5 text-xs">
              <div className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200 shadow-2xs">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-teal-100 text-teal-800 font-bold flex items-center justify-center text-[10px]">DS</span>
                  <div>
                    <strong className="text-slate-800 block text-xs leading-none">DS. Nguyễn Bích Ngọc</strong>
                    <span className="text-[10px] text-slate-500">Trưởng Khoa Dược</span>
                  </div>
                </div>
                <span className="text-[10px] font-semibold bg-teal-50 text-teal-700 px-2 py-0.5 rounded border border-teal-200">
                  Chủ tịch HĐ
                </span>
              </div>

              <div className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200 shadow-2xs">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 font-bold flex items-center justify-center text-[10px]">ĐD</span>
                  <div>
                    <strong className="text-slate-800 block text-xs leading-none">ĐD. Lê Thị Thu</strong>
                    <span className="text-[10px] text-slate-500">Điều dưỡng Trưởng ca</span>
                  </div>
                </div>
                <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
                  Ủy viên giám sát
                </span>
              </div>

              <div className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200 shadow-2xs">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-800 font-bold flex items-center justify-center text-[10px]">BS</span>
                  <div>
                    <strong className="text-slate-800 block text-xs leading-none">BS. Trần Văn Hùng</strong>
                    <span className="text-[10px] text-slate-500">Bác sĩ Điều trị ICU</span>
                  </div>
                </div>
                <span className="text-[10px] font-semibold bg-purple-50 text-purple-700 px-2 py-0.5 rounded border border-purple-200">
                  Ủy viên chuyên môn
                </span>
              </div>
            </div>

            {/* Desktop View: 3 Columns Grid */}
            <div className="hidden sm:grid sm:grid-cols-3 gap-2.5 text-xs sm:text-sm">
              <div className="p-2.5 bg-white rounded-lg border border-slate-200 shadow-2xs">
                <span className="text-xs text-slate-400 block">Chủ tịch Hội đồng</span>
                <strong className="text-slate-800 block text-sm">DS. Nguyễn Bích Ngọc</strong>
                <span className="text-xs text-slate-500 block">Trưởng Khoa Dược</span>
              </div>
              <div className="p-2.5 bg-white rounded-lg border border-slate-200 shadow-2xs">
                <span className="text-xs text-slate-400 block">Ủy viên giám sát</span>
                <strong className="text-slate-800 block text-sm">ĐD. Lê Thị Thu</strong>
                <span className="text-xs text-slate-500 block">Điều dưỡng Trưởng ca</span>
              </div>
              <div className="p-2.5 bg-white rounded-lg border border-slate-200 shadow-2xs">
                <span className="text-xs text-slate-400 block">Ủy viên chuyên môn</span>
                <strong className="text-slate-800 block text-sm">BS. Trần Văn Hùng</strong>
                <span className="text-xs text-slate-500 block">Bác sĩ Điều trị ICU</span>
              </div>
            </div>
          </div>

          {/* Ampoule List Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 block text-xs uppercase tracking-wider text-slate-500">
                Danh mục vỏ ống tiêu hủy ({returnedAmpoules.length} vỏ đã thu hồi):
              </span>
              <span className="text-[10px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                Kiểm soát 1:1
              </span>
            </div>

            {/* Mobile View: Clean Card List */}
            <div className="sm:hidden space-y-2">
              {returnedAmpoules.length > 0 ? (
                returnedAmpoules.map((item) => (
                  <div key={item.id} className="p-2.5 bg-white rounded-xl border border-slate-200/90 shadow-2xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-slate-800 text-xs bg-slate-100 px-2 py-0.5 rounded">
                        {item.code}
                      </span>
                      <span className="font-mono text-slate-500 text-[11px]">
                        🕒 {item.borrowTime}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <strong className="text-slate-900 font-bold text-xs block">{item.itemName}</strong>
                        <span className="text-[11px] text-slate-600 block mt-0.5">
                          BN: <strong>{item.patientName}</strong> ({item.patientRoom})
                        </span>
                      </div>
                      <span className="shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        ✓ Khay khóa
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-slate-500">
                  <p className="font-medium text-xs">Chưa có vỏ ống nào trong khay niêm phong.</p>
                  <p className="text-[11px] text-slate-400">Vui lòng bấm "Thu hồi vỏ nộp khay" ở sổ nợ trước khi tiêu hủy.</p>
                </div>
              )}
            </div>

            {/* Desktop View: Full Table */}
            <div className="hidden sm:block border border-slate-200 rounded-xl overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm min-w-[500px]">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 border-b border-slate-200 font-semibold text-xs">
                    <th className="py-2.5 px-3.5">Mã phiếu</th>
                    <th className="py-2.5 px-3">Mặt hàng thuốc</th>
                    <th className="py-2.5 px-3">Bệnh nhân sử dụng</th>
                    <th className="py-2.5 px-3">Thời gian tiêm</th>
                    <th className="py-2.5 px-3.5 text-right">Tình trạng</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {returnedAmpoules.length > 0 ? (
                    returnedAmpoules.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50 transition">
                        <td className="py-2.5 px-3.5 font-mono font-bold text-slate-800">{item.code}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{item.itemName}</td>
                        <td className="py-2.5 px-3 text-slate-700">{item.patientName} ({item.patientRoom})</td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">{item.borrowTime}</td>
                        <td className="py-2.5 px-3.5 text-right">
                          <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            Đã thu hồi khay khóa
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-slate-400">
                        Hiện chưa có vỏ ống nào được đánh dấu thu hồi vào khay khóa.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Destruction Method */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-900 block text-xs sm:text-sm">
              Phương pháp tiêu hủy thực hiện:
            </label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="w-full py-2 px-3 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl text-slate-800 focus:outline-hidden focus:border-rose-600 font-medium"
            >
              <option value="Đập vỡ nát cơ học trong khay inox, ngâm Chloramin B 0.5% & đóng bao rác nguy hại (TT 20/2021/TT-BYT)">
                Đập vỡ nát cơ học trong khay inox, ngâm Chloramin B 0.5% &amp; đóng bao rác nguy hại (TT 20/2021)
              </option>
              <option value="Hủy bằng lò đốt rác thải y tế nhiệt độ cao >1100°C">
                Đốt tiêu hủy lò đốt rác thải y tế chuyên dụng nhiệt độ cao &gt; 1100°C
              </option>
            </select>
          </div>
        </div>

        {/* Footer - Responsive Action Controls */}
        <div className="p-3 sm:px-5 sm:py-3.5 bg-slate-50 border-t border-slate-200 shrink-0">
          {/* Mobile Footer */}
          <div className="sm:hidden space-y-2">
            <div className="text-[11px] text-slate-500 font-mono text-center">
              Biên bản số: 16/BB-HĐH/{new Date().getFullYear()} · Ngày: {todayStr}
            </div>
            <button
              onClick={handleConfirm}
              disabled={returnedAmpoules.length === 0 || isSigned}
              className="w-full h-11 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold transition shadow-xs flex items-center justify-center gap-2 cursor-pointer active:scale-98"
            >
              {isSigned ? (
                <>
                  <CheckCircle2 className="w-4 h-4 animate-spin" />
                  <span>Đang ghi biên bản số...</span>
                </>
              ) : (
                <>
                  <FileSignature className="w-4 h-4" />
                  <span>Ký Biên Bản Tiêu Hủy (Hội Đồng 3 Bên)</span>
                </>
              )}
            </button>
            <div className="flex items-center gap-2">
              {onOpenPrintForm && (
                <button
                  type="button"
                  onClick={() => onOpenPrintForm('TT20_AMPOULE_DESTRUCTION')}
                  className="flex-1 h-9 px-3 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                  title="Xem & in biên bản A4 chuẩn"
                >
                  <Printer className="w-3.5 h-3.5 text-teal-700" />
                  <span>Xem bản in A4</span>
                </button>
              )}
              <button
                onClick={onClose}
                className="flex-1 h-9 px-3 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>

          {/* Desktop Footer */}
          <div className="hidden sm:flex items-center justify-between">
            <div className="text-xs text-slate-500 font-mono">
              Biên bản số: 16/BB-HĐH/{new Date().getFullYear()} · Ngày: {todayStr}
            </div>
            <div className="flex items-center gap-2">
              {onOpenPrintForm && (
                <button
                  type="button"
                  onClick={() => onOpenPrintForm('TT20_AMPOULE_DESTRUCTION')}
                  className="h-9 px-3.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  title="Xem & in biên bản A4 chuẩn theo Mẫu 16 Phụ lục II NĐ 54/2017"
                >
                  <Printer className="w-3.5 h-3.5 text-teal-700" />
                  <span>Xem bản in A4</span>
                </button>
              )}
              <button
                onClick={onClose}
                className="h-9 px-4 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleConfirm}
                disabled={returnedAmpoules.length === 0 || isSigned}
                className="h-9 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold transition shadow-2xs flex items-center gap-1.5 cursor-pointer active:scale-98"
              >
                {isSigned ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 animate-spin" />
                    <span>Đang ghi biên bản số...</span>
                  </>
                ) : (
                  <>
                    <FileSignature className="w-4 h-4" />
                    <span>Ký Biên Bản Tiêu Hủy (Hội Đồng 3 Bên)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
