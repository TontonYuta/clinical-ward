/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Ma trận Tương Tác Thuốc Xác Định (Deterministic DDI Matrix) (<=200 LOC)
 * Căn cứ: Dược thư QG 2022, FDA Boxed Warning, Micromedex & SmPC Bộ Y Tế
 */

export type DdiSeverity = 'CONTRAINDICATED' | 'MAJOR' | 'MODERATE' | 'MINOR';

export interface DdiAlert {
  drugA: string;
  drugB: string;
  severity: DdiSeverity;
  title: string;
  mechanism: string;
  clinicalConsequence: string;
  actionRecommendation: string;
  evidenceSource: string;
}

interface InteractionRule {
  keysA: string[];
  keysB: string[];
  severity: DdiSeverity;
  title: string;
  mechanism: string;
  consequence: string;
  action: string;
  source: string;
}

const DDI_RULES: InteractionRule[] = [
  {
    keysA: ['morphin', 'morphine', 'fentanyl', 'oxycodone', 'pethidine'],
    keysB: ['diazepam', 'seduxen', 'midazolam', 'lorazepam', 'clonazepam'],
    severity: 'CONTRAINDICATED',
    title: 'OPIOID + BENZODIAZEPINE: NGUY CƠ SUY HÔ HẤP TỬ VONG',
    mechanism: 'Tác động hiệp đồng ức chế sâu trên thụ thể mu-opioid và GABA-A tại thân não.',
    consequence: 'An thần sâu, ức chế trung tâm hô hấp không hồi phục, hôn mê và tử vong.',
    action: 'Chống chỉ định phối hợp thường quy. Nếu bắt buộc, giảm >=50% liều an thần, sẵn sàng Naloxone + Flumazenil.',
    source: 'Cảnh báo Hộp Đen (Boxed Warning) FDA & Dược thư Quốc gia VN 2022',
  },
  {
    keysA: ['ceftriaxone', 'rocephin'],
    keysB: ['canxi', 'calcium', 'ringer lactat', 'hartmann'],
    severity: 'CONTRAINDICATED',
    title: 'CEFTRIAXONE + DỊCH TRUYỀN CHỨA CANXI: NGUY CƠ KẾT TỦA TỬ VONG',
    mechanism: 'Muối Ceftriaxone-Canxi không tan kết tủa trong lòng mạch, phổi và nhu mô thận.',
    consequence: 'Tắc mạch phổi, suy thận cấp, tử vong (đặc biệt nguy hiểm ở trẻ sơ sinh và trẻ nhỏ).',
    action: 'CẤM pha chung hoặc truyền cùng đường truyền tĩnh mạch trong vòng 48 giờ.',
    source: 'Tờ HDSD SmPC Ceftriaxone & Cảnh báo an toàn Cục Quản lý Dược',
  },
  {
    keysA: ['kali clorid', 'kcl', 'potassium'],
    keysB: ['spironolacton', 'aldactone', 'enalapril', 'perindopril', 'losartan'],
    severity: 'MAJOR',
    title: 'KALI CLORID + THUỐC GIỮ KALI / HỆ RAAS: TĂNG KALI MÁU ÁC TÍNH',
    mechanism: 'Giảm thải trừ kali qua ống thận kết hợp nạp thêm kali ngoại sinh.',
    consequence: 'Tăng kali máu cấp tính (>6.5 mmol/L), loạn nhịp thất và ngừng tim tâm trương.',
    action: 'Theo dõi điện tim liên tục, kiểm tra ion đồ máu mỗi 6-12 giờ. Không bù kali liều cao.',
    source: 'Dược thư Quốc gia Việt Nam 2022 (tr. 805) & QĐ 2147/QĐ-BYT',
  },
  {
    keysA: ['vancomycin'],
    keysB: ['furosemid', 'lasix', 'gentamicin', 'amikacin', 'tobramycin'],
    severity: 'MAJOR',
    title: 'VANCOMYCIN + THUỐC ĐỘC THẬN / TAI: ĐỘC TÍNH TĂNG CƯỜNG',
    mechanism: 'Hiệp đồng phá hủy tế bào ống thận và hủy hoại tế bào lông tiền đình ốc tai.',
    consequence: 'Suy thận cấp hoại tử ống thận và điếc thần kinh giác quan không hồi phục.',
    action: 'Theo dõi TDM nồng độ đáy Vancomycin (mục tiêu 15-20 mcg/mL), đo Creatinine và thính lực.',
    source: 'Hướng dẫn Sử dụng Kháng sinh Bộ Y Tế & ASHP/IDSA Guideline',
  },
  {
    keysA: ['adrenalin', 'epinephrin'],
    keysB: ['propranolol', 'timolol', 'sotalol'],
    severity: 'MAJOR',
    title: 'ADRENALIN + CHẸN BETA KHÔNG CHỌN LỌC: TĂNG HUYẾT ÁP KỊCH PHÁT',
    mechanism: 'Ức chế giãn mạch thụ thể beta-2, chỉ còn tác dụng co mạch alpha-1 đơn độc.',
    consequence: 'Cơn tăng huyết áp kịch phát, xuất huyết não và nhịp tim chậm phản xạ nguy kịch.',
    action: 'Thận trọng tối đa trong cấp cứu phản vệ. Ưu tiên Glucagon nếu người bệnh dùng chẹn Beta.',
    source: 'Thông tư 51/2017/TT-BYT & Cẩm nang Hồi sức Cấp cứu',
  },
  {
    keysA: ['tramadol'],
    keysB: ['fluoxetin', 'sertralin', 'paroxetin', 'linezolid'],
    severity: 'MAJOR',
    title: 'TRAMADOL + THUỐC SEROTONERGIC: HỘI CHỨNG SEROTONIN ÁC TÍNH',
    mechanism: 'Tích lũy nồng độ Serotonin tại synap thần kinh do ức chế tái hấp thu kép.',
    consequence: 'Kích động, giật cơ, tăng thân nhiệt ác tính, co giật và suy đa tạng.',
    action: 'Tránh dùng đồng thời. Theo dõi tri giác, nhiệt độ và phản xạ gân xương.',
    source: 'Lexicomp Drug Interactions & Dược thư Quốc gia VN 2022',
  },
];

export function checkPairDdi(drugA: string, drugB: string): DdiAlert | null {
  const normA = drugA.toLowerCase().trim();
  const normB = drugB.toLowerCase().trim();

  for (const rule of DDI_RULES) {
    const matchA_A = rule.keysA.some((k) => normA.includes(k));
    const matchB_B = rule.keysB.some((k) => normB.includes(k));
    const matchA_B = rule.keysA.some((k) => normB.includes(k));
    const matchB_A = rule.keysB.some((k) => normA.includes(k));

    if ((matchA_A && matchB_B) || (matchA_B && matchB_A)) {
      return {
        drugA,
        drugB,
        severity: rule.severity,
        title: rule.title,
        mechanism: rule.mechanism,
        clinicalConsequence: rule.consequence,
        actionRecommendation: rule.action,
        evidenceSource: rule.source,
      };
    }
  }
  return null;
}

export function scanMultiDrugInteractions(drugNames: string[]): DdiAlert[] {
  const alerts: DdiAlert[] = [];
  for (let i = 0; i < drugNames.length; i++) {
    for (let j = i + 1; j < drugNames.length; j++) {
      const result = checkPairDdi(drugNames[i], drugNames[j]);
      if (result) alerts.push(result);
    }
  }
  return alerts;
}
