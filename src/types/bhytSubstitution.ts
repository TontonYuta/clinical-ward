/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * TypeScript definitions for Smart Drug Substitution (Gợi ý thuốc thay thế BHYT 1-Click)
 * Căn cứ: Thông tư 20/2022/TT-BYT, Quyết định 3618/QĐ-BHXH, Hệ thống phân loại ATC (WHO)
 */

import { BhytPrescriptionItem, BhytViolationItem, HospitalRank } from './bhyt';

export interface DrugSubstituteCandidate {
  id: string;
  drugName: string;                     // Biệt dược generic đại diện
  activeIngredient: string;             // Tên hoạt chất INN
  atcCode: string;                      // Mã phân loại ATC (WHO)
  atcGroupName: string;                 // Tên nhóm dược lý
  dosage: string;                       // Hàm lượng đề xuất
  route: string;                        // Đường dùng
  unitPrice: number;                    // Đơn giá tham chiếu (VND)
  paymentRatio: number;                 // Tỷ lệ thanh toán BHYT (1.0 = 100%)
  allowedRanks: HospitalRank[];         // Hạng bệnh viện được phép sử dụng
  requiresConsultation: boolean;        // Có yêu cầu biên bản hội chẩn không
  substitutionReason: string;           // Lý do dược lý đề xuất
  clinicalRationale: string;            // Căn cứ lâm sàng & tương đương điều trị
  savedRejectionVnd: number;            // Số tiền xuất toán được cứu (VND)
  legalRef: string;                     // Căn cứ văn bản pháp lý (TT 20/2022/TT-BYT)
  score: number;                        // Điểm số tương thích thuật toán
}

export interface DrugSubstitutionTarget {
  itemIndex: number;
  item: BhytPrescriptionItem;
  violation: BhytViolationItem;
  candidates: DrugSubstituteCandidate[];
}
