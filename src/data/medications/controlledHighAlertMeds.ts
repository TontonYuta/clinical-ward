/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Thuốc Kiểm Soát Đặc Biệt & Nguy Cơ Cao - CSDL 55.000 Thuốc Cục QLD (<=200 LOC)
 */

import { MasterMedication } from '../../types/medication';

export const CONTROLLED_HIGH_ALERT_MASTER_MEDICATIONS: MasterMedication[] = [
  {
    id: 'b-3',
    nationalCode: '893111093823',
    brandName: 'Morphin (Morphin hydroclorid 10mg/ml)',
    tallManName: 'Morphin hydroclorid',
    activeIngredient: 'Morphin hydroclorid',
    concentration: '10mg/1ml',
    dosageForm: 'Dung dịch tiêm',
    route: 'Tiêm dưới da / Tiêm bắp / Tiêm tĩnh mạch chậm',
    standardUnit: 'Ống',
    defaultDoseQty: 1,
    group: 'Thuốc gây nghiện',
    atcCode: 'N02AA01',
    isControlled: true,
    isHighAlert: true,
    isCrashCart: true,
    wardStockCount: 35,
    hospitalStockCount: 400,
    searchAliases: ['mor', 'morphin', 'morphine', '893111093823'],
    note: 'Bắt buộc thu hồi vỏ ống rỗng, ký sổ theo dõi TT 20/2017/TT-BYT (SĐK: 893111093823)',
  },
  {
    id: 'b-9',
    nationalCode: 'VN-22499-20',
    brandName: 'Fentanyl 50 micrograms/ml',
    tallManName: 'FentanYL',
    activeIngredient: 'Fentanyl',
    concentration: '0.1mg/2ml',
    dosageForm: 'Dung dịch tiêm',
    route: 'Tiêm tĩnh mạch',
    standardUnit: 'Ống',
    defaultDoseQty: 1,
    group: 'Thuốc gây nghiện',
    atcCode: 'N01AH01',
    isControlled: true,
    isHighAlert: true,
    isCrashCart: true,
    wardStockCount: 15,
    hospitalStockCount: 120,
    searchAliases: ['b-9', 'fen', 'fenta', 'fentanyl', 'VN-22499-20'],
    note: 'Giảm đau mạnh trong phẫu thuật/hồi sức, bắt buộc thu hồi vỏ ống (SĐK: VN-22499-20)',
  },
  {
    id: 'b-5',
    nationalCode: '893110375223',
    brandName: 'Kali clorid 10%',
    tallManName: 'KALI CLORID 10% (High-Alert)',
    activeIngredient: 'Kali clorid',
    concentration: '1g/10 ml',
    dosageForm: 'Dung dịch tiêm truyền',
    route: 'Pha truyền tĩnh mạch',
    standardUnit: 'Ống',
    defaultDoseQty: 2,
    group: 'Thuốc nguy cơ cao',
    atcCode: 'A12BA01',
    isControlled: false,
    isHighAlert: true,
    isCrashCart: true,
    wardStockCount: 25,
    hospitalStockCount: 200,
    searchAliases: ['kcl', 'kali', 'ha kali mau', '893110375223'],
    note: 'Cực kỳ nguy hiểm: TUYỆT ĐỐI KHÔNG tiêm tĩnh mạch trực tiếp (SĐK: 893110375223)',
  },
];

/* =========================================================================
 * [DEPRECATED MOCK DATA - ĐÃ COMMENT LẠI THEO YÊU CẦU CHUẨN HÓA 55K THUỐC]
 * Các dữ liệu mẫu cũ dùng mã nội bộ 40.01x không thuộc CSDL Cục QLD:
 * - Pethidin hydroclorid 100mg/2ml (Mã cũ: 40.013)
 * - Naloxon hydroclorid 0.4mg/1ml (Mã cũ: 40.014)
 * - Kali clorid 10% 10ml (Mã cũ: 40.015 - Đã thay bằng b-5 SĐK: 893110375223)
 * - Natri clorid 10% 10ml (Mã cũ: 40.016)
 * - Heparin 25.000 IU/5ml (Mã cũ: 40.017)
 * - Actrapid HM 100 IU/ml (Mã cũ: 40.018)
 * ========================================================================= */
