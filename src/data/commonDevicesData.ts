/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Dữ liệu thiết bị y tế mẫu phục vụ báo hỏng nhanh (NĐ 04/2025/NĐ-CP & NĐ 98/2021)
 */

import { DeviceRiskClass, UrgencyLevel } from '../types/clinical';

export interface CommonDevicePreset {
  deviceName: string;
  deviceModel: string;
  serialNumber: string;
  riskClass: DeviceRiskClass;
  defaultLocation: string;
  commonIssue: string;
  urgency: UrgencyLevel;
}

export const COMMON_DEVICES: CommonDevicePreset[] = [
  {
    deviceName: 'Máy thở cao cấp Dräger Savina 300',
    deviceModel: 'Savina 300 Select',
    serialNumber: 'SAV-VN-2022-108',
    riskClass: 'D',
    defaultLocation: 'Khoa Hồi Sức Tích Cực (ICU) - Buồng 04',
    commonIssue: 'Báo lỗi cảm biến áp lực turbine khí thở O2 FiO2',
    urgency: 'urgent',
  },
  {
    deviceName: 'Monitor theo dõi bệnh nhân Mindray ePM 12M',
    deviceModel: 'ePM 12M Pro',
    serialNumber: 'MND-VN-2023-412',
    riskClass: 'C',
    defaultLocation: 'Khoa Cấp Cứu A9 - Giường 02',
    commonIssue: 'Đầu dò SpO2 bị chập chờn, không hiển thị sóng mạch',
    urgency: 'urgent',
  },
  {
    deviceName: 'Máy sốc tim 2 pha Zoll R Series Plus',
    deviceModel: 'R Series ALS',
    serialNumber: 'ZOL-VN-2021-089',
    riskClass: 'D',
    defaultLocation: 'Khoa Cấp Cứu A9 - Xe Tiêm Cấp Cứu',
    commonIssue: 'Bản cực sốc tim ngoài lồng ngực báo tiếp xúc kém',
    urgency: 'urgent',
  },
  {
    deviceName: 'Bơm tiêm điện B.Braun Perfusor Space',
    deviceModel: 'Perfusor Space Gen 2',
    serialNumber: 'BBR-VN-2022-771',
    riskClass: 'C',
    defaultLocation: 'Phòng Mổ 02 - Gây Mê Hồi Sức',
    commonIssue: 'Báo động áp lực đường tiêm giả tạo dù dây thông suốt',
    urgency: 'normal',
  },
];
