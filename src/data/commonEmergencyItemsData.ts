/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Danh mục mặt hàng mượn khẩn tủ trực cấp cứu mẫu (VBHN 07 & TT 18/2026/TT-BYT)
 */

import { DebtRecord } from '../types/clinical';

export interface EmergencyItemPreset {
  name: string;
  type: DebtRecord['itemType'];
  defaultQty: string;
  note: string;
}

export const COMMON_EMERGENCY_ITEMS: EmergencyItemPreset[] = [
  { name: 'Morphin sulfat 10mg/1ml', type: 'Thuốc gây nghiện', defaultQty: '2 ống', note: 'Kèm theo dõi thu hồi vỏ ống TT 18/2026' },
  { name: 'Fentanyl 0.1mg/2ml', type: 'Thuốc gây nghiện', defaultQty: '1 ống', note: 'Kèm theo dõi thu hồi vỏ ống TT 18/2026' },
  { name: 'Adrenalin (Epinephrine) 1mg/1ml', type: 'Thuốc cấp cứu', defaultQty: '3 ống', note: 'Cấp cứu sốc phản vệ / ngừng tim (TT 51)' },
  { name: 'Noradrenalin 1mg/ml', type: 'Thuốc cấp cứu', defaultQty: '2 ống', note: 'Nâng huyết áp trong sốc nhiễm khuẩn' },
  { name: 'Ceftriaxone 1g (Lọ bột tiêm)', type: 'Thuốc cấp cứu', defaultQty: '2 lọ', note: 'Kháng sinh phổ rộng cấp bách' },
  { name: 'Bơm tiêm điện 50ml vô khuẩn', type: 'Vật tư tiêu hao', defaultQty: '3 cái', note: 'Gắn máy tiêm thuốc vận mạch' },
  { name: 'Bộ dây truyền dịch áp lực cao', type: 'Vật tư tiêu hao', defaultQty: '2 bộ', note: 'Truyền dịch khẩn' },
];
