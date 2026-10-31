/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Ma trận Tương Tác Thuốc Xác Định (Deterministic DDI Matrix) (<=195 LOC)
 * Căn cứ: QĐ 5948/QĐ-BYT, Dược thư QG 2022, FDA Boxed Warning & SmPC Bộ Y Tế
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

const r = (keysA: string[], keysB: string[], severity: DdiSeverity, title: string, mechanism: string, consequence: string, action: string, source: string): InteractionRule =>
  ({ keysA, keysB, severity, title, mechanism, consequence, action, source });

const DDI_RULES: InteractionRule[] = [
  r(['morphin', 'morphine', 'fentanyl', 'oxycodone', 'pethidine'], ['diazepam', 'seduxen', 'midazolam', 'lorazepam', 'clonazepam'], 'CONTRAINDICATED',
    'OPIOID + BENZODIAZEPINE: NGUY CƠ SUY HÔ HẤP TỬ VONG', 'Tác động hiệp đồng ức chế sâu trên thụ thể mu-opioid và GABA-A tại thân não.',
    'An thần sâu, ức chế trung tâm hô hấp không hồi phục, hôn mê và tử vong.', 'Chống chỉ định phối hợp thường quy. Sẵn sàng Naloxone + Flumazenil.', 'Cảnh báo Hộp Đen FDA & Dược thư QG 2022'),

  r(['ceftriaxone', 'rocephin'], ['canxi', 'calcium', 'ringer lactat', 'hartmann'], 'CONTRAINDICATED',
    'CEFTRIAXONE + DỊCH TRUYỀN CHỨA CANXI: NGUY CƠ KẾT TỦA TỬ VONG', 'Muối Ceftriaxone-Canxi không tan kết tủa trong lòng mạch, phổi và nhu mô thận.',
    'Tắc mạch phổi, suy thận cấp, tử vong (đặc biệt nguy hiểm ở trẻ sơ sinh).', 'CẤM pha chung hoặc truyền cùng đường truyền tĩnh mạch trong vòng 48 giờ.', 'QĐ 5948/QĐ-BYT & SmPC Ceftriaxone'),

  r(['nitroglycerin', 'isosorbid', 'nitrat', 'mononitrat'], ['sildenafil', 'tadalafil', 'vardenafil', 'viagra', 'cialis'], 'CONTRAINDICATED',
    'DẪN CHẤT NITRAT + ỨC CHẾ PDE-5: TỤT HUYẾT ÁP TRỤY MẠCH TỬ VONG', 'Hiệp đồng tăng nồng độ cGMP nội bào tại cơ trơn mạch máu gây giãn mạch toàn thân dữ dội.',
    'Tụt huyết áp kịch phát nghiêm trọng, nhồi máu cơ tim cấp, ngừng tim tử vong.', 'Chống chỉ định tuyệt đối phối hợp. Cách ly tối thiểu 24-48 giờ.', 'QĐ 5948/QĐ-BYT'),

  r(['simvastatin', 'lovastatin'], ['clarithromycin', 'erythromycin', 'itraconazol', 'ketoconazol'], 'CONTRAINDICATED',
    'STATIN + CHẤT ỨC CHẾ CYP3A4 MẠNH: NGUY CƠ TIÊU CƠ VÂN CẤP', 'Ức chế CYP3A4 làm tăng nồng độ Statin trong máu lên gấp 5-10 lần.',
    'Tiêu cơ vân cấp (Rhabdomyolysis), myoglobin niệu gây suy thận cấp vô niệu.', 'Chống chỉ định phối hợp. Tạm ngừng Statin khi dùng kháng sinh/kháng nấm.', 'QĐ 5948/QĐ-BYT'),

  r(['clopidogrel', 'plavix'], ['omeprazol', 'omeprazole', 'esomeprazol', 'esomeprazole'], 'CONTRAINDICATED',
    'CLOPIDOGREL + OMEPRAZOL / ESOMEPRAZOL: GIẢM TÁC DỤNG CHỐNG ĐÔNG', 'Omeprazol ức chế CYP2C19 ngăn chuyển tiền chất Clopidogrel thành chất có hoạt tính.',
    'Mất hiệu lực bảo vệ tim mạch, tăng nguy cơ huyết khối trong stent và tái phát nhồi máu cơ tim.', 'Chuyển sang PPI ít ức chế CYP2C19 như Pantoprazol, Rabeprazol.', 'QĐ 5948/QĐ-BYT'),

  r(['aceclofenac', 'diclofenac', 'ibuprofen'], ['ketorolac', 'toradol'], 'CONTRAINDICATED',
    'PHỐI HỢP NSAID ĐA TẦNG: NGUY CƠ XUẤT HUYẾT TIÊU HÓA Ồ ẠT', 'Hiệp đồng ức chế tổng hợp Prostaglandin bảo vệ niêm mạc dạ dày và chức năng tiểu cầu.',
    'Loét thủng dạ dày, xuất huyết tiêu hóa ồ ạt nguy kịch (tăng gấp 5 lần).', 'Chống chỉ định phối hợp Ketorolac với bất kỳ NSAID nào khác.', 'QĐ 5948/QĐ-BYT'),

  r(['warfarin', 'coumadin', 'sintrom'], ['miconazol', 'fluconazol', 'voriconazol'], 'CONTRAINDICATED',
    'WARFARIN + KHÁNG NẤM AZOLE: XUẤT HUYẾT NỘI TẠNG KỊCH PHÁT', 'Kháng nấm Azole ức chế CYP2C9 ngăn cản chuyển hóa đào thải S-warfarin.',
    'Tăng vọt chỉ số INR, xuất huyết nội sọ, xuất huyết tiêu hóa ồ ạt đe dọa tính mạng.', 'Chống chỉ định tuyệt đối với Miconazol. Thận trọng đặc biệt với Fluconazol.', 'QĐ 5948/QĐ-BYT'),

  r(['methotrexat'], ['ibuprofen', 'diclofenac', 'naproxen', 'ketoprofen', 'aspirin'], 'CONTRAINDICATED',
    'METHOTREXAT + NSAID LIỀU CAO: SUY TỦY XƯƠNG CẤP TÍNH', 'NSAID làm giảm bài tiết Methotrexat qua ống thận và giảm dòng máu thận.',
    'Độc tính tế bào bùng phát, suy tủy xương toàn thể, mất bạch cầu hạt, tử vong.', 'Chống chỉ định phối hợp với Methotrexat liều trung bình và cao.', 'QĐ 5948/QĐ-BYT'),

  r(['allopurinol'], ['azathioprin', 'mercaptopurin', '6-mp'], 'CONTRAINDICATED',
    'ALLOPURINOL + AZATHIOPRIN: ĐỘC TÍNH TỦY XƯƠNG ÁC TÍNH', 'Allopurinol ức chế enzym Xanthine Oxidase ngăn đào thải Azathioprin.',
    'Tích lũy nồng độ chuyển hóa gây suy tủy nặng, giảm tế bào máu nghiêm trọng.', 'Giảm liều Azathioprin xuống còn 25-33% liều chuẩn nếu bắt buộc phối hợp.', 'QĐ 5948/QĐ-BYT'),

  r(['metformin'], ['cản quang', 'iopamidol', 'iohexol', 'iodixanol'], 'CONTRAINDICATED',
    'METFORMIN + THUỐC CẢN QUANG IOD: NHIỄM TOAN LACTIC TỬ VONG', 'Thuốc cản quang gây suy thận cấp làm tích lũy nồng độ Metformin trong máu.',
    'Nhiễm toan lactic cấp tính với tỷ lệ tử vong lên tới 50%.', 'Tạm ngừng Metformin trước khi chụp và chỉ dùng lại sau 48 giờ khi thận ổn định.', 'QĐ 5948/QĐ-BYT & FDA'),

  r(['kali clorid', 'kcl', 'potassium'], ['spironolacton', 'aldactone', 'enalapril', 'perindopril', 'losartan'], 'MAJOR',
    'KALI CLORID + HỆ RAAS / THUỐC GIỮ KALI: TĂNG KALI MÁU ÁC TÍNH', 'Giảm thải trừ kali qua thận kết hợp bù kali ngoại sinh liều cao.',
    'Tăng kali máu ác tính (>6.5 mmol/L), loạn nhịp thất và ngừng tim tâm trương.', 'Theo dõi điện tim liên tục, kiểm tra ion đồ máu mỗi 6-12 giờ.', 'Dược thư QG 2022 & QĐ 2147/QĐ-BYT'),

  r(['vancomycin'], ['furosemid', 'lasix', 'gentamicin', 'amikacin', 'tobramycin'], 'MAJOR',
    'VANCOMYCIN + THUỐC ĐỘC THẬN / TAI: ĐỘC TÍNH TĂNG CƯỜNG', 'Hiệp đồng phá hủy tế bào ống thận và hủy hoại tế bào lông tiền đình ốc tai.',
    'Suy thận cấp hoại tử ống thận và điếc thần kinh giác quan không hồi phục.', 'Theo dõi TDM nồng độ đáy Vancomycin, đo Creatinine và thính lực.', 'Hướng dẫn Kháng sinh Bộ Y Tế'),

  r(['amiodaron', 'cordarone'], ['colchicin', 'colchicine'], 'CONTRAINDICATED',
    'AMIODARON + COLCHICIN: NGỘ ĐỘC COLCHICIN TỬ VONG', 'Amiodaron ức chế P-glycoprotein làm giảm thải trừ Colchicin qua ruột và thận.',
    'Ngộ độc Colchicin cấp: tiêu chảy xuất huyết, tiêu cơ vân, suy đa tạng tử vong.', 'Chống chỉ định phối hợp ở bệnh nhân suy gan hoặc suy thận.', 'QĐ 5948/QĐ-BYT'),

  r(['adrenalin', 'epinephrin'], ['propranolol', 'timolol', 'sotalol'], 'MAJOR',
    'ADRENALIN + CHẸN BETA KHÔNG CHỌN LỌC: TĂNG HUYẾT ÁP KỊCH PHÁT', 'Ức chế giãn mạch thụ thể beta-2, chỉ còn tác dụng co mạch alpha-1 đơn độc.',
    'Cơn tăng huyết áp kịch phát, xuất huyết não và nhịp tim chậm phản xạ nguy kịch.', 'Thận trọng tối đa trong cấp cứu phản vệ. Cân nhắc dùng Glucagon.', 'Thông tư 51/2017/TT-BYT'),

  r(['tramadol'], ['linezolid', 'fluoxetin', 'sertralin', 'paroxetin', 'moclobemid'], 'CONTRAINDICATED',
    'TRAMADOL + THUỐC SEROTONERGIC / LINEZOLID: HỘI CHỨNG SEROTONIN', 'Tích lũy nồng độ Serotonin tại synap thần kinh do ức chế tái hấp thu kép.',
    'Kích động, giật cơ, sốt cao ác tính, co giật và suy hô hấp đe dọa tính mạng.', 'Chống chỉ định tuyệt đối với MAOI và Linezolid.', 'QĐ 5948/QĐ-BYT & Lexicomp')
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
