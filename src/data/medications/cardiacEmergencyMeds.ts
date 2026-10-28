/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Thuốc Cấp Cứu Tim Mạch, Vận Mạch & Loạn Nhịp - CSDL 55.000 Thuốc Cục QLD (<=200 LOC)
 */

import { MasterMedication } from '../../types/medication';

export const CARDIAC_EMERGENCY_MEDICATIONS: MasterMedication[] = [
  {
    id: 'b-4',
    nationalCode: '893110151100',
    brandName: 'Hadunalin 1 mg/ml',
    tallManName: 'EPINEPHrine (Adrenalin)',
    activeIngredient: 'Adrenalin',
    concentration: '1mg/1ml',
    dosageForm: 'Dung dịch thuốc tiêm',
    route: 'Tiêm bắp / Tiêm tĩnh mạch',
    standardUnit: 'Ống',
    defaultDoseQty: 2,
    group: 'Thuốc cấp cứu',
    atcCode: 'C01CA24',
    isControlled: false,
    isHighAlert: true,
    isCrashCart: true,
    isAnaphylaxisKit: true,
    wardStockCount: 30,
    hospitalStockCount: 450,
    searchAliases: ['adre', 'epi', 'adrenalin', 'hadunalin', '893110151100'],
    note: 'Thuốc đầu tay cấp cứu sốc phản vệ (TT 51/2017) & ngừng tim',
  },
  {
    id: 'b-6',
    nationalCode: '893110107400',
    brandName: 'Noradrenalin 4mg/4ml',
    tallManName: 'NorEPINEPHrine',
    activeIngredient: 'Norepinephrin',
    concentration: '1mg/ml (Ống 4ml/4mg)',
    dosageForm: 'Dung dịch đậm đặc pha tiêm truyền',
    route: 'Truyền tĩnh mạch qua bơm tiêm điện',
    standardUnit: 'Ống',
    defaultDoseQty: 2,
    group: 'Thuốc cấp cứu',
    atcCode: 'C01CA03',
    isControlled: false,
    isHighAlert: true,
    isCrashCart: true,
    wardStockCount: 20,
    hospitalStockCount: 320,
    searchAliases: ['nor', 'noradre', 'van mach', 'soc nhiem khuan', '893110107400'],
    note: 'Co mạch nâng huyết áp trong sốc nhiễm khuẩn (CSDL 55k Cục QLD)',
  },
  {
    id: 'med-atro-em',
    nationalCode: '893110360624',
    brandName: 'Atropin sulfat 0,25 mg/ml',
    tallManName: 'Atropin sulfat',
    activeIngredient: 'Atropin sulfat',
    concentration: '0.25mg/ml',
    dosageForm: 'Dung dịch tiêm',
    route: 'Tiêm bắp / Dưới da / Tĩnh mạch',
    standardUnit: 'Ống',
    defaultDoseQty: 4,
    group: 'Thuốc cấp cứu',
    atcCode: 'A03BA01',
    isControlled: false,
    isHighAlert: true,
    isCrashCart: true,
    wardStockCount: 40,
    hospitalStockCount: 500,
    searchAliases: ['atro', 'atropin', 'nhip cham', '893110360624'],
    note: 'Cấp cứu nhịp tim chậm xoang, ngộ độc phospho hữu cơ (SĐK: 893110360624)',
  },
  {
    id: 'b-17',
    nationalCode: '890110188526',
    brandName: 'Amiodarone Hydrochloride Tablets 200mg',
    tallManName: 'Amiodaron',
    activeIngredient: 'Amiodaron',
    concentration: '200mg',
    dosageForm: 'Viên nén',
    route: 'Đường uống',
    standardUnit: 'Viên',
    defaultDoseQty: 2,
    group: 'Thuốc cấp cứu',
    atcCode: 'C01BD01',
    isControlled: false,
    isHighAlert: true,
    isCrashCart: true,
    wardStockCount: 30,
    hospitalStockCount: 180,
    searchAliases: ['b-17', 'amio', 'amiodaron', 'loan nhip', '890110188526'],
    note: 'Thuốc chống loạn nhịp nhóm III (SĐK: 890110188526 Cục QLD)',
  },
];

/* =========================================================================
 * [DEPRECATED MOCK DATA - ĐÃ COMMENT LẠI THEO YÊU CẦU CHUẨN HÓA 55K THUỐC]
 * Các dữ liệu mẫu cũ dùng mã nội bộ 40.00x không thuộc CSDL Cục QLD:
 * - Dopamin Hasan 200mg/5ml (Mã cũ: 40.003)
 * - Dobutamin 250mg/20ml (Mã cũ: 40.004)
 * - Cordarone 150mg/3ml (Mã cũ: 40.006)
 * ========================================================================= */
