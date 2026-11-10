/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Modal Gợi Ý Thuốc Thay Thế Hợp Lệ BHYT 1-Click (Smart Drug Substitution)
 * Căn cứ: Thông tư 20/2022/TT-BYT & Quyết định 3618/QĐ-BHXH
 */

import React from 'react';
import {
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  X,
  FileCheck2,
  TrendingDown,
  DollarSign
} from 'lucide-react';
import { BhytPrescriptionItem, BhytViolationItem, HospitalRank } from '../../../types/bhyt';
import { DrugSubstituteCandidate } from '../../../types/bhytSubstitution';
import { HOSPITAL_RANK_LABELS } from '../../../data/bhytDrugRules';

interface BhytSubstitutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalItem: BhytPrescriptionItem | null;
  violation: BhytViolationItem | null;
  candidates: DrugSubstituteCandidate[];
  hospitalRank: HospitalRank;
  onApplySubstitute: (candidate: DrugSubstituteCandidate) => void;
}

export const BhytSubstitutionModal: React.FC<BhytSubstitutionModalProps> = ({
  isOpen,
  onClose,
  originalItem,
  violation,
  candidates,
  hospitalRank,
  onApplySubstitute
}) => {
  if (!isOpen || !originalItem || !violation) return null;

  return (
    <div
      onClick={onClose}
      data-testid="bhyt-substitution-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-4xl max-h-[92vh] rounded-xl shadow-2xl flex flex-col overflow-hidden border border-slate-300"
      >
        {/* HEADER MODAL */}
        <div className="px-5 py-3.5 bg-teal-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-md bg-teal-700 flex items-center justify-center text-teal-100 shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-base leading-tight truncate flex items-center gap-2">
                <span>Gợi ý thuốc thay thế BHYT</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-teal-700 text-teal-100 font-medium border border-teal-600">
                  1-Click
                </span>
              </h3>
              <p className="text-xs text-teal-200 truncate mt-0.5">
                Căn cứ Thông tư 20/2022/TT-BYT &amp; Quyết định 3618/QĐ-BHXH
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-md hover:bg-teal-700 text-teal-200 hover:text-white transition cursor-pointer flex items-center justify-center"
            title="Đóng (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* NỘI DUNG CUỘN ĐƯỢC */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50">
          
          {/* PHẦN 1: THÔNG TIN THUỐC ĐANG BỊ XUẤT TOÁN */}
          <div className="bg-rose-50/70 border border-rose-200 rounded-lg p-4 shadow-2xs">
            <div className="flex items-start justify-between gap-3 flex-wrap pb-2 border-b border-rose-200/80">
              <div className="flex items-center gap-2">
                <div>
                  <span className="text-xs font-bold text-rose-800 uppercase tracking-wider block">
                    Thuốc có nguy cơ xuất toán BHYT
                  </span>
                  <div className="text-base font-bold text-slate-950 mt-0.5 flex items-center gap-2">
                    <span>{originalItem.drugName}</span>
                    <span className="font-sans text-sm text-slate-600 font-normal">
                      ({originalItem.activeIngredient || originalItem.drugName})
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs text-rose-700 font-semibold uppercase block">Nguy cơ xuất toán</span>
                <span className="text-base font-bold text-rose-700 font-sans tabular-nums">
                  -{violation.rejectionRiskVnd.toLocaleString('vi-VN')} đ
                </span>
              </div>
            </div>

            <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs text-slate-700">
              <div className="bg-white p-2.5 rounded border border-rose-200/80">
                <strong className="text-slate-900 block font-semibold">Lý do vi phạm:</strong>
                <span className="text-rose-900 mt-0.5 block leading-snug">{violation.detail}</span>
              </div>

              <div className="bg-white p-2.5 rounded border border-rose-200/80">
                <strong className="text-slate-900 block font-semibold">Tuyến KCB:</strong>
                <span className="text-slate-800 mt-0.5 block font-medium">{HOSPITAL_RANK_LABELS[hospitalRank] || HOSPITAL_RANK_LABELS.HANG_I || 'Hạng I'}</span>
              </div>

              <div className="bg-white p-2.5 rounded border border-rose-200/80">
                <strong className="text-slate-900 block font-semibold">Căn cứ pháp lý:</strong>
                <span className="text-slate-800 mt-0.5 block font-medium">
                  {violation.legalRef?.docTitle || 'Thông tư 20/2022/TT-BYT'} ({violation.legalRef?.section || 'Quy định thanh toán'})
                </span>
              </div>
            </div>
          </div>

          {/* DẢI TIÊU ĐỀ HƯỚNG DẪN */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-700" />
              <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                Phương án thay thế tương đương
              </h4>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-sans tabular-nums">
              {candidates.length} phương án khả thi
            </span>
          </div>

          {/* PHẦN 2: DANH SÁCH ỨNG VIÊN THAY THẾ */}
          {candidates.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-lg border border-slate-200 space-y-2">
              <div className="text-base font-bold text-slate-800">
                Chưa tìm thấy thuốc thay thế tương đương tại {HOSPITAL_RANK_LABELS[hospitalRank] || HOSPITAL_RANK_LABELS.HANG_I || 'Hạng I'}
              </div>
              <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                Danh mục BHYT tuyến cơ sở hiện tại không có hoạt chất cùng nhóm. Khuyến nghị Bác sĩ điều trị xem xét chuyển tuyến KCB hoặc làm thủ tục hội chẩn chuyên khoa theo quy định.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {candidates.map((cand, idx) => (
                <div
                  key={cand.id || idx}
                  className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs hover:shadow-xs transition space-y-3"
                >
                  {/* Hàng trên: Huy hiệu thứ tự, Tỷ lệ BHYT & Số tiền BHYT cứu được */}
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-1 rounded-md text-xs font-bold uppercase bg-slate-100 text-slate-800 border border-slate-200 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-teal-700" />
                        <span>Phương án #{idx + 1}</span>
                      </span>

                      <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200 font-sans tabular-nums">
                        BHYT: {(cand.paymentRatio * 100).toFixed(0)}%
                      </span>

                      {!cand.requiresConsultation ? (
                        <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          Không cần hội chẩn
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                          Cần biên bản hội chẩn
                        </span>
                      )}

                      <span className="text-xs text-slate-500 font-sans tabular-nums">
                        Mã ATC: {cand.atcCode}
                      </span>
                    </div>

                    {/* Tiền BHYT cứu được */}
                    <div className="text-right">
                      <span className="text-xs text-slate-500 font-semibold uppercase block">
                        Chi phí bảo toàn
                      </span>
                      <span className="text-base font-bold text-teal-800 font-sans tabular-nums">
                        +{cand.savedRejectionVnd.toLocaleString('vi-VN')} đ
                      </span>
                    </div>
                  </div>

                  {/* Hàng giữa: Tên thuốc & Giải thích Dược lý Lâm sàng */}
                  <div className="space-y-1.5">
                    <div className="text-base font-bold text-slate-950 flex items-center gap-2">
                      <span>{cand.drugName}</span>
                      <span className="text-sm font-sans text-slate-600 font-medium">
                        ({cand.activeIngredient})
                      </span>
                    </div>

                    <p className="text-sm text-slate-800 leading-relaxed bg-slate-50/80 p-3 rounded-lg border border-slate-200/80">
                      <strong className="text-slate-900 font-semibold">Đánh giá dược lý: </strong>
                      <span>{cand.substitutionReason}</span>
                    </p>

                    <div className="text-xs text-slate-600 flex items-center justify-between gap-2 flex-wrap pt-0.5">
                      <span>
                        Tương đương lâm sàng: <em>{cand.clinicalRationale}</em>
                      </span>
                      <span className="text-teal-800 font-semibold font-sans">
                        Căn cứ: {cand.legalRef}
                      </span>
                    </div>
                  </div>

                  {/* Hàng dưới: Nút áp dụng 1-Click */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap">
                    <div className="text-xs text-slate-500">
                      Đơn giá tham chiếu DAV: <strong className="font-sans tabular-nums text-slate-800">{cand.unitPrice.toLocaleString('vi-VN')} đ</strong> / đơn vị
                    </div>

                    <button
                      type="button"
                      onClick={() => onApplySubstitute(cand)}
                      className="h-9 px-4 bg-teal-700 hover:bg-teal-800 text-white rounded-md text-sm font-bold shadow-xs transition cursor-pointer flex items-center gap-1.5"
                    >
                      <span>Áp dụng thay thế</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>

        {/* FOOTER ĐÓNG */}
        <div className="px-5 py-3 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500">
            Hệ thống hỗ trợ ra quyết định lâm sàng (CDSS) • Quyền quyết định cuối cùng thuộc Bác sĩ điều trị
          </span>

          <button
            type="button"
            onClick={onClose}
            className="h-8 px-4 border border-slate-300 rounded-md text-sm font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            Đóng
          </button>
        </div>

      </div>
    </div>
  );
};
