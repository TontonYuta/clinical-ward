/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CdssAlert } from '../../types/clinical';
import { checkPairDdi } from '../clinical/drugInteractionMatrix';

export function evaluateLocalCDSS(medName: string, quantity: number, userPrompt: string): CdssAlert | undefined {
  const lower = userPrompt.toLowerCase();
  const medLower = medName.toLowerCase();

  // 1. Quá liều Opioid (Morphin, Fentanyl >= 3)
  if (medLower.includes('morphin') || medLower.includes('fentanyl') || lower.includes('morphin')) {
    if (quantity >= 3) {
      return {
        level: 'critical',
        title: 'CẢNH BÁO AN TOÀN NGƯỜI BỆNH: NGUY CƠ SUY HÔ HẤP DO QUÁ LIỀU OPIOID',
        message: `Chỉ định xuất ${quantity} ống Morphin (tương đương ${quantity * 10}mg) vượt ngưỡng liều cấp cứu thông thường (5–10mg/lần). Dùng liều dồn dập có nguy cơ ức chế trung tâm hô hấp dẫn đến ngừng thở (Respiratory Depression).`,
        antidoteRecommendation: 'Chuẩn bị sẵn 01 ống Naloxone 0.4mg/ml (thuốc đối kháng giải độc Opioid) ngay tại đầu giường bệnh và theo dõi SpO2 liên tục.',
        regulatoryReference: 'Thông tư 20/2017/TT-BYT & Dược thư Quốc gia Việt Nam'
      };
    }
  }

  // 2. Liều cao Adrenalin cấp cứu
  if (medLower.includes('adrenalin') || medLower.includes('epinephrin') || lower.includes('adrenalin')) {
    if (quantity >= 3) {
      return {
        level: 'warning',
        title: 'CẢNH BÁO DƯỢC LÝ: LIỀU CAO ADRENALIN CẤP CỨU',
        message: `Rút ${quantity} ống Adrenalin 1mg/1ml. Phác đồ Thông tư 51/2017/TT-BYT quy định tiêm bắp đùi trước ngoài 1/2 – 1 ống cho người lớn. Dùng liều dồn dập có nguy cơ tăng huyết áp kịch phát, loạn nhịp thất hoặc thiếu máu cơ tim.`,
        antidoteRecommendation: 'Gắn máy theo dõi Monitor đo liên tục ECG, Huyết áp không xâm lấn (NIBP) và SpO2 mỗi 3-5 phút.',
        regulatoryReference: 'Thông tư 51/2017/TT-BYT - Phác đồ cấp cứu phản vệ'
      };
    }
  }

  // 3. Tương tác thuốc xác định (DDI Matrix)
  const ddiAlert = checkPairDdi(medName, userPrompt);
  if (ddiAlert) {
    return {
      level: ddiAlert.severity === 'CONTRAINDICATED' ? 'critical' : 'warning',
      title: ddiAlert.title,
      message: `${ddiAlert.clinicalConsequence} (Cơ chế: ${ddiAlert.mechanism})`,
      antidoteRecommendation: ddiAlert.actionRecommendation,
      regulatoryReference: ddiAlert.evidenceSource
    };
  }

  // 4. Thuốc nguy cơ cao Kali Clorid (KCl 10%)
  if (lower.includes('kcl') || lower.includes('kali') || medLower.includes('kali')) {
    return {
      level: 'critical',
      title: 'THUỐC NGUY CƠ CAO (HIGH-ALERT): KALI CLORID ĐẬM ĐẶC',
      message: 'TUYỆT ĐỐI KHÔNG tiêm tĩnh mạch trực tiếp (IV Bolus). Nguy cơ ngừng tim tâm trương tức thì gây tử vong. Bắt buộc pha loãng vào dịch truyền (tối đa 40mmol/L) và truyền qua máy tiêm điện có kiểm soát tốc độ.',
      antidoteRecommendation: 'Yêu cầu 02 điều dưỡng kiểm tra chéo (Double-check) trước khi cắm dịch truyền.',
      regulatoryReference: 'Quy chế An toàn Sử dụng Thuốc Bộ Y tế'
    };
  }

  return undefined;
}
