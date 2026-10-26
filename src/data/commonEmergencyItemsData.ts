/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Danh mục thuốc mượn khẩn tủ trực cấp cứu từ CSDL 54.885 Thuốc Cục QLD (TT 20/2017 & TT 51/2017)
 */

import { DebtRecord } from '../types/pharmacy';

export interface EmergencyItemPreset {
  name: string;
  type: DebtRecord['itemType'];
  defaultQty: string;
  note: string;
}

export const COMMON_EMERGENCY_ITEMS: EmergencyItemPreset[] = [
  { name: 'Morphin (Morphin hydroclorid 10mg/ml)', type: 'Thuốc gây nghiện', defaultQty: '2 ống', note: 'Bắt buộc thu hồi vỏ ống theo TT 20/2017/TT-BYT' },
  { name: 'Fentanyl 50 micrograms/ml', type: 'Thuốc gây nghiện', defaultQty: '1 ống', note: 'Giảm đau tiền mê phẫu thuật, ký sổ theo dõi vỏ' },
  { name: 'Hadunalin 1 mg/ml (Adrenalin)', type: 'Thuốc cấp cứu', defaultQty: '3 ống', note: 'Cấp cứu sốc phản vệ / ngừng tim (Thông tư 51/2017)' },
  { name: 'Noradrenalin 4mg/4ml', type: 'Thuốc cấp cứu', defaultQty: '2 ống', note: 'Nâng huyết áp sốc nhiễm khuẩn duy trì bơm tiêm điện' },
  { name: 'Ceftriaxona Normon 1g', type: 'Thuốc cấp cứu', defaultQty: '2 lọ', note: 'Kháng sinh cephalosporin thế hệ 3 tiêm tĩnh mạch' },
  { name: 'Kali clorid 10%', type: 'Thuốc cấp cứu', defaultQty: '2 ống', note: 'Thuốc nguy cơ cao High-Alert, pha truyền tĩnh mạch' },
  { name: 'Diazepam Injection BP 10mg/2ml', type: 'Thuốc gây nghiện', defaultQty: '1 ống', note: 'Cắt cơn co giật động kinh / an thần cấp cứu' },
  { name: 'Natri clorid 0,9% A.T', type: 'Thuốc cấp cứu', defaultQty: '2 chai', note: 'Truyền dịch đẳng trương bù tuần hoàn' },
];
