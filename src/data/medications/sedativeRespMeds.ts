/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Thuốc Hướng Thần & Hô Hấp Cấp Cứu - CSDL 55.000 Thuốc Cục QLD (<=200 LOC)
 */

import { MasterMedication } from '../../types/medication';

export const SEDATIVE_RESP_MEDICATIONS: MasterMedication[] = [
  {
    id: 'b-7',
    nationalCode: '890112769224',
    brandName: 'Diazepam Injection BP 10mg/2ml',
    tallManName: 'DiazePAM',
    activeIngredient: 'Diazepam',
    concentration: '10mg/2ml',
    dosageForm: 'Dung dịch tiêm',
    route: 'Tiêm tĩnh mạch chậm / Tiêm bắp',
    standardUnit: 'Ống',
    defaultDoseQty: 2,
    group: 'Thuốc hướng thần',
    atcCode: 'N05BA01',
    isControlled: true,
    isHighAlert: false,
    isCrashCart: true,
    wardStockCount: 20,
    hospitalStockCount: 280,
    searchAliases: ['dia', 'diazepam', 'seduxen', 'co giat', '890112769224'],
    note: 'Cắt cơn co giật, tiền mê, an thần cấp cứu TT 20/2017 (SĐK: 890112769224)',
  },
  {
    id: 'b-15',
    nationalCode: '893115477725',
    brandName: 'Salbutamol 2,5 mg/ 2,5 ml',
    tallManName: 'Salbutamol',
    activeIngredient: 'Salbutamol',
    concentration: '2.5mg/2.5ml',
    dosageForm: 'Dung dịch khí dung',
    route: 'Khí dung qua mặt nạ',
    standardUnit: 'Ống',
    defaultDoseQty: 2,
    group: 'Thuốc cấp cứu',
    atcCode: 'R03CC02',
    isControlled: false,
    isHighAlert: false,
    isCrashCart: true,
    wardStockCount: 30,
    hospitalStockCount: 400,
    searchAliases: ['salbu', 'salbutamol', 'ventolin', '893115477725'],
    note: 'Thuốc giãn phế quản tác dụng ngắn SABA cắt cơn hen cấp (SĐK: 893115477725 Cục QLD)',
  },
];

/* =========================================================================
 * [DEPRECATED MOCK DATA - ĐÃ COMMENT LẠI THEO YÊU CẦU CHUẨN HÓA 55K THUỐC]
 * Các dữ liệu mẫu cũ dùng mã nội bộ 40.00x không thuộc CSDL Cục QLD:
 * - Midazolam 5mg/5ml (Mã cũ: 40.008)
 * - Solu-Medrol 40mg (Mã cũ: 40.009)
 * - Lasix 20mg/2ml (Mã cũ: 40.010)
 * ========================================================================= */
